import { describe, it, expect, vi, afterEach } from "vitest";
import { SessionController } from "@/lib/session/controller";
import { httpTransport } from "@/lib/session/http-transport";
import { initialSession } from "@/lib/session/fixtures";
import type {
  Accepted,
  Session,
  SessionTransport,
} from "@/lib/session/contract";
import { BrowserSpeechAdapter } from "@/lib/voice/browser-adapter";
import type {
  Playback,
  SpeechAdapter,
  SpeechCallbacks,
} from "@/lib/voice/adapter";
function harness() {
  let s = initialSession("test");
  let callbacks: SpeechCallbacks;
  let playback: {
    identity: Playback;
    emit: Parameters<SpeechAdapter["speak"]>[2];
  };
  const speech: SpeechAdapter = {
    start: vi.fn(async (c) => {
      callbacks = c;
      c.capture(true);
    }),
    stop: vi.fn(),
    speak: vi.fn((_, identity, emit) => {
      playback = { identity, emit };
    }),
    cancel: vi.fn(),
    dispose: vi.fn(),
  };
  const transport: SessionTransport = {
    connect: vi.fn(async () => s),
    cancel: vi.fn(async () => s),
    mode: vi.fn(async () => s),
    lifecycle: vi.fn(async () => s),
    send: vi.fn(async (i) => {
      s = {
        ...s,
        revision: s.revision + 1,
        view: "understanding",
        message: "Accepted",
      };
      return {
        ...i,
        revision: s.revision,
        type: "session.updated",
        snapshot: s,
      } as Accepted;
    }),
  };
  const c = new SessionController(transport, speech);
  return {
    c,
    transport,
    speech,
    get session() {
      return s;
    },
    setSession(snapshot: Session) {
      s = snapshot;
    },
    get callbacks() {
      return callbacks;
    },
    get playback() {
      return playback;
    },
  };
}
describe("session cancellation boundary", () => {
  it("cancels narration while speech is still loading", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("voice");
    await h.c.send("capacity", "voice");
    expect(h.c.getSnapshot().status).toBe("thinking");
    h.c.interrupt();
    await vi.waitFor(() => expect(h.transport.cancel).toHaveBeenCalled());
    expect(h.c.getSnapshot().status).toBe("paused");
  });
  it("surfaces narration errors on the current turn after capture stops", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("voice");
    await h.c.send("capacity", "voice");
    const onError = vi.mocked(h.speech.speak).mock.calls.at(-1)?.[3];
    expect(onError).toBeTypeOf("function");
    onError!("Narration unavailable");
    expect(h.c.getSnapshot().status).toBe("error");
    expect(h.c.getSnapshot().error).toBe("Narration unavailable");
  });
  it("cancels requests immediately when typing and ignores stale accepted responses", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("text");
    let resolve!: (a: Accepted) => void;
    vi.mocked(h.transport.send).mockImplementationOnce(
      (i) =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const pending = h.c.send("old");
    await vi.waitFor(() => expect(h.transport.send).toHaveBeenCalled());
    const i = vi.mocked(h.transport.send).mock.calls[0][0],
      signal = vi.mocked(h.transport.send).mock.calls[0][1];
    h.c.draftChanged();
    expect(signal.aborted).toBe(true);
    resolve({
      ...i,
      type: "session.updated",
      revision: 1,
      snapshot: { ...initialSession("test"), revision: 1, message: "STALE" },
    });
    await pending;
    expect(h.c.getSnapshot().snapshot?.message).not.toBe("STALE");
    await vi.waitFor(() =>
      expect(h.transport.cancel).toHaveBeenCalledWith(
        expect.objectContaining({
          turnId: i.turnId,
          epoch: i.epoch,
          revision: 0,
        }),
      ),
    );
  });
  it("derives capture status from microphone lifecycle, and exposes denial without switching to text", async () => {
    const h = harness();
    await h.c.connect();
    vi.mocked(h.speech.start).mockRejectedValueOnce(
      new Error("Permission denied"),
    );
    await h.c.chooseMode("voice");
    expect(h.c.getSnapshot()).toMatchObject({
      mode: "voice",
      capturing: false,
      status: "error",
    });
    await h.c.chooseMode("text");
    expect(h.c.getSnapshot()).toMatchObject({
      mode: "text",
      capturing: false,
      status: "ready",
    });
  });
  it("forwards the provider utterance reference only with the matching voice turn", async () => {
    const h = harness();
    const evidence = { callId: "call-live", itemId: "item-final" };
    await h.c.connect();
    await h.c.chooseMode("voice");
    h.callbacks.transcript("a work and gym bag", evidence);
    await vi.waitFor(() => expect(h.transport.send).toHaveBeenCalledOnce());
    const [input, signal, submittedEvidence] = vi.mocked(h.transport.send).mock
      .calls[0];
    expect(input).toMatchObject({
      text: "a work and gym bag",
      modality: "voice",
    });
    expect(input).not.toHaveProperty("voiceEvidence");
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(submittedEvidence).toEqual(evidence);
    await vi.waitFor(() => expect(h.speech.speak).toHaveBeenCalledOnce());

    await h.c.send("show offers", "text", undefined, evidence);
    expect(vi.mocked(h.transport.send).mock.calls.at(-1)?.[2]).toBeUndefined();
  });
  it("ignores a delayed voice confirmation after the shopper switches to text", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("voice");
    const staleCapture = h.callbacks;
    await h.c.chooseMode("text");
    staleCapture.transcript("Confirm this simulated purchase", {
      callId: "old-call",
      itemId: "old-approval",
    });
    await Promise.resolve();
    expect(h.transport.send).not.toHaveBeenCalled();
    expect(h.c.getSnapshot().mode).toBe("text");
  });
  it("ignores stale playback after interruption and sends identity to cancellation", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("voice");
    await h.c.send("bag", "voice");
    const p = h.playback;
    h.c.interrupt();
    p.emit("audio.completed", p.identity);
    await Promise.resolve();
    expect(h.transport.lifecycle).not.toHaveBeenCalled();
    expect(h.c.getSnapshot().capturing).toBe(false);
  });
  it("handles barge-in through the adapter cancellation boundary", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("voice");
    await h.c.send("bag", "voice");
    h.playback.emit("audio.started", h.playback.identity);
    h.playback.emit("input.barge_in", h.playback.identity);
    expect(h.c.getSnapshot().status).toBe("paused");
    expect(h.speech.cancel).toHaveBeenCalled();
  });
  it("reconnects to current state without reissuing inputs or playing stale speech", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.reconnect();
    expect(h.transport.send).not.toHaveBeenCalled();
    expect(h.speech.speak).not.toHaveBeenCalled();
    expect(h.c.getSnapshot().status).toBe("paused");
  });
  it("serializes playback callbacks using each accepted revision, then resumes actual capture", async () => {
    const h = harness();
    vi.mocked(h.transport.lifecycle).mockImplementation(async () => {
      const snapshot = { ...h.session, revision: h.session.revision + 1 };
      h.setSession(snapshot);
      return snapshot;
    });
    await h.c.connect();
    await h.c.chooseMode("voice");
    await h.c.send("bag", "voice");
    const p = h.playback;
    p.emit("audio.started", p.identity);
    p.emit("audio.completed", p.identity);
    await vi.waitFor(() => expect(h.c.getSnapshot().capturing).toBe(true));
    expect(
      vi
        .mocked(h.transport.lifecycle)
        .mock.calls.map(([event]) => [event.type, event.revision]),
    ).toEqual([
      ["audio.started", 1],
      ["audio.completed", 2],
    ]);
    expect(h.c.getSnapshot().snapshot?.revision).toBe(3);
    expect(h.c.getSnapshot().status).toBe("listening");
  });
  it("delivers interrupted playback before clearing its identity and rejects a late completion", async () => {
    const h = harness();
    vi.mocked(h.transport.lifecycle).mockImplementation(async (event) => {
      const snapshot = {
        ...h.session,
        revision: h.session.revision + 1,
        approvalStatus:
          event.type === "audio.interrupted"
            ? ("blocked" as const)
            : ("presenting" as const),
      };
      h.setSession(snapshot);
      return snapshot;
    });
    await h.c.connect();
    await h.c.chooseMode("voice");
    await h.c.send("review summary", "voice");
    const playback = h.playback;
    playback.emit("audio.started", playback.identity);
    playback.emit("audio.interrupted", playback.identity);
    playback.emit("audio.completed", playback.identity);

    await vi.waitFor(() =>
      expect(h.c.getSnapshot().snapshot?.approvalStatus).toBe("blocked"),
    );
    expect(
      vi
        .mocked(h.transport.lifecycle)
        .mock.calls.map(([event]) => [event.type, event.revision]),
    ).toEqual([
      ["audio.started", 1],
      ["audio.interrupted", 2],
    ]);
    expect(h.speech.start).toHaveBeenCalledOnce();
    expect(h.c.getSnapshot()).toMatchObject({
      status: "paused",
      capturing: false,
    });
    playback.emit("audio.completed", playback.identity);
    await Promise.resolve();
    expect(h.transport.lifecycle).toHaveBeenCalledTimes(2);
    expect(h.c.getSnapshot().snapshot?.approvalStatus).toBe("blocked");
  });
  it("cancels an in-flight media callback before a new input and ignores its late failure", async () => {
    const h = harness();
    let reject!: (error: Error) => void;
    vi.mocked(h.transport.lifecycle).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    await h.c.connect();
    await h.c.chooseMode("voice");
    await h.c.send("old", "voice");
    h.playback.emit("audio.started", h.playback.identity);
    await vi.waitFor(() => expect(h.transport.lifecycle).toHaveBeenCalled());
    const next = h.c.send("new", "text");
    reject(new Error("Old audio network failure"));
    await next;
    expect(h.c.getSnapshot()).toMatchObject({
      mode: "text",
      status: "ready",
      error: null,
    });
    expect(vi.mocked(h.transport.send).mock.calls.at(-1)?.[0].text).toBe("new");
  });
  it("ignores old microphone and playback barge-in callbacks after a new turn", async () => {
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("voice");
    const staleCapture = h.callbacks;
    await h.c.send("old", "voice");
    const oldPlayback = h.playback;
    await h.c.send("new", "text");
    const before = h.c.getSnapshot();
    staleCapture.capture(true);
    staleCapture.bargeIn();
    staleCapture.error("Old microphone error");
    oldPlayback.emit("input.barge_in", oldPlayback.identity);
    expect(h.c.getSnapshot()).toBe(before);
  });
  it("rejects mismatched accepted event/snapshot identity instead of showing unaccepted state", async () => {
    for (const mismatch of ["event", "session", "epoch", "revision"] as const) {
      const h = harness();
      await h.c.connect();
      await h.c.chooseMode("text");
      vi.mocked(h.transport.send).mockImplementationOnce(async (input) => ({
        ...input,
        eventId: mismatch === "event" ? "other-event" : input.eventId,
        type: "session.updated",
        revision: 1,
        snapshot: {
          ...initialSession(mismatch === "session" ? "other-session" : "test"),
          epoch: mismatch === "epoch" ? 2 : 1,
          revision: mismatch === "revision" ? 9 : 1,
          message: "UNACCEPTED",
        },
      }));
      await h.c.send("bag");
      expect(h.c.getSnapshot().snapshot?.message).not.toBe("UNACCEPTED");
      expect(h.c.getSnapshot().status).toBe("error");
    }
  });
  it("does not let a failed earlier connection override a recovered session", async () => {
    const h = harness();
    let reject!: (error: Error) => void;
    vi.mocked(h.transport.connect).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const old = h.c.connect();
    await h.c.reconnect();
    reject(new Error("stale connect"));
    await old;
    expect(h.c.getSnapshot()).toMatchObject({
      connected: true,
      status: "paused",
      error: null,
    });
  });
});

