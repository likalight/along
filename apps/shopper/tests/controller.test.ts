import { describe, it, expect, vi, afterEach } from "vitest";
import { SessionController } from "@/lib/session/controller";
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
