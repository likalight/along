import type {
  InputEvent,
  LifecycleEvent,
  SessionSnapshot,
  SpeakableResult,
  DiscoveryReference,
  DiscoveryImportIdentity,
} from "@coupang/contract";
import { isExplicitCatalogRequest, type DiscoveryImportResult } from "../discovery/reference.js";
import { routeInput } from "../intent/router.js";
import type { FixtureSessionStore } from "../session/FixtureSessionStore.js";
import { SessionThread } from "../thread/SessionThread.js";
import { reduce } from "../thread/reduce.js";
import type { VoiceAdapter } from "../voice/adapter.js";
import { agentLoop } from "./agentLoop.js";
import { TurnMachine } from "./TurnMachine.js";

export interface TurnOutcome {
  snapshot: SessionSnapshot;
  speakable: SpeakableResult[];
  cancelled: boolean;
  route: string;
}

/**
 * Multimodal voice orchestrator: duplex-aware turn lifecycle over contract v1.
 * Typed/image/link inputs still produce spoken replies via the voice adapter.
 */
export class VoiceOrchestrator {
  private sessionTurns = new Map<string, TurnMachine>();
  turnsFor(id: string) {
    let t = this.sessionTurns.get(id);
    if (!t) {
      t = new TurnMachine();
      this.sessionTurns.set(id, t);
    }
    return t;
  }
  private threads = new Map<string, SessionThread>();

  constructor(
    private readonly store: FixtureSessionStore,
    private readonly voice: VoiceAdapter,
  ) {}

  createSession(opts?: {
    scenarioId?: SessionSnapshot["scenarioId"];
    preparedAttachmentId?: string;
  }): SessionSnapshot {
    const snap = this.store.create(opts);
    this.threads.set(snap.sessionId, new SessionThread(snap));
    void this.voice.connect(snap.sessionId);
    return snap;
  }

  getSnapshot(sessionId: string): SessionSnapshot | undefined {
    return this.store.get(sessionId);
  }

  async importDiscovery(sessionId: string, reference: DiscoveryReference, identity: DiscoveryImportIdentity): Promise<DiscoveryImportResult> {
    const result = this.store.importDiscovery(sessionId, reference, identity);
    if (result.duplicate) return result;
    const active = this.turnsFor(sessionId).active;
    if (active) this.turnsFor(sessionId).cancel(active.turnId, "discovery_handoff");
    await this.voice.interrupt(sessionId, "discovery_handoff");
    const current = this.store.get(sessionId);
    if (!current || current.epoch !== result.snapshot.epoch || current.revision !== result.snapshot.revision)
      return { ...result, duplicate: true, snapshot: current ?? result.snapshot };
    const thread = this.thread(sessionId, current);
    reduce(thread, { type: "discovery_reference", data: { handoffId: reference.handoffId, turnId: result.turnId } });
    reduce(thread, { type: "assistant_transcript", data: { turnId: result.turnId, text: result.speakable } });
    await this.voice.append(sessionId, "commentary", result.speakable, { turnId: result.turnId });
    return result;
  }