describe("voice input HTTP transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends only a server-observed utterance reference outside the input envelope", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ type: "session.updated" })),
      );
    vi.stubGlobal("fetch", request);
    const input = {
      sessionId: "session",
      epoch: 1,
      turnId: "turn",
      eventId: "input-event",
      baseRevision: 2,
      modality: "voice" as const,
      text: "Confirm this simulated purchase",
      visibleRevision: 2,
      visibleProductIds: [],
    };
    const evidence = { callId: "call-live", itemId: "item-final" };
    const abort = new AbortController();
    await httpTransport.send(input, abort.signal, evidence);
    expect(request).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ signal: abort.signal }),
    );
    const options = request.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({
      action: "input",
      input,
      voiceEvidence: evidence,
    });
  });
});

describe("browser speech fallback lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());
  const callbacks = (): SpeechCallbacks => ({
    capture: vi.fn(),
    transcript: vi.fn(),
    bargeIn: vi.fn(),
    error: vi.fn(),
    ended: vi.fn(),
  });
  it("stops a microphone stream when permission resolves after cancellation", async () => {
    let resolve!: (stream: MediaStream) => void;
    const stopTrack = vi.fn();
    vi.stubGlobal("window", { SpeechRecognition: class {} });
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((done) => {
            resolve = done;
          }),
      },
    });
    const adapter = new BrowserSpeechAdapter(),
      c = callbacks();
    const started = adapter.start(c);
    adapter.stop();
    resolve({
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream);
    await started;
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(c.capture).not.toHaveBeenCalled();
  });
  it("never calls narration complete if synthesis did not actually start", () => {
    let utterance!: { onend: () => void; onstart: () => void };
    vi.stubGlobal("window", {
      speechSynthesis: {
        cancel: vi.fn(),
        speak: (value: typeof utterance) => {
          utterance = value;
        },
      },
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class {
        constructor(public text: string) {}
      },
    );
    const adapter = new BrowserSpeechAdapter(),
      emit = vi.fn();
    const playback = {
      sessionId: "test",
      epoch: 1,
      revision: 1,
      turnId: "turn",
      playbackId: "audio",
    };
    adapter.speak("Summary", playback, emit);
    utterance.onend();
    expect(emit).toHaveBeenCalledWith("audio.interrupted", playback);
    expect(emit).not.toHaveBeenCalledWith("audio.completed", playback);
  });
});

