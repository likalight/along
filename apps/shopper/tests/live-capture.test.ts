import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSpeechAdapter } from "@/lib/voice/live-adapter";
import type { SpeechCallbacks } from "@/lib/voice/adapter";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function callbacks(): SpeechCallbacks {
  return {
    capture: vi.fn(),
    transcript: vi.fn(),
    bargeIn: vi.fn(),
    error: vi.fn(),
    ended: vi.fn(),
  };
}

const adapters: LiveSpeechAdapter[] = [];

function harness() {
  const tracks: { enabled: boolean; stop: ReturnType<typeof vi.fn> }[] = [];
  const peers: FakePeer[] = [];
  const captures: {
    callId: string;
    enabled: boolean;
    response: ReturnType<typeof deferred<Response>>;
  }[] = [];
  let calls = 0;

  class FakeChannel extends EventTarget {
    readyState = "open";
    onmessage: ((event: { data: string }) => void) | null = null;
    send = vi.fn();
    close = vi.fn(() => {
      this.readyState = "closed";
    });
  }

  class FakePeer {
    connectionState = "new";
    onconnectionstatechange: (() => void) | null = null;
    channel = new FakeChannel();
    addTrack = vi.fn();
    createDataChannel = vi.fn(() => this.channel);
    createOffer = vi.fn(async () => ({ type: "offer", sdp: "offer" }));
    setLocalDescription = vi.fn(async () => {});
    setRemoteDescription = vi.fn(async () => {
      this.connectionState = "connected";
    });
    close = vi.fn(() => {
      this.connectionState = "closed";
    });

    constructor() {
      peers.push(this);
    }
  }

  vi.stubGlobal("RTCPeerConnection", FakePeer);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn(async () => {
        const track = { enabled: true, stop: vi.fn() };
        tracks.push(track);
        return {
          getAudioTracks: () => [track],
          getTracks: () => [track],
        };
      }),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/voice/connect")
        return Response.json({ sdp: "answer", callId: `call-${++calls}` });
      if (url === "/api/voice/capture") {
        const body = JSON.parse(String(init?.body));
        const response = deferred<Response>();
        captures.push({ ...body, response });
        return response.promise;
      }
      if (url === "/api/voice/disconnect") return Response.json({ ok: true });
      throw new Error(`Unexpected fetch: ${url}`);
    }),
  );
  const adapter = new LiveSpeechAdapter({ sessionId: "session" });
  adapters.push(adapter);
  return { adapter, tracks, peers, captures };
}

afterEach(async () => {
  for (const adapter of adapters.splice(0)) adapter.dispose();
  // Let queued cleanup see the closed call before restoring native globals.
  await Promise.resolve();
  await Promise.resolve();
  vi.unstubAllGlobals();
});

