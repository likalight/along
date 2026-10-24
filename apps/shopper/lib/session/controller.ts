import type {
  Identity,
  Session,
  SessionTransport,
  VoiceStatus,
  Attachment,
  VoiceEvidence,
  TurnActivity,
} from "./contract";
import type { SpeechAdapter, Playback } from "@/lib/voice/adapter";
import { TransportError } from "./http-transport";
import {
  LiveProductFocus,
  spokenNavigation,
  requestsChromeReview,
} from "./live-product-focus";
export type ClientState = {
  snapshot: Session | null;
  narrationProductId: string | null;
  outputMuted: boolean;
  voiceReviewRequest: {
    productId: string;
    requestId: string;
    destination: "inline" | "chrome";
  } | null;
  status: VoiceStatus;
  capturing: boolean;
  mode: "text" | "voice" | null;
  error: string | null;
  partial: string;
  connected: boolean;
  activity: TurnActivity | null;
  requestText: string;
  waitingSince: number | null;
  delayed: boolean;
  liveCaption: string;
  livePending: boolean;
};
/** Queued references must not replace a draft, voice task or order review. */
export function canAutoImportDiscovery(state: ClientState, hasDraft: boolean) {
  return (
    state.connected &&
    !!state.snapshot &&
    !hasDraft &&
    !state.capturing &&
    !state.livePending &&
    state.status === "ready" &&
    !["summary", "recovery"].includes(state.snapshot.view)
  );
}
export class SessionController {
  private state: ClientState = {
    snapshot: null,
    narrationProductId: null,
    outputMuted: false,
    voiceReviewRequest: null,
    status: "ready",
    capturing: false,
    mode: null,
    error: null,
    partial: "",
    connected: false,
    activity: null,
    requestText: "",
    waitingSince: null,
    delayed: false,
    liveCaption: "",
    livePending: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending: AbortController | null = null;
  private identity: Identity | null = null;
  private disposed = false;
  private voiceActivated = false;
  private voicePauseGeneration = 0;
  private cancellation: Promise<unknown> = Promise.resolve();
  private mediaEvents: Promise<unknown> = Promise.resolve();
  private playback: Playback | null = null;
  private liveFocus = new LiveProductFocus();
  private userNavigationKey: string | null = null;
  private lastPresentedProductId: string | null = null;
  private userReviewHandled = false;
  private pinnedPresentation: string | null = null;
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private delayTimer: ReturnType<typeof setTimeout> | null = null;
  private activityAbort: AbortController | null = null;
  private voice: "marin" | "cedar" | "coral" = "marin";
  speechKind: "live" | "browser" = "browser";
  constructor(
    private transport: SessionTransport,
    private speech: SpeechAdapter,
  ) {}
  /** Select configured OpenAI voice or the labeled browser fallback. */
  setSpeechAdapter(
    adapter: SpeechAdapter,
    kind: "live" | "browser" = "browser",
  ) {
    this.speech.dispose();
    this.speech = adapter;
    this.speech.setVoice?.(this.voice);
    this.speech.setOutputMuted?.(this.state.outputMuted);
    this.speechKind = kind;
  }
  setVoice(voice: "marin" | "cedar" | "coral") {
    this.voice = voice;
    this.speech.setVoice?.(voice);
  }
  setOutputMuted = (muted: boolean) => {
    this.speech.setOutputMuted?.(muted);
    this.update({ outputMuted: muted });
  };
  private stopActivity() {
    if (this.activityTimer) clearTimeout(this.activityTimer);
    if (this.delayTimer) clearTimeout(this.delayTimer);
    this.activityTimer = null;
    this.delayTimer = null;
    this.activityAbort?.abort();
    this.activityAbort = null;
  }
  private pollActivity(identity: Identity, generation: number) {
    if (!this.transport.activity) return;
    const active = () =>
      !this.disposed &&
      generation === this.generation &&
      this.pending !== null &&
      this.identity?.turnId === identity.turnId;
    const poll = async () => {
      if (!active()) return;
      const abort = new AbortController();
      this.activityAbort = abort;
      try {
        const { activity } = await this.transport.activity!(
          identity,
          abort.signal,
        );
        if (
          active() &&
          !abort.signal.aborted &&
          activity?.turnId === identity.turnId
        )
          this.update({ activity });
      } catch {
        // Progress is optional: a failed poll must not cancel the actual request.
      } finally {
        if (this.activityAbort === abort) this.activityAbort = null;
        if (active() && !abort.signal.aborted)
          this.activityTimer = setTimeout(poll, 1000);
      }
    };
    this.activityTimer = setTimeout(poll, 500);
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<ClientState>) {
    if (this.disposed) return;
    if (patch.narrationProductId)
      this.lastPresentedProductId = patch.narrationProductId;
    this.state = {
      ...this.state,
      ...patch,
    };
    this.listeners.forEach((l) => l());
  }
  private acceptSnapshot(snapshot: Session) {
    const current = this.state.snapshot;
    if (
      current &&
      (snapshot.sessionId !== current.sessionId ||
        snapshot.epoch < current.epoch ||
        (snapshot.epoch === current.epoch &&
          snapshot.revision < current.revision))
    )
      return false;
    const changed =
      !current ||
      snapshot.epoch !== current.epoch ||
      snapshot.revision !== current.revision;
    const canvasChanged =
      changed &&
      (!current ||
        snapshot.epoch !== current.epoch ||
        snapshot.view !== current.view ||
        snapshot.focusedProductId !== current.focusedProductId ||
        snapshot.displayOrder.join("|") !== current.displayOrder.join("|"));
    const presentationChanged =
      canvasChanged &&
      (!current ||
        snapshot.epoch !== current.epoch ||
        snapshot.focusedProductId !== current.focusedProductId ||
        snapshot.displayOrder.join("|") !== current.displayOrder.join("|"));
    const firstProductsArrived =
      canvasChanged &&
      current?.displayOrder.length === 0 &&
      snapshot.displayOrder.length > 0 &&
      snapshot.epoch === current.epoch;
    if (canvasChanged && !firstProductsArrived && this.speech.fullDuplex) {
      this.liveFocus.clear();
      if (presentationChanged) {
        this.pinnedPresentation = null;
        this.lastPresentedProductId = snapshot.focusedProductId;
      }
    }
    this.update({
      snapshot,
      ...(presentationChanged && this.speech.fullDuplex
        ? {
            narrationProductId:
              firstProductsArrived && this.state.status === "speaking"
                ? this.liveFocus.reconcile(snapshot)
                : null,
          }
        : {}),
    });
    return true;
  }
  async connect(sessionId?: string) {
    const generation = this.generation;
    try {
      const snapshot = await this.transport.connect(sessionId);
      if (generation === this.generation && this.acceptSnapshot(snapshot))
        this.update({
          connected: true,
          ...(sessionId && snapshot.conversationMode
            ? { mode: snapshot.conversationMode }
            : {}),
        });
    } catch (e) {
      if (generation === this.generation) this.fail(e);
    }
  }
  private currentIdentity(): Identity {
    const s = this.state.snapshot!;
    return this.identity
      ? {
          ...this.identity,
          sessionId: s.sessionId,
          epoch: s.epoch,
          revision: s.revision,
        }
      : {
          sessionId: s.sessionId,
          epoch: s.epoch,
          turnId: crypto.randomUUID(),
          revision: s.revision,
        };
  }
  /** A user-selected extension reference joins this conversation, never as executable page text. */
  async receiveDiscovery(handoffId: string): Promise<boolean> {
    if (!this.state.snapshot || !this.transport.discovery) return false;
    const paused = this.state.status === "paused";
    const voicePauseGeneration = this.voicePauseGeneration;
    const resumeVoice =
      this.state.mode === "voice" &&
      (this.state.capturing ||
        (this.voiceActivated &&
          ["speaking", "thinking"].includes(this.state.status)));
    // An explicitly imported reference supersedes the task, not just its speech.
    // Live barge-in deliberately leaves delegated work running, so interrupt()
    // would allow an older recommendation to overwrite this new reference.
    this.cancelTurn();
    const generation = this.generation;
    this.update({ status: "thinking", error: null, liveCaption: "" });
    try {
      await this.speech.prepareTurn?.();
      await this.cancellation;
      await this.mediaEvents;
      if (generation !== this.generation) return false;
      const latest = await this.transport.connect(
        this.state.snapshot.sessionId,
      );
      if (generation !== this.generation) return false;
      if (!this.acceptSnapshot(latest))
        throw new Error(
          "The conversation changed. Reconnect and try the discovery again.",
        );
      this.update({ livePending: false });
      const result = await this.transport.discovery(
        this.currentIdentity(),
        handoffId,
      );
      if (generation !== this.generation) return false;
      if (!this.acceptSnapshot(result.snapshot))
        throw new Error(
          "This discovery belongs to another conversation or has expired.",
        );
      this.identity = {
        sessionId: result.snapshot.sessionId,
        epoch: result.snapshot.epoch,
        revision: result.snapshot.revision,
        turnId: result.turnId,
      };
      this.update({
        status:
          paused || voicePauseGeneration !== this.voicePauseGeneration
            ? "paused"
            : "ready",
        error: null,
      });
      if (this.speech.fullDuplex) {
        // The existing server-side call receives the reference and its limits;
        // never synthesize a second voice response or new approval evidence.
        await this.speech.sync?.();
        if (generation !== this.generation) return false;
        if (resumeVoice && voicePauseGeneration === this.voicePauseGeneration)
          await this.listenLive();
      } else if (
        resumeVoice &&
        voicePauseGeneration === this.voicePauseGeneration
      )
        this.narrate(result.snapshot);
      return true;
    } catch (error) {
      if (generation === this.generation) {
        if (error instanceof TransportError && error.snapshot)
          this.acceptSnapshot(error.snapshot);
        this.fail(error);
      }
      return false;
    }
  }
  private matches(i: Playback) {
    const s = this.state.snapshot;
    return (
      !!s &&
      i.sessionId === s.sessionId &&
      i.epoch === s.epoch &&
      i.turnId === this.identity?.turnId &&
      i.playbackId === this.playback?.playbackId
    );
  }
  private fail(e: unknown) {
    this.generation++;
    this.liveFocus.clear(true);
    this.stopActivity();
    this.pending?.abort();
    this.pending = null;
    this.playback = null;
    this.speech.cancel();
    this.speech.stop();
    this.update({
      status: "error",
      activity: null,
      waitingSince: null,
      delayed: false,
      capturing: false,
      error:
        e instanceof Error
          ? e.message
          : "Connection unavailable. Retry to get the latest session.",
    });
  }
  /** Esc yields the spoken floor without cancelling delegated shopping work. */
  interrupt = () => {
    if (this.speech.fullDuplex && this.state.mode === "voice") {
      this.liveFocus.clear(true);
      this.speech.cancel();
      this.update({
        status: this.state.capturing ? "listening" : "paused",
      });
      return;
    }
    this.cancelTurn();
  };
  pauseListening = () => {
    this.voicePauseGeneration++;
    this.liveFocus.clear(true);
    this.speech.stop();
    this.update({ capturing: false, status: "paused" });
  };
  /** External video never shares audio capture or narration with the shopper. */
  pauseForExternalVideo = () => {
    this.speech.cancel();
    this.pauseListening();
  };
  /** Release microphone and provider resources when the mounted UI goes away. */
  closeVoice = () => {
    this.voicePauseGeneration++;
    this.liveFocus.clear(true);
    this.speech.dispose();
    this.update({ capturing: false, status: "paused" });
  };
  private cancelTurn = () => {
    this.liveFocus.clear(true);
    const wasInFlight =
      this.state.status === "thinking" ||
      this.state.status === "speaking" ||
      !!this.playback;
    this.generation++;
    this.stopActivity();
    const generation = this.generation;
    this.pending?.abort();
    this.pending = null;
    const identity = this.state.snapshot ? this.currentIdentity() : null;
    this.identity = null;
    this.playback = null;
    this.speech.cancel();
    this.speech.stop();
    if (identity && wasInFlight)
      this.cancellation = this.cancellation
        .catch(() => {})
        .then(async () => {
          const interruptedMedia = this.mediaEvents;
          await interruptedMedia.catch(() => {});
          if (this.mediaEvents === interruptedMedia)
            this.mediaEvents = Promise.resolve();
          const current = this.state.snapshot;
          const snapshot = await this.transport.cancel({
            ...identity,
            revision:
              current?.sessionId === identity.sessionId &&
              current.epoch === identity.epoch
                ? current.revision
                : identity.revision,
          });
          this.acceptSnapshot(snapshot);
        });
    // Observe failures immediately, while preserving rejection for the next operation.
    void this.cancellation.catch((e) => {
      if (generation === this.generation) this.fail(e);
    });
    this.update({
      capturing: false,
      status: "paused",
      partial: "",
      activity: null,
      waitingSince: null,
      delayed: false,
    });
  };
  draftChanged = () => {
    // Ordinary draft edits must not cancel an already presented summary.
    // Only interrupt in-flight thinking/speaking — never a quiescent presented summary.
    if (this.speech.fullDuplex && this.state.mode === "voice") return;
    const view = this.state.snapshot?.view;
    if (view === "summary" || view === "receipt" || view === "recovery") return;
    if (
      this.state.status === "thinking" ||
      this.state.status === "speaking" ||
      this.state.status === "listening"
    ) {
      this.interrupt();
    }
  };
  async chooseMode(mode: "text" | "voice") {
    if (!this.state.snapshot) return;
    if (
      mode === "voice" &&
      this.speech.fullDuplex &&
      this.state.mode === "voice"
    ) {
      await this.listen();
      return;
    }
    this.cancelTurn();
    const generation = this.generation;
    try {
      await this.speech.prepareTurn?.();
      await this.cancellation;
      await this.mediaEvents;
      const latest = await this.transport.connect(
        this.state.snapshot!.sessionId,
      );
      if (generation !== this.generation || !this.acceptSnapshot(latest))
        return;
      const snapshot = await this.transport.mode(
        { ...this.currentIdentity(), revision: latest.revision },
        mode,
      );
      if (generation !== this.generation) return;
      this.identity = null;
      if (!this.acceptSnapshot(snapshot)) return;
      this.update({ mode, error: null, status: "ready" });
      if (mode === "voice") await this.listen();
    } catch (e) {
      if (generation === this.generation) this.fail(e);
    }
  }
  async listen() {
    if (!this.state.snapshot) return;
    if (this.state.mode !== "voice") {
      await this.chooseMode("voice");
      return;
    }
    if (this.speech.fullDuplex) {
      await this.listenLive();
      return;
    }
    if (
      this.state.status === "speaking" ||
      this.state.status === "thinking" ||
      this.state.capturing
    ) {
      this.interrupt();
      const interrupted = this.generation;
      try {
        await this.cancellation;
      } catch (error) {
        if (interrupted === this.generation) this.fail(error);
        return;
      }
      if (interrupted !== this.generation) return;
    }
    this.speech.cancel();
    this.update({ error: null, capturing: false, status: "ready" });
    const generation = this.generation;
    try {
      await this.speech.start({
        capture: (capturing) => {
          if (generation === this.generation)
            this.update({
              capturing,
              status: capturing ? "listening" : "ready",
            });
        },
        bargeIn: () => {
          if (
            generation === this.generation &&
            (this.state.status === "speaking" ||
              this.state.status === "thinking")
          )
            this.interrupt();
        },
        transcript: (text, evidence) => {
          if (generation === this.generation)
            void this.send(text, "voice", undefined, evidence);
        },
        error: (message) => {
          if (generation === this.generation) this.fail(new Error(message));
        },
        ended: () => {
          if (generation === this.generation)
            this.update({ capturing: false, status: "paused" });
        },
      });
      this.voiceActivated = true;
    } catch (e) {
      if (generation === this.generation) this.fail(e);
    }
  }
  private async listenLive() {
    if (this.state.status === "reconnecting") return;
    this.liveFocus.clear();
    let starting = true;
    const generation = this.generation;
    const current = () =>
      !this.disposed &&
      generation === this.generation &&
      this.state.mode === "voice";
    this.update({ status: "reconnecting", error: null });
    try {
      await this.speech.start({
        capture: (capturing) => {
          if (current())
            this.update({
              capturing,
              status: capturing
                ? "listening"
                : starting
                  ? "reconnecting"
                  : "paused",
            });
        },
        transcript: () => {}, // Live transcripts are not authorized shopping input.
        bargeIn: () => {
          if (current()) this.interrupt();
        },
        error: (message) => {
          if (current()) this.fail(new Error(message));
        },
        ended: () => {
          if (current()) this.update({ capturing: false, status: "paused" });
        },
        playbackResumed: () => {
          if (!current()) return;
          this.liveFocus.beginOutput();
          // A fresh audio window does not mean a new product. Hold the current card.
        },
        caption: (speaker, text) => {
          if (!current()) return;
          if (speaker === "user") {
            if (!this.state.capturing) return;
            this.liveFocus.clear();
            const snapshot = this.state.snapshot;
            const navigation =
              snapshot &&
              spokenNavigation(
                text,
                snapshot,
                this.state.narrationProductId ?? this.lastPresentedProductId,
              );
            const newNavigation =
              navigation && navigation.key !== this.userNavigationKey;
            if (newNavigation) {
              this.userNavigationKey = navigation.key;
              this.pinnedPresentation = navigation.productId;
            }
            const review =
              snapshot &&
              !this.state.livePending &&
              !snapshot.summary &&
              !snapshot.receipt &&
              !snapshot.discoveryReference &&
              requestsChromeReview(text) &&
              !this.userReviewHandled;
            const productId =
              this.state.narrationProductId ??
              this.lastPresentedProductId ??
              snapshot?.focusedProductId ??
              snapshot?.displayOrder[0];
            if (review && productId) this.userReviewHandled = true;
            this.update({
              requestText: text,
              narrationProductId: newNavigation
                ? navigation.productId
                : this.state.narrationProductId,
              ...(review && productId
                ? {
                    voiceReviewRequest: {
                      productId,
                      requestId: crypto.randomUUID(),
                      destination: "chrome",
                    },
                  }
                : {}),
            });
          } else {
            this.userNavigationKey = null;
            this.userReviewHandled = false;
            const productId = this.liveFocus.accept(text, this.state.snapshot);
            this.update({
              liveCaption: text,
              narrationProductId:
                this.state.status === "speaking"
                  ? (this.pinnedPresentation ??
                    productId ??
                    this.state.narrationProductId)
                  : this.state.narrationProductId,
            });
          }
        },
        speaking: (active) => {
          if (current())
            this.update({
              narrationProductId: active
                ? (this.pinnedPresentation ??
                  this.liveFocus.productId ??
                  this.state.narrationProductId)
                : this.state.narrationProductId,
              status: active
                ? "speaking"
                : starting
                  ? "reconnecting"
                  : this.state.capturing
                    ? "listening"
                    : "paused",
            });
        },
        backend: (result) => {
          if (!current()) return;
          if (result.snapshot && !this.acceptSnapshot(result.snapshot)) return;
          this.update({
            livePending: result.pending,
            activity: result.activity ?? null,
            waitingSince: result.pending
              ? (this.state.waitingSince ?? Date.now())
              : null,
            error: result.error ?? null,
          });
        },
      });
      starting = false;
      if (current()) this.voiceActivated = true;
      if (current() && this.getSnapshot().status === "reconnecting")
        this.update({ status: this.state.capturing ? "listening" : "paused" });
    } catch (error) {
      starting = false;
      if (current()) this.fail(error);
    }
  }
  async send(
    text: string,
    modality: "text" | "voice" = "text",
    attachment?: Attachment,
    voiceEvidence?: VoiceEvidence,
  ) {
    if (!this.state.snapshot || (!text.trim() && !attachment)) return;
    this.cancelTurn();
    const generation = this.generation;
    this.update({
      liveCaption: "",
      livePending: false,
      status: "thinking",
      error: null,
      requestText: text.trim() || attachment?.name || "Your request",
      waitingSince: Date.now(),
      delayed: false,
      activity: {
        turnId: "",
        phase: "working",
        label: "I’m on it.",
        heading: "Working on your request",
      },
    });
    this.delayTimer = setTimeout(() => {
      if (generation === this.generation && this.state.status === "thinking")
        this.update({ delayed: true });
    }, 10000);
    try {
      await this.speech.prepareTurn?.();
      await this.cancellation;
      await this.mediaEvents;
      if (generation !== this.generation) return;
      // Cancellation may race an already committed turn. Fetch current state; never replay it.
      const latest = await this.transport.connect(
        this.state.snapshot.sessionId,
      );
      if (generation !== this.generation) return;
      if (!this.acceptSnapshot(latest)) return;
      if (this.state.mode !== modality) {
        const snapshot = await this.transport.mode(
          { ...this.currentIdentity(), revision: latest.revision },
          modality,
        );
        if (generation !== this.generation) return;
        if (!this.acceptSnapshot(snapshot)) return;
        this.update({ mode: modality });
        if (snapshot.summary) {
          this.stopActivity();
          this.update({
            activity: null,
            waitingSince: null,
            delayed: false,
            status: "ready",
            error:
              "The full summary is now displayed for text confirmation. Review it and enter a fresh confirmation.",
          });
          return;
        }
      }
      const s = this.state.snapshot!;
      this.identity = {
        sessionId: s.sessionId,
        epoch: s.epoch,
        turnId: crypto.randomUUID(),
        revision: s.revision,
      };
      const abort = new AbortController();
      this.pending = abort;
      const input: {
        sessionId: string;
        epoch: number;
        turnId: string;
        revision: number;
        eventId: string;
        baseRevision: number;
        modality: "text" | "voice" | "image" | "link";
        text?: string;
        attachmentId?: string;
        visibleRevision: number;
        visibleProductIds: string[];
      } = {
        ...this.identity,
        eventId: crypto.randomUUID(),
        baseRevision: s.revision,
        modality: attachment?.kind ?? modality,
        visibleRevision: s.revision,
        visibleProductIds: s.displayOrder,
      };
      // Backend rejects empty strings; image/link shares omit text entirely.
      const trimmed = text.trim();
      if (trimmed) input.text = trimmed;
      if (attachment?.id) input.attachmentId = attachment.id;
      this.pollActivity(this.identity, generation);
      const accepted = await this.transport.send(
        input,
        abort.signal,
        input.modality === "voice" ? voiceEvidence : undefined,
      );
      if (generation !== this.generation) return;
      if (
        accepted.turnId !== this.identity?.turnId ||
        accepted.eventId !== input.eventId ||
        accepted.sessionId !== s.sessionId ||
        accepted.epoch !== s.epoch ||
        accepted.revision <= s.revision ||
        accepted.snapshot.sessionId !== accepted.sessionId ||
        accepted.snapshot.epoch !== accepted.epoch ||
        accepted.snapshot.revision !== accepted.revision
      )
        throw new Error(
          "The response did not match the current accepted turn. Reconnect to refresh the session.",
        );
      this.pending = null;
      this.stopActivity();
      this.identity = { ...this.identity!, revision: accepted.revision };
      // Apply snapshot + ready in one update so ProductCanvas mounts with
      // discovery entrance (not under a lingering "thinking"/busy frame).
      const current = this.state.snapshot;
      if (
        current &&
        (accepted.snapshot.sessionId !== current.sessionId ||
          accepted.snapshot.epoch < current.epoch ||
          (accepted.snapshot.epoch === current.epoch &&
            accepted.snapshot.revision < current.revision))
      )
        return;
      this.update({
        snapshot: accepted.snapshot,
        activity: null,
        waitingSince: null,
        delayed: false,
        status: "ready",
        error: null,
      });
      if (this.speech.fullDuplex) {
        await this.speech.sync?.();
        if (generation === this.generation && modality === "voice")
          await this.listenLive();
      } else if (modality === "voice") this.narrate(accepted.snapshot);
      // Text turns that land on a summary must finish presentation ack before
      // the next confirm — otherwise interrupt→text→confirm races APPROVAL_NOT_READY.
      if (
        modality === "text" &&
        (accepted.snapshot.view === "summary" ||
          accepted.snapshot.view === "recovery") &&
        accepted.snapshot.summary
      ) {
        await this.presentSummary();
      }
    } catch (e) {
      if (generation !== this.generation) return;
      if (e instanceof TransportError && e.snapshot)
        this.acceptSnapshot(e.snapshot);
      this.fail(e);
    }
  }
  private narrate(s: Session) {
    const generation = this.generation;
    const currentIdentity = this.currentIdentity();
    const isSummary =
      s.summary?.responseTurnId === currentIdentity.turnId &&
      s.message === s.summary?.spokenText;
    const identity: Playback = {
      ...currentIdentity,
      playbackId: crypto.randomUUID(),
      summaryId: isSummary ? (s.summaryId ?? undefined) : undefined,
      summaryRevision: isSummary ? s.summary?.revision : undefined,
    };
    this.playback = identity;
    // Loading generated speech is still in-flight work and must be cancellable.
    this.update({
      status: "thinking",
      capturing: false,
      delayed: false,
      activity: {
        turnId: currentIdentity.turnId,
        phase: "speaking",
        label: "Getting your voice reply ready…",
        heading: s.heading,
      },
    });
    let terminalEvent = false;
    try {
      this.speech.speak(
        s.message,
        identity,
        (type, i) => {
          if (
            terminalEvent ||
            generation !== this.generation ||
            !this.matches(i)
          )
            return;
          if (type === "input.barge_in") {
            this.interrupt();
            return;
          }
          if (type === "audio.completed" || type === "audio.interrupted")
            terminalEvent = true;
          if (type === "audio.started")
            this.update({
              status: "speaking",
              capturing: false,
              activity: null,
            });
          this.mediaEvents = this.mediaEvents
            .catch(() => {})
            .then(() => {
              if (generation !== this.generation || !this.matches(i))
                return null;
              return this.transport.lifecycle({
                ...i,
                revision: this.state.snapshot!.revision,
                type,
              });
            })
            .then((snapshot) => {
              if (snapshot && generation === this.generation && this.matches(i))
                this.acceptSnapshot(snapshot);
            });
          void this.mediaEvents.catch((e) => {
            if (generation === this.generation) this.fail(e);
          });
          if (type === "audio.completed") {
            void this.mediaEvents
              .then(() => {
                if (generation === this.generation && this.matches(i)) {
                  this.playback = null;
                  this.update({ status: "ready" });
                  void this.listen();
                }
              })
              .catch(() => {});
          }
          if (type === "audio.interrupted") {
            // Keep the identity until the serialized interruption reaches the
            // server; clearing it here makes the queued matches() check fail.
            this.update({
              status: "paused",
              error:
                "Narration was interrupted. Your selection is preserved — review the summary again or explicitly choose text mode.",
              capturing: false,
              mode: this.state.mode,
            });
            void this.mediaEvents
              .then(() => {
                if (generation === this.generation && this.matches(i))
                  this.playback = null;
              })
              .catch(() => {});
          }
        },
        (message) => {
          if (generation === this.generation && this.matches(identity))
            this.fail(new Error(message));
        },
        !isSummary && s.narrationSegments
          ? {
              segments: s.narrationSegments,
              onProduct: (productId) => {
                if (generation === this.generation && this.matches(identity))
                  this.update({
                    narrationProductId:
                      productId && s.displayOrder.includes(productId)
                        ? productId
                        : null,
                  });
              },
            }
          : undefined,
      );
    } catch (e) {
      this.fail(e);
    }
  }
  /** Trusted canvas video lifecycle — pauses/resumes narration via the store. */
  async handleMediaEvent(event: {
    sessionId: string;
    epoch: number;
    turnId: string;
    revision: number;
    playbackId: string;
    type: "video.started" | "video.stopped";
    videoId?: string;
    takeaway?: string;
  }) {
    const generation = this.generation;
    try {
      if (event.type === "video.started") this.speech.cancel();
      const snapshot = await this.transport.lifecycle({
        sessionId: event.sessionId,
        epoch: event.epoch,
        turnId: event.turnId,
        revision: event.revision,
        playbackId: event.playbackId,
        type: event.type,
        videoId: event.videoId,
        eventId: crypto.randomUUID(),
      });
      if (generation === this.generation) this.acceptSnapshot(snapshot);
      if (event.type === "video.stopped" && event.takeaway) {
        this.update({
          status: "ready",
          error: null,
        });
      }
    } catch (e) {
      if (generation === this.generation) this.fail(e);
    }
  }
  async presentSummary() {
    const s = this.state.snapshot;
    if (!s?.summary || !this.transport.presented) return;
    const generation = this.generation;
    this.mediaEvents = this.mediaEvents
      .catch(() => {})
      .then(async () => {
        if (generation !== this.generation) return;
        const snapshot = await this.transport.presented!(
          {
            sessionId: s.sessionId,
            epoch: s.epoch,
            turnId: s.summary!.responseTurnId!,
            revision: s.revision,
          },
          s.summary!,
        );
        if (
          generation === this.generation &&
          this.state.snapshot?.summaryId === s.summaryId
        )
          this.acceptSnapshot(snapshot);
      });
    void this.mediaEvents.catch((e) => {
      if (generation === this.generation) this.fail(e);
    });
    await this.mediaEvents;
  }
  async reconnect() {
    this.cancelTurn();
    const generation = this.generation;
    this.update({ status: "reconnecting", error: null, connected: false });
    try {
      await this.cancellation.catch(() => {});
      const snapshot = await this.transport.connect(
        this.state.snapshot?.sessionId,
      );
      if (generation !== this.generation) return;
      this.cancellation = Promise.resolve();
      this.mediaEvents = Promise.resolve();
      if (this.acceptSnapshot(snapshot))
        this.update({ status: "paused", connected: true });
    } catch (e) {
      if (generation === this.generation) this.fail(e);
    }
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.stopActivity();
    this.pending?.abort();
    this.speech.dispose();
    this.listeners.clear();
  }
}
