import type {
  Identity,
  Session,
  SessionTransport,
  VoiceStatus,
  Attachment,
} from "./contract";
import type { SpeechAdapter, Playback } from "@/lib/voice/adapter";
import { TransportError } from "./http-transport";
export type ClientState = {
  snapshot: Session | null;
  status: VoiceStatus;
  capturing: boolean;
  mode: "text" | "voice" | null;
  error: string | null;
  partial: string;
  connected: boolean;
};
export class SessionController {
  private state: ClientState = {
    snapshot: null,
    status: "ready",
    capturing: false,
    mode: null,
    error: null,
    partial: "",
    connected: false,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending: AbortController | null = null;
  private identity: Identity | null = null;
  private disposed = false;
  private voiceActivated = false;
  private cancellation: Promise<unknown> = Promise.resolve();
  private mediaEvents: Promise<unknown> = Promise.resolve();
  private playback: Playback | null = null;
  speechKind: "live" | "browser" = "browser";
  constructor(
    private transport: SessionTransport,
    private speech: SpeechAdapter,
  ) {}
  /** Swap speech implementation after mint (live vs labeled browser fallback). */
  setSpeechAdapter(
    adapter: SpeechAdapter,
    kind: "live" | "browser" = "browser",
  ) {
    this.speech.dispose();
    this.speech = adapter;
    this.speechKind = kind;
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
    this.state = { ...this.state, ...patch };
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
    this.update({ snapshot });
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
    this.interrupt();
    const generation = this.generation;
    try {
      await this.cancellation;
      await this.mediaEvents;
      const latest = await this.transport.connect(
        this.state.snapshot.sessionId,
      );
      if (generation !== this.generation) return false;
      if (!this.acceptSnapshot(latest))
        throw new Error(
          "The conversation changed. Reconnect and try the discovery again.",
        );
      this.update({ status: "thinking", error: null });
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
      this.update({ status: "ready", error: null });
      if (this.state.mode === "voice" && this.voiceActivated)
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
    this.pending?.abort();
    this.pending = null;
    this.playback = null;
    this.speech.cancel();
    this.speech.stop();
    this.update({
      status: "error",
      capturing: false,
      error:
        e instanceof Error
          ? e.message
          : "Connection unavailable. Retry to get the latest session.",
    });
  }
  interrupt = () => {
    const wasInFlight =
      this.state.status === "thinking" || this.state.status === "speaking";
    this.generation++;
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
    this.update({ capturing: false, status: "paused", partial: "" });
  };
  draftChanged = () => {
    // Ordinary draft edits must not cancel an already presented summary.
    // Only interrupt in-flight thinking/speaking — never a quiescent presented summary.
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
    this.interrupt();
    const generation = this.generation;
    try {
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
        transcript: (text) => {
          if (generation === this.generation) void this.send(text, "voice");
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
  async send(
    text: string,
    modality: "text" | "voice" = "text",
    attachment?: Attachment,
  ) {
    if (!this.state.snapshot || (!text.trim() && !attachment)) return;
    this.interrupt();
    const generation = this.generation;
    this.update({ status: "thinking", error: null });
    try {
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
          this.update({
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
      const accepted = await this.transport.send(input, abort.signal);
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
        status: "ready",
        error: null,
      });
      if (modality === "voice") this.narrate(accepted.snapshot);
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
    const identity: Playback = {
      ...this.currentIdentity(),
      playbackId: crypto.randomUUID(),
      summaryId: s.summaryId ?? undefined,
      summaryRevision: s.summary?.revision,
    };
    this.playback = identity;
    try {
      this.speech.speak(s.message, identity, (type, i) => {
        if (generation !== this.generation || !this.matches(i)) return;
        if (type === "input.barge_in") {
          this.interrupt();
          return;
        }
        if (type === "audio.started")
          this.update({ status: "speaking", capturing: false });
        this.mediaEvents = this.mediaEvents
          .catch(() => {})
          .then(() => {
            if (generation !== this.generation || !this.matches(i)) return null;
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
          this.playback = null;
          this.update({
            status: "paused",
            error:
              "Narration was interrupted. Your selection is preserved — review the summary again or explicitly choose text mode.",
            capturing: false,
            mode: this.state.mode,
          });
        }
      });
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
    this.interrupt();
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
    this.pending?.abort();
    this.speech.dispose();
    this.listeners.clear();
  }
}
