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
  private cancellation: Promise<unknown> = Promise.resolve();
  private mediaEvents: Promise<unknown> = Promise.resolve();
  constructor(
    private transport: SessionTransport,
    private speech: SpeechAdapter,
  ) {}
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
  async connect() {
    const generation = this.generation;
    try {
      const snapshot = await this.transport.connect();
      if (generation === this.generation)
        this.update({ snapshot, connected: true });
    } catch (e) {
      this.fail(e);
    }
  }
  private currentIdentity(): Identity {
    const s = this.state.snapshot!;
    return (
      this.identity ?? {
        sessionId: s.sessionId,
        epoch: s.epoch,
        turnId: crypto.randomUUID(),
        revision: s.revision,
      }
    );
  }
  private matches(i: Identity) {
    const s = this.state.snapshot;
    return (
      !!s &&
      i.sessionId === s.sessionId &&
      i.epoch === s.epoch &&
      i.turnId === this.identity?.turnId
    );
  }
  private fail(e: unknown) {
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
    this.pending?.abort();
    this.pending = null;
    const identity = this.state.snapshot ? this.currentIdentity() : null;
    this.identity = null;
    this.speech.cancel();
    this.speech.stop();
    if (identity && wasInFlight)
      this.cancellation = this.cancellation
        .catch(() => {})
        .then(() => this.transport.cancel(identity));
    // Observe failures immediately, while preserving rejection for the next operation.
    void this.cancellation.catch((e) => this.fail(e));
    this.update({ capturing: false, status: "paused", partial: "" });
  };
  draftChanged = () => {
    if (this.state.status !== "paused") this.interrupt();
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
      this.update({ snapshot: latest });
      const snapshot = await this.transport.mode(
        { ...this.currentIdentity(), revision: latest.revision },
        mode,
      );
      if (generation !== this.generation) return;
      this.identity = null;
      this.update({ snapshot, mode, error: null, status: "ready" });
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
            this.state.status === "speaking" ||
            this.state.status === "thinking"
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
      // Cancellation may race an already committed turn. Fetch current state; never replay it.
      const latest = await this.transport.connect(
        this.state.snapshot.sessionId,
      );
      if (generation !== this.generation) return;
      if (this.state.mode !== modality) {
        const snapshot = await this.transport.mode(
          { ...this.currentIdentity(), revision: latest.revision },
          modality,
        );
        if (generation !== this.generation) return;
        this.update({ snapshot, mode: modality });
        if (snapshot.summary) {
          this.update({
            status: "ready",
            error:
              "The full summary is now displayed for text confirmation. Review it and enter a fresh confirmation.",
          });
          return;
        }
      } else this.update({ snapshot: latest });
      const s = this.state.snapshot!;
      this.identity = {
        sessionId: s.sessionId,
        epoch: s.epoch,
        turnId: crypto.randomUUID(),
        revision: s.revision,
      };
      const abort = new AbortController();
      this.pending = abort;
      const accepted = await this.transport.send(
        {
          ...this.identity,
          eventId: crypto.randomUUID(),
          baseRevision: s.revision,
          modality: attachment?.kind ?? modality,
          text,
          attachmentId: attachment?.id,
          visibleRevision: s.revision,
          visibleProductIds: s.displayOrder,
        },
        abort.signal,
      );
      if (
        generation !== this.generation ||
        accepted.turnId !== this.identity.turnId ||
        accepted.sessionId !== s.sessionId ||
        accepted.epoch !== s.epoch ||
        accepted.revision <= s.revision
      )
        return;
      this.identity = { ...this.identity, revision: accepted.revision };
      this.update({ snapshot: accepted.snapshot, status: "ready" });
      if (modality === "voice") this.narrate(accepted.snapshot);
    } catch (e) {
      if (generation !== this.generation) return;
      if (e instanceof TransportError && e.snapshot)
        this.update({ snapshot: e.snapshot });
      this.fail(e);
    }
  }
  private narrate(s: Session) {
    const identity: Playback = {
      ...this.currentIdentity(),
      playbackId: crypto.randomUUID(),
      summaryId: s.summaryId ?? undefined,
    };
    try {
      this.speech.speak(s.message, identity, (type, i) => {
        if (!this.matches(i)) return;
        if (type === "audio.started")
          this.update({ status: "speaking", capturing: false });
        this.mediaEvents = this.mediaEvents
          .catch(() => {})
          .then(() => this.transport.lifecycle({ ...i, type }))
          .then((snapshot) => {
            if (this.matches(i)) this.update({ snapshot });
          });
        void this.mediaEvents.catch((e) => this.fail(e));
        if (type === "audio.completed") {
          void this.mediaEvents
            .then(() => {
              if (this.matches(i)) void this.listen();
            })
            .catch(() => {});
        }
        if (type === "audio.interrupted") {
          this.update({
            status: "error",
            error:
              "Narration was interrupted. Review the summary again or explicitly choose text mode.",
            capturing: false,
          });
        }
      });
    } catch (e) {
      this.fail(e);
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
          this.update({ snapshot });
      });
    void this.mediaEvents.catch((e) => this.fail(e));
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
      this.update({ snapshot, status: "paused", connected: true });
    } catch (e) {
      this.fail(e);
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
