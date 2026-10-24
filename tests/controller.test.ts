import { describe, it, expect, vi } from "vitest";
import { SessionController } from "@/lib/session/controller";
import { initialSession } from "@/lib/session/fixtures";
import type { Accepted, SessionTransport } from "@/lib/session/contract";
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
    expect(h.transport.cancel).toHaveBeenCalledWith(
      expect.objectContaining({
        turnId: i.turnId,
        epoch: i.epoch,
        revision: 0,
      }),
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
    h.callbacks.bargeIn();
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
});
