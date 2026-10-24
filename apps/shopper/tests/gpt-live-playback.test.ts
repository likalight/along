import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GptLiveAdapter } from "@/lib/voice/gpt-live-adapter";
import type { SpeechCallbacks } from "@/lib/voice/adapter";

const adapters: GptLiveAdapter[] = [];

async function harness(options: { holdStop?: boolean } = {}) {
  const track = { enabled: true, stop: vi.fn() };
  const input = {
    level: 0,
    getTracks: () => [track],
    getAudioTracks: () => [track],
  };
  const output = { level: 0 };
  const sources: Array<{ disconnect: ReturnType<typeof vi.fn> }> = [];
  const contexts: FakeContext[] = [];
  const controls: string[] = [];
  const audios: FakeAudio[] = [];
  const peers: FakePeer[] = [];
  const stopResponses: Array<() => void> = [];

  class FakeAnalyser {
    fftSize = 0;
    stream: { level: number } | null = null;
    disconnect = vi.fn();
    getFloatTimeDomainData(values: Float32Array) {
      // Alternating samples preserve RMS without introducing a DC signal.
      values.forEach((_, index) => {
        values[index] = (index % 2 ? 1 : -1) * (this.stream?.level ?? 0);
      });
    }
  }
  class FakeContext {
    close = vi.fn(async () => {});
    resume = vi.fn(async () => {});
    constructor() {
      contexts.push(this);
    }
    createAnalyser() {
      return new FakeAnalyser();
    }
    createMediaStreamSource(stream: { level: number }) {
      const source = {
        connect: (analyser: FakeAnalyser) => {
          analyser.stream = stream;
        },
        disconnect: vi.fn(),
      };
      sources.push(source);
      return source;
    }
  }
  class FakeAudio {
    muted = false;
    autoplay = false;
    srcObject: unknown = null;
    play = vi.fn(async () => {});
    pause = vi.fn();
    constructor() {
      audios.push(this);
    }
  }
  class FakeChannel extends EventTarget {
    readyState = "open";
    onmessage: ((event: { data: string }) => void) | null = null;
    close = vi.fn();
    send = vi.fn();
  }
  class FakePeer {
    iceGatheringState = "complete";
    localDescription = { sdp: "v=0\r\n" };
    connectionState = "connected";
    channel = new FakeChannel();
    ontrack: ((event: { streams: unknown[] }) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    addTrack = vi.fn();
    createDataChannel = () => this.channel;
    createOffer = async () => this.localDescription;
    setLocalDescription = async () => {};
    setRemoteDescription = async () => {
      this.ontrack?.({ streams: [output] });
    };
    close = vi.fn();
    constructor() {
      peers.push(this);
    }
  }
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("RTCPeerConnection", FakePeer);
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn(async () => input) },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/voice/live/connect")
        return Response.json({ sdp: "answer", callId: `call-${peers.length}` });
      if (url === "/api/voice/live/control") {
        const action = JSON.parse(String(init?.body)).action;
        controls.push(action);
        if (action === "stop-speaking" && options.holdStop)
          await new Promise<void>((resolve) => stopResponses.push(resolve));
        return Response.json({ pending: true });
      }
      if (url.startsWith("/api/voice/live/state?"))
        return Response.json({ pending: true });
      throw new Error(`Unexpected fetch ${url}`);
    }),
  );
  const adapter = new GptLiveAdapter({ sessionId: "shopping" });
  adapters.push(adapter);
  const cb: SpeechCallbacks = {
    capture: vi.fn(),
    transcript: vi.fn(),
    bargeIn: vi.fn(() => adapter.cancel()),
    error: vi.fn(),
    ended: vi.fn(),
    speaking: vi.fn(),
    playbackResumed: vi.fn(),
    caption: vi.fn(),
    backend: vi.fn(),
  };
  await adapter.start(cb);
  const event = (
    speaker: "input" | "output",
    delta: string,
    start = 1000,
    end = 1100,
  ) => {
    peers.at(-1)!.channel.onmessage?.({
      data: JSON.stringify({
        type: `session.${speaker}_transcript.delta`,
        delta,
        start_ms: start,
        end_ms: end,
      }),
    });
  };
  return {
    adapter,
    cb,
    input,
    output,
    track,
    audio: audios[0],
    controls,
    peers,
    contexts,
    sources,
    event,
    acceptStop: () => stopResponses.shift()?.(),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
});
afterEach(async () => {
  for (const adapter of adapters.splice(0)) adapter.dispose();
  await Promise.resolve();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GPT-Live local interruption and playback recovery", () => {
  it("uses a balanced 200ms speech dwell, yielding by the 225ms sample without waiting for transcripts", async () => {
    const h = await harness();
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.cb.speaking).toHaveBeenLastCalledWith(true);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(200);
    expect(h.audio.muted).toBe(false);
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(true);
    expect(h.cb.bargeIn).toHaveBeenCalledOnce();
    expect(h.cb.speaking).toHaveBeenLastCalledWith(false);
    expect(h.controls).toEqual(["stop-speaking"]);
    expect(h.track.enabled).toBe(true);
    expect(h.track.stop).not.toHaveBeenCalled();
    expect(h.audio.pause).not.toHaveBeenCalled();
    expect(h.cb.backend).toHaveBeenCalledWith({ pending: true });
    expect(h.cb.transcript).not.toHaveBeenCalled();
  });

  it("ignores quiet speaker bleed and isolated clicks", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.input.level = 0.015; // residual echo below the output-relative margin
    await vi.advanceTimersByTimeAsync(1000);
    h.input.level = 0.1;
    await vi.advanceTimersByTimeAsync(50);
    h.input.level = 0.002;
    await vi.advanceTimersByTimeAsync(500);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it("does not mistake a finished shopper confirmation for interruption of the quick checkout reply", async () => {
    const h = await harness();
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(600);
    h.event("input", "Yes, that one", 1000, 1600);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(75);
    h.output.level = 0.08;
    h.event("output", "Your order is confirmed.", 1675, 1900);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it("does not count the preceding solo utterance toward the 200ms overlap dwell", async () => {
    const h = await harness();
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(600);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(500);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it("learns a steady headphone background before output starts instead of treating it as an active shopper", async () => {
    const h = await harness();
    h.input.level = 0.015;
    await vi.advanceTimersByTimeAsync(1000);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(500);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it("does not interrupt a changing checkout voice level for steady background noise and brief spikes", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.input.level = 0.015;
    await vi.advanceTimersByTimeAsync(1000);
    for (let cycle = 0; cycle < 3; cycle++) {
      // Quieter syllables lower the output-relative echo margin; steady room
      // sound in a headphone microphone must not turn into a new utterance.
      h.output.level = 0.03;
      for (let sample = 0; sample < 20; sample++) {
        h.input.level = sample % 2 ? 0.014 : 0.015;
        await vi.advanceTimersByTimeAsync(25);
      }
      h.input.level = 0.08;
      await vi.advanceTimersByTimeAsync(50);
      h.input.level = 0.015;
      h.output.level = 0;
      await vi.advanceTimersByTimeAsync(150);
      h.output.level = 0.08;
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it.each([
    { background: 0.006, speech: 0.04 },
    { background: 0.015, speech: 0.06 },
    { background: 0.018, speech: 0.08 },
  ])(
    "keeps the 200ms interruption dwell and 100ms recovery pause above background $background",
    async ({ background, speech }) => {
      const h = await harness();
      h.input.level = background;
      h.output.level = 0.08;
      await vi.advanceTimersByTimeAsync(1000);
      expect(h.audio.muted).toBe(false);
      h.event("output", "Your checkout details", 1000, 1900);
      h.input.level = speech;
      await vi.advanceTimersByTimeAsync(200);
      expect(h.audio.muted).toBe(false);
      await vi.advanceTimersByTimeAsync(25);
      expect(h.audio.muted).toBe(true);
      h.event("input", "Wait, change the delivery", 2000, 2225);
      h.input.level = background;
      h.output.level = 0;
      await vi.advanceTimersByTimeAsync(75);
      h.event("output", "Sure, what works better?", 2300, 2450);
      h.output.level = 0.08;
      expect(h.audio.muted).toBe(true);
      await vi.advanceTimersByTimeAsync(25);
      expect(h.audio.muted).toBe(false);
      await vi.advanceTimersByTimeAsync(500);
      expect(h.cb.bargeIn).toHaveBeenCalledOnce();
      expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
      expect(h.controls).toEqual(["stop-speaking"]);
    },
  );

  it("does not cancel new audio for a late user caption when the output caption has not arrived", async () => {
    const h = await harness();
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(600);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(75);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.speaking).toHaveBeenLastCalledWith(true);
    h.event("input", "Yes I have an iPhone sixteen", 1000, 1600);
    expect(h.audio.muted).toBe(false);
    h.event("output", "Great, this works with your iPhone.", 1675, 1900);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it("still yields for a quiet real interruption whose transcript trails the microphone", async () => {
    const h = await harness();
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    h.input.level = 0.006;
    await vi.advanceTimersByTimeAsync(125);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(75);
    h.event("input", "Wait a moment", 1050, 1150);
    expect(h.audio.muted).toBe(true);
    expect(h.cb.bargeIn).toHaveBeenCalledOnce();
    expect(h.controls).toEqual(["stop-speaking"]);
  });

  it("leaves brief listening acknowledgments to natural duplex voice instead of hard-stopping playback", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "Here are your options", 1000, 1200);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(150);
    h.event("input", "Okay", 1100, 1250);
    h.input.level = 0;
    h.event("input", "Show me the options", 700, 900);
    await vi.advanceTimersByTimeAsync(200);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it("does not cancel a new answer when an older user transcript arrives late", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "Rode PodMic is the next option", 2000, 2300);
    await vi.advanceTimersByTimeAsync(300);
    h.event("input", "Can you show me options?", 1200, 1900);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.controls).toEqual([]);
  });

  it("drains old speech silently, waits for the shopper, then plays the next reply with fresh captions", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The old recommendation");
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.event("input", "Wait, I need a headset");
    h.event("output", " stale continuation", 1200, 1300);
    expect(h.cb.caption).not.toHaveBeenCalledWith(
      "assistant",
      expect.stringContaining("stale"),
    );
    // Even after the control response and user text, old media is still muted.
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(2000);
    expect(h.audio.muted).toBe(true);
    h.input.level = 0.06;
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(300);
    expect(h.audio.muted).toBe(true);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(200);
    expect(h.audio.muted).toBe(true);
    h.output.level = 0.08;
    h.event("output", "Let's look at headsets.", 3000, 3300);
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.speaking).toHaveBeenLastCalledWith(true);
    expect(h.cb.caption).toHaveBeenLastCalledWith(
      "assistant",
      "Let's look at headsets.",
    );
    expect(h.controls).toEqual(["stop-speaking"]);
  });

  it("keeps manual stop silent until fresh input and drained audio, while repeated stops are idempotent", async () => {
    const h = await harness();
    h.adapter.cancel();
    h.adapter.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.audio.muted).toBe(true);
    h.output.level = 0.08;
    h.input.level = 0.006;
    await vi.advanceTimersByTimeAsync(25);
    h.event("input", "Please continue");
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(300);
    expect(h.audio.muted).toBe(true);
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(200);
    expect(h.audio.muted).toBe(true);
    h.event("output", "Of course.", 1300, 1400);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.controls).toEqual(["stop-speaking"]);
  });

  it("uses provider input as a fallback when soft speech misses the acoustic threshold", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.input.level = 0.006;
    await vi.advanceTimersByTimeAsync(200);
    h.event("input", "Wait a moment");
    expect(h.audio.muted).toBe(true);
    expect(h.cb.bargeIn).toHaveBeenCalledOnce();
    expect(h.track.enabled).toBe(true);
    h.input.level = 0;
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(200);
    expect(h.audio.muted).toBe(true);
    h.event("output", "I'm listening.", 1300, 1400);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.controls).toEqual(["stop-speaking"]);
  });

  it("does not reopen for an old 325ms speech pause while the stop request is pending", async () => {
    const h = await harness({ holdStop: true });
    h.output.level = 0.08;
    h.event("output", "The old recommendation", 1000, 1100);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.input.level = 0;
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(325);
    h.output.level = 0.08;
    h.event("output", " old continuation", 1300, 1400);
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(true);
    expect(h.cb.playbackResumed).not.toHaveBeenCalled();
    h.acceptStop();
    await vi.advanceTimersByTimeAsync(200);
    // The completed HTTP request alone still cannot expose ongoing old media.
    expect(h.audio.muted).toBe(true);
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(600);
    h.event("output", "A new reply", 2400, 2500);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith("assistant", "A new reply");
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
  });

  it("recovers a quick reply to a short 'no' and buffers its first product name until the media sample", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The first option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(125);
    h.event("input", "No", 1050, 1150);
    h.event("output", " stale old tail", 1175, 1250);
    h.input.level = h.output.level = 0;
    await vi.advanceTimersByTimeAsync(125);
    h.event("output", "Rode PodMic", 1300, 1400);
    h.output.level = 0.08;
    expect(h.audio.muted).toBe(true);
    expect(h.cb.caption).not.toHaveBeenCalledWith("assistant", "Rode PodMic");
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith("assistant", "Rode PodMic");
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
    expect(
      vi.mocked(h.cb.playbackResumed!).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(h.cb.caption!).mock.invocationCallOrder.at(-1)!);
  });

  it("keeps an early reply through the 100ms end pause after a sustained correction", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The old option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(775);
    h.event("input", "Actually, I need a headset for calls", 1050, 2000);
    h.input.level = 0.006; // low ambient noise must not extend the end pause
    // The name arrives before even the first media sample observes quiet.
    h.event("output", "Jabra Evolve2", 2025, 2125);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(50);
    h.event("output", " would fit.", 2125, 2200);
    // A late part of the same correction must not erase the candidate or
    // restart the pause just because its transcript arrived after the reply.
    h.event("input", " please", 2000, 2025);
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(true);
    expect(h.cb.playbackResumed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith(
      "assistant",
      "Jabra Evolve2 would fit.",
    );
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
    expect(h.controls).toEqual(["stop-speaking"]);
    expect(h.audio.pause).not.toHaveBeenCalled();
  });

  it("remembers a quick output onset during the end pause even without user captions", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The old option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(300);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(25);
    h.event("output", "Let's try a headset.", 1600, 1800);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(50);
    expect(h.audio.muted).toBe(true);
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith(
      "assistant",
      "Let's try a headset.",
    );
  });

  it("releases an already-started fresh reply once a delayed stop request returns without waiting for another onset", async () => {
    const h = await harness({ holdStop: true });
    h.output.level = 0.08;
    h.event("output", "The old option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(300);
    h.event("input", "Actually, I need a headset", 1050, 1525);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(25);
    h.event("output", "Jabra Evolve2", 1550, 1650);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(200);
    expect(h.audio.muted).toBe(true);
    expect(h.cb.playbackResumed).not.toHaveBeenCalled();
    h.acceptStop();
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith("assistant", "Jabra Evolve2");
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
    // The element played continuously while muted: no old audio is replayed.
    expect(h.audio.play).toHaveBeenCalledOnce();
    expect(h.audio.pause).not.toHaveBeenCalled();
    expect(h.controls).toEqual(["stop-speaking"]);
  });

  it("uses a short remote pause when the reply is timestamped after the shopper's correction", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The old option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.event("input", "Actually, a headset", 1050, 1225);
    h.input.level = h.output.level = 0;
    await vi.advanceTimersByTimeAsync(50);
    h.event("output", "Jabra Evolve2", 1275, 1350);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(true);
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith("assistant", "Jabra Evolve2");
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
  });

  it("discards a candidate if the shopper continues softly during the end pause", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The old option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.output.level = 0;
    await vi.advanceTimersByTimeAsync(300);
    h.event("input", "Actually, a headset", 1050, 1525);
    h.input.level = 0;
    await vi.advanceTimersByTimeAsync(25);
    h.event("output", "Premature answer", 1550, 1650);
    h.output.level = 0.08;
    h.input.level = 0.015; // quieter continuation, below the unmuted echo margin
    await vi.advanceTimersByTimeAsync(250);
    expect(h.audio.muted).toBe(true);
    h.event("input", " with USB-C", 1550, 1800);
    h.input.level = h.output.level = 0;
    await vi.advanceTimersByTimeAsync(125);
    h.event("output", "Jabra Evolve2", 1950, 2050);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith("assistant", "Jabra Evolve2");
    expect(h.cb.caption).not.toHaveBeenCalledWith(
      "assistant",
      expect.stringContaining("Premature"),
    );
  });

  it("announces recovery without any user transcript and preserves the early assistant name", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The first option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.input.level = h.output.level = 0;
    await vi.advanceTimersByTimeAsync(150);
    h.event("output", "Rode PodMic", 1300, 1400);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
    expect(h.cb.caption).toHaveBeenLastCalledWith("assistant", "Rode PodMic");
    expect(h.cb.caption).not.toHaveBeenCalledWith("user", expect.anything());
  });

  it("recovers at a drained new audio boundary when neither transcript stream arrives", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.input.level = h.output.level = 0;
    await vi.advanceTimersByTimeAsync(600);
    expect(h.audio.muted).toBe(true);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
    expect(h.cb.speaking).toHaveBeenLastCalledWith(true);
  });

  it("does not restart recovery or erase the first product caption when user fragments arrive late", async () => {
    const h = await harness();
    h.output.level = 0.08;
    h.event("output", "The first option", 900, 1000);
    h.input.level = 0.06;
    await vi.advanceTimersByTimeAsync(225);
    h.event("input", "Actually, another one", 1050, 1150);
    h.input.level = h.output.level = 0;
    await vi.advanceTimersByTimeAsync(150);
    h.event("output", "Rode PodMic", 1400, 1500);
    // The physical utterance is already quiet. This fragment's arrival time
    // must not add another silence delay or discard the buffered new name.
    h.event("input", " please", 1150, 1200);
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.caption).toHaveBeenLastCalledWith("assistant", "Rode PodMic");
    expect(h.cb.playbackResumed).toHaveBeenCalledOnce();
    h.event("input", " thanks", 1200, 1250);
    expect(h.audio.muted).toBe(false);
    expect(h.cb.bargeIn).toHaveBeenCalledOnce();
  });

  it("ignores microphone activity while capture is stopped and supports explicit voice resume", async () => {
    const h = await harness();
    h.adapter.stop();
    h.input.level = 0.1;
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(300);
    expect(h.cb.bargeIn).not.toHaveBeenCalled();
    expect(h.track.enabled).toBe(false);
    h.adapter.cancel();
    expect(h.audio.muted).toBe(true);
    h.input.level = 0;
    h.output.level = 0;
    await h.adapter.start(h.cb);
    expect(h.track.enabled).toBe(true);
    expect(h.audio.muted).toBe(false);
    expect(h.peers).toHaveLength(1);
  });

  it("releases meters, media, and timers on disposal; late provider events cannot revive playback", async () => {
    const h = await harness();
    h.output.level = 0.08;
    await vi.advanceTimersByTimeAsync(25);
    const events = vi.mocked(h.cb.caption!).mock.calls.length;
    h.adapter.dispose();
    h.event("output", "Late result");
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.track.stop).toHaveBeenCalledOnce();
    expect(h.audio.pause).toHaveBeenCalledOnce();
    expect(h.audio.srcObject).toBeNull();
    expect(
      h.sources.every((source) => source.disconnect.mock.calls.length === 1),
    ).toBe(true);
    expect(h.contexts[0].close).toHaveBeenCalledOnce();
    expect(h.cb.caption).toHaveBeenCalledTimes(events);
    expect(h.cb.speaking).toHaveBeenLastCalledWith(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