describe("live microphone capture barriers", () => {
  it("keeps the microphone muted until the server acknowledges capture enable", async () => {
    const h = harness();
    const cb = callbacks();
    const starting = h.adapter.start(cb);
    await vi.waitFor(() => expect(h.captures).toHaveLength(1));
    expect(h.captures[0]).toMatchObject({ callId: "call-1", enabled: true });
    expect(h.tracks[0].enabled).toBe(false);
    expect(cb.capture).not.toHaveBeenCalledWith(true);

    h.captures[0].response.resolve(Response.json({ ok: true }));
    await starting;
    expect(h.tracks[0].enabled).toBe(true);
    expect(cb.capture).toHaveBeenLastCalledWith(true);
    expect(h.peers[0].channel.send).not.toHaveBeenCalled();
  });

  it("serializes stop and restart while the microphone stays muted, without data-channel clears", async () => {
    const h = harness();
    const starting = h.adapter.start(callbacks());
    await vi.waitFor(() => expect(h.captures).toHaveLength(1));
    h.captures[0].response.resolve(Response.json({ ok: true }));
    await starting;

    h.adapter.stop();
    const restarting = h.adapter.start(callbacks());
    await vi.waitFor(() => expect(h.captures).toHaveLength(2));
    expect(h.captures[1].enabled).toBe(false);
    expect(h.tracks[0].enabled).toBe(false);
    h.captures[1].response.resolve(Response.json({ ok: true }));
    await vi.waitFor(() => expect(h.captures).toHaveLength(3));
    expect(h.captures.map(({ enabled }) => enabled)).toEqual([
      true,
      false,
      true,
    ]);
    expect(h.tracks[0].enabled).toBe(false);
    h.captures[2].response.resolve(Response.json({ ok: true }));
    await restarting;

    expect(h.tracks[0].enabled).toBe(true);
    expect(h.peers).toHaveLength(1);
    expect(h.peers[0].channel.send).not.toHaveBeenCalled();
  });

  it("does not unmute when a stopped start receives a late enable acknowledgement", async () => {
    const h = harness();
    const cb = callbacks();
    const starting = h.adapter.start(cb);
    await vi.waitFor(() => expect(h.captures).toHaveLength(1));
    h.adapter.stop();
    h.captures[0].response.resolve(Response.json({ ok: true }));
    await starting;

    expect(h.tracks[0].enabled).toBe(false);
    expect(cb.capture).not.toHaveBeenCalledWith(true);
    await vi.waitFor(() => expect(h.captures).toHaveLength(2));
    expect(h.captures[1].enabled).toBe(false);
    h.captures[1].response.resolve(Response.json({ ok: true }));
    expect(h.peers[0].channel.send).not.toHaveBeenCalled();
  });

  it.each(["response", "network"])(
    "creates a fresh voice call after a capture %s failure",
    async (failure) => {
      const h = harness();
      const starting = h.adapter.start(callbacks());
      const rejected = expect(starting).rejects.toThrow();
      await vi.waitFor(() => expect(h.captures).toHaveLength(1));
      if (failure === "response")
        h.captures[0].response.resolve(new Response(null, { status: 400 }));
      else h.captures[0].response.reject(new Error("Network unavailable"));
      await rejected;

      expect(h.peers[0].close).toHaveBeenCalledOnce();
      expect(h.tracks[0].stop).toHaveBeenCalledOnce();
      expect(h.tracks[0].enabled).toBe(false);
      const restarting = h.adapter.start(callbacks());
      await vi.waitFor(() => expect(h.captures).toHaveLength(2));
      expect(h.captures[1]).toMatchObject({ callId: "call-2", enabled: true });
      expect(h.tracks[1].enabled).toBe(false);
      h.captures[1].response.resolve(Response.json({ ok: true }));
      await restarting;
      expect(h.tracks[1].enabled).toBe(true);
    },
  );

  it("does not close a replacement call when an older capture request fails late", async () => {
    const h = harness();
    const starting = h.adapter.start(callbacks());
    await vi.waitFor(() => expect(h.captures).toHaveLength(1));
    h.captures[0].response.resolve(Response.json({ ok: true }));
    await starting;
    h.adapter.stop();
    await vi.waitFor(() => expect(h.captures).toHaveLength(2));
    h.peers[0].connectionState = "disconnected";

    const restarting = h.adapter.start(callbacks());
    await vi.waitFor(() =>
      expect(h.peers[1]?.connectionState).toBe("connected"),
    );
    h.captures[1].response.resolve(new Response(null, { status: 400 }));
    await vi.waitFor(() => expect(h.captures).toHaveLength(3));

    expect(h.captures[2]).toMatchObject({ callId: "call-2", enabled: true });
    expect(h.peers[1].close).not.toHaveBeenCalled();
    expect(h.tracks[1].stop).not.toHaveBeenCalled();
    h.captures[2].response.resolve(Response.json({ ok: true }));
    await restarting;
    expect(h.tracks[1].enabled).toBe(true);
  });
});