describe("visible turn activity", () => {
  afterEach(() => vi.useRealTimers());
  it("acknowledges immediately, polls without overlap, and ignores cancelled activity", async () => {
    vi.useFakeTimers();
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("text");
    let resolveSend!: (value: Accepted) => void;
    let resolveActivity!: (value: {
      activity: import("@/lib/session/contract").TurnActivity | null;
    }) => void;
    h.transport.activity = vi.fn<NonNullable<SessionTransport["activity"]>>(
      () =>
        new Promise((resolve) => {
          resolveActivity = resolve;
        }),
    );
    vi.mocked(h.transport.send).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    const pending = h.c.send("Find a cheaper bag");
    expect(h.c.getSnapshot()).toMatchObject({
      activity: { label: "I’m on it." },
      requestText: "Find a cheaper bag",
    });
    await vi.advanceTimersByTimeAsync(500);
    expect(h.transport.activity).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.transport.activity).toHaveBeenCalledTimes(1);
    expect(h.c.getSnapshot().delayed).toBe(true);
    const input = vi.mocked(h.transport.send).mock.calls[0][0];
    const signal = vi.mocked(h.transport.activity!).mock.calls[0][1];
    h.c.interrupt();
    expect(signal?.aborted).toBe(true);
    resolveActivity({
      activity: {
        turnId: input.turnId,
        phase: "working",
        label: "Stale search",
        heading: "Stale",
      },
    });
    resolveSend({
      ...input,
      revision: 1,
      type: "session.updated",
      snapshot: { ...h.session, revision: 1 },
    });
    await pending;
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.transport.activity).toHaveBeenCalledTimes(1);
    expect(h.c.getSnapshot().activity).toBeNull();
    h.c.dispose();
  });
  it("accepts only current turn progress and stops polling after a result", async () => {
    vi.useFakeTimers();
    const h = harness();
    await h.c.connect();
    await h.c.chooseMode("text");
    let resolveSend!: (value: Accepted) => void;
    vi.mocked(h.transport.send).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    h.transport.activity = vi.fn<NonNullable<SessionTransport["activity"]>>(
      async (identity) => ({
        activity: {
          turnId: identity.turnId,
          phase: "working",
          label: "Checking prices",
          heading: "More affordable options",
        },
      }),
    );
    const pending = h.c.send("cheaper");
    await vi.advanceTimersByTimeAsync(500);
    expect(h.c.getSnapshot().activity?.label).toBe("Checking prices");
    vi.mocked(h.transport.activity!).mockResolvedValueOnce({
      activity: {
        turnId: "another-turn",
        phase: "working",
        label: "Wrong turn",
        heading: "Wrong",
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.c.getSnapshot().activity?.label).toBe("Checking prices");
    const input = vi.mocked(h.transport.send).mock.calls[0][0];
    resolveSend({
      ...input,
      revision: 1,
      type: "session.updated",
      snapshot: { ...h.session, revision: 1, heading: "Lower-priced bags" },
    });
    await pending;
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.transport.activity).toHaveBeenCalledTimes(2);
    expect(h.c.getSnapshot().activity).toBeNull();
    expect(h.c.getSnapshot().snapshot?.heading).toBe("Lower-priced bags");
    h.c.dispose();
  });
  it("keeps the selected voice when the speech adapter is replaced", () => {
    const h = harness();
    h.c.setVoice("cedar");
    const setVoice = vi.fn();
    h.c.setSpeechAdapter({ ...h.speech, setVoice }, "live");
    expect(setVoice).toHaveBeenCalledWith("cedar");
    h.c.dispose();
  });
});