  async handleInput(input: InputEvent): Promise<TurnOutcome> {
    const snap = this.store.get(input.sessionId);
    if (!snap) {
      throw new Error(`Unknown session ${input.sessionId}`);
    }
    if (input.epoch !== snap.epoch) {
      throw new Error("epoch_mismatch");
    }

    this.store.ingestInput(input);
    const returningToCatalog = !!snap.discoveryReference &&
      (input.modality === "text" || input.modality === "voice") &&
      isExplicitCatalogRequest(input.text ?? "") && !/^back to my catalog[.!]?$/i.test((input.text ?? "").trim());
    if (returningToCatalog) this.store.clearDiscovery(input.sessionId);
    const turns = this.turnsFor(input.sessionId);
    // New typed/voice turn cancels in-flight speech + work
    const active = turns.active;
    if (active) {
      turns.cancel(active.turnId, "new_input");
      await this.voice.interrupt(input.sessionId, "new_input");
      const thread = this.thread(input.sessionId, snap);
      reduce(thread, {
        type: "delegation_cancelled",
        data: { turnId: active.turnId, reason: "new_input" },
      });
    }

    const basedOn = this.store.get(input.sessionId)!;
    const turn = turns.beginTurn({
      turnId: input.turnId,
      basedOnRevisionId: basedOn.revision,
      delegationId: `del-${input.turnId}`,
    });

    const thread = this.thread(input.sessionId, basedOn);
    reduce(thread, { type: "user_input", data: input });
    reduce(thread, {
      type: "delegation_started",
      data: { turnId: turn.turnId, delegationId: turn.delegationId! },
    });

    // Typing / links still get spoken replies
    if (input.modality === "text" || input.modality === "link") {
      await this.voice.injectUserText(input.sessionId, input.text ?? "");
    }

    await this.voice.append(
      input.sessionId,
      "thinking",
      "Looking at that now…",
      {
        turnId: turn.turnId,
        delegationId: turn.delegationId,
      },
    );

    const route = routeInput(input, basedOn);
    const normalized: InputEvent = {
      ...input,
      baseRevision: basedOn.revision,
    };

    const result = await agentLoop({
      input: normalized,
      route,
      thread,
      store: this.store,
      cancel: turn.cancelToken.signal,
    });
    if (returningToCatalog && result.speakable[0])
      result.speakable[0].content = `Back to your catalog choices. ${result.speakable[0].content}`;

    const current = this.store.get(input.sessionId)!;
    // Own applies advance revision; only drop when this turn was cancelled (barge-in / newer input).
    if (turn.cancelToken.signal.aborted || turn.status === "cancelled") {
      return {
        snapshot: current,
        speakable: [],
        cancelled: true,
        route,
      };
    }

    for (const s of result.speakable) {
      await this.voice.append(input.sessionId, s.channel, s.content, {
        turnId: turn.turnId,
        delegationId: turn.delegationId,
      });
      reduce(thread, {
        type: "assistant_transcript",
        data: { turnId: turn.turnId, text: s.content },
      });
    }

    turns.complete(turn.turnId);
    reduce(thread, {
      type: "delegation_completed",
      data: { turnId: turn.turnId },
    });
    thread.snapshot = this.store.get(input.sessionId)!;

    return {
      snapshot: thread.snapshot,
      speakable: result.speakable,
      cancelled: false,
      route,
    };
  }

  async handleLifecycle(
    event: LifecycleEvent,
  ): Promise<SessionSnapshot | undefined> {
    if (event.type === "audio.interrupted" || event.type === "turn.cancelled") {
      this.turnsFor(event.sessionId).cancel(event.turnId, event.type);
      await this.voice.interrupt(event.sessionId, event.type);
      return this.store.interruptSummary(event.sessionId);
    }
    if (event.type === "video.started") {
      await this.voice.pauseNarrationForVideo(event.sessionId);
      return this.store.get(event.sessionId);
    }
    if (event.type === "video.stopped") {
      const snap = this.store.get(event.sessionId);
      const takeaway =
        "From that video: treat it as curated fixture media — here's the grounded takeaway without inventing specs. Your original needs are unchanged.";
      await this.voice.resumeAfterVideo(event.sessionId, takeaway);
      return snap;
    }
    return this.store.get(event.sessionId);
  }

  async bargeIn(sessionId: string, turnId: string): Promise<void> {
    this.turnsFor(sessionId).cancel(turnId, "barge_in");
    await this.voice.interrupt(sessionId, "barge_in");
    this.store.interruptSummary(sessionId);
  }

  private thread(sessionId: string, snap: SessionSnapshot): SessionThread {
    let t = this.threads.get(sessionId);
    if (!t) {
      t = new SessionThread(snap);
      this.threads.set(sessionId, t);
    } else {
      t.snapshot = snap;
    }
    return t;
  }
}