describe("GPT-Live conversation boundary", () => {
  it("keeps connection progress visible through initial media cleanup and prevents duplicate starts", async () => {
    const h = harness();
    Object.defineProperty(h.speech, "fullDuplex", { value: true });
    let connected!: () => void;
    h.speech.start = vi.fn(async (callbacks) => {
      callbacks.capture(false);
      callbacks.speaking?.(false);
      await new Promise<void>(resolve => { connected = resolve; });
      callbacks.capture(true);
    });
    await h.c.connect();
    const start = h.c.chooseMode("voice");
    await vi.waitFor(() => expect(h.speech.start).toHaveBeenCalledTimes(1));
    expect(h.c.getSnapshot().status).toBe("reconnecting");
    await h.c.chooseMode("voice");
    expect(h.speech.start).toHaveBeenCalledTimes(1);
    connected();
    await start;
    expect(h.c.getSnapshot()).toMatchObject({ status: "listening", capturing: true });
  });

  it("keeps listening and backend work alive when speech is interrupted", async () => {
    const h = harness();
    Object.defineProperty(h.speech, "fullDuplex", { value: true });
    await h.c.connect();
    await h.c.chooseMode("voice");
    h.callbacks.backend?.({ pending: true, activity: null });
    h.callbacks.speaking?.(true);
    vi.mocked(h.transport.cancel).mockClear();
    vi.mocked(h.speech.stop).mockClear();
    h.c.interrupt();
    expect(h.speech.cancel).toHaveBeenCalled();
    expect(h.speech.stop).not.toHaveBeenCalled();
    expect(h.transport.cancel).not.toHaveBeenCalled();
    expect(h.c.getSnapshot()).toMatchObject({
      capturing: true,
      livePending: true,
      status: "listening",
    });
    h.callbacks.backend?.({
      pending: false,
      snapshot: { ...h.session, revision: 1, message: "Verified choices" },
    });
    expect(h.c.getSnapshot().snapshot?.message).toBe("Verified choices");
  });
  it("treats Live captions as display only, never authorization or new harness requests", async () => {
    const h = harness();
    Object.defineProperty(h.speech, "fullDuplex", { value: true });
    await h.c.connect();
    await h.c.chooseMode("voice");
    h.callbacks.caption?.("user", "Yes, purchase it");
    h.callbacks.transcript("Yes, purchase it");
    expect(h.transport.send).not.toHaveBeenCalled();
    expect(h.c.getSnapshot().requestText).toBe("Yes, purchase it");
  });
  it("rejects stale Live canvas results and can pause microphone without cancelling work", async () => {
    const h = harness();
    Object.defineProperty(h.speech, "fullDuplex", { value: true });
    await h.c.connect();
    await h.c.chooseMode("voice");
    h.callbacks.backend?.({
      pending: true,
      snapshot: { ...h.session, revision: 5, message: "Latest choices" },
    });
    h.callbacks.backend?.({
      pending: false,
      snapshot: { ...h.session, revision: 4, message: "Obsolete choices" },
    });
    expect(h.c.getSnapshot().snapshot?.message).toBe("Latest choices");
    vi.mocked(h.transport.cancel).mockClear();
    h.c.pauseListening();
    expect(h.c.getSnapshot()).toMatchObject({
      capturing: false,
      livePending: true,
    });
    expect(h.transport.cancel).not.toHaveBeenCalled();
  });
  it("supersedes delegated work before a typed correction reaches the existing harness", async () => {
    const h = harness();
    Object.defineProperty(h.speech, "fullDuplex", { value: true });
    const sequence: string[] = [];
    h.speech.prepareTurn = vi.fn(async () => {
      sequence.push("supersede");
    });
    h.speech.sync = vi.fn(async () => {
      sequence.push("sync");
    });
    await h.c.connect();
    await h.c.chooseMode("voice");
    sequence.length = 0;
    const send = h.transport.send;
    h.transport.send = vi.fn(async (...args: Parameters<SessionTransport["send"]>) => {
      sequence.push("send");
      return send(...args);
    });
    await h.c.send("Actually under $80", "text");
    expect(sequence).toEqual(["supersede", "send", "sync"]);
    expect(h.speech.speak).not.toHaveBeenCalled();
  });
});
