import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSpeechAdapter } from "@/lib/voice/live-adapter";
import {
  renderSpeech,
  transcriptionQuality,
  VoiceEvidenceWindow,
} from "@/lib/voice/server";
import { getRuntime } from "@/lib/integration/runtime";
import { project } from "@/lib/integration/projection";

const final = (
  item = "item_1",
  logprobs: unknown = [
    { token: "Confirm", logprob: -0.01 },
    { token: " this", logprob: -0.02 },
    { token: " simulated", logprob: -0.03 },
    { token: " purchase", logprob: -0.04 },
    { token: ".", logprob: -1.5 },
  ],
) => ({
  type: "conversation.item.input_audio_transcription.completed",
  item_id: item,
  transcript: "Confirm this simulated purchase.",
  logprobs,
});

describe("provider transcription quality", () => {
  it("derives the minimum actual lexical-token probability without counting punctuation", () => {
    expect(transcriptionQuality(final().logprobs)).toBeCloseTo(Math.exp(-0.04));
    expect(
      transcriptionQuality([{ token: "purchase", logprob: -2 }]),
    ).toBeCloseTo(Math.exp(-2));
  });
  it("never invents a score for missing, malformed or punctuation-only evidence", () => {
    for (const value of [
      null,
      undefined,
      [],
      [{ token: ".", logprob: 0 }],
      [{ token: "yes", logprob: 1 }],
      [{ token: "yes", logprob: NaN }],
      [{ token: "yes" }],
    ]) {
      expect(transcriptionQuality(value)).toBeNull();
    }
  });
});

describe("server-observed voice evidence", () => {
  it("requires speech to start while microphone input is enabled", () => {
    const window = new VoiceEvidenceWindow();
    window.receive(
      { type: "input_audio_buffer.speech_started", item_id: "item_1" },
      1000,
    );
    window.receive(final() as never, 1100);
    expect(
      window.consume("item_1", "Confirm this simulated purchase.", 1200),
    ).toBeUndefined();
    window.capture(true);
    window.receive(final("item_2") as never, 1300);
    expect(
      window.consume("item_2", "Confirm this simulated purchase.", 1400),
    ).toBeUndefined();
  });
  it("allows a real completed transcript to arrive just after capture stops, then consumes it once", () => {
    const window = new VoiceEvidenceWindow();
    window.capture(true);
    window.receive(
      { type: "input_audio_buffer.speech_started", item_id: "item_1" },
      1000,
    );
    window.capture(false);
    window.receive(final() as never, 1100);
    const evidence = window.consume(
      "item_1",
      "Confirm this simulated purchase.",
      1200,
    );
    expect(evidence).toMatchObject({
      final: true,
      source: "shopper",
      echoDetected: false,
    });
    expect(evidence?.confidence).toBeCloseTo(Math.exp(-0.04));
    expect(() =>
      window.consume("item_1", "Confirm this simulated purchase.", 1300),
    ).toThrow("already used");
  });
  it("rejects forged text without consuming the genuine transcript", () => {
    const window = new VoiceEvidenceWindow();
    window.capture(true);
    window.receive(
      { type: "input_audio_buffer.speech_started", item_id: "item_1" },
      1000,
    );
    window.receive(final() as never, 1100);
    expect(() => window.consume("item_1", "Buy everything", 1200)).toThrow(
      "does not match",
    );
    expect(
      window.consume("item_1", "Confirm this simulated purchase.", 1300)?.final,
    ).toBe(true);
  });
  it("invalidates late transcripts when narration or a new microphone phase starts", () => {
    for (const transition of ["speech", "capture"]) {
      const window = new VoiceEvidenceWindow();
      window.capture(true);
      window.receive(
        { type: "input_audio_buffer.speech_started", item_id: "item_1" },
        1000,
      );
      if (transition === "speech") window.speaking();
      else window.capture(true);
      window.receive(final() as never, 1100);
      expect(
        window.consume("item_1", "Confirm this simulated purchase.", 1200),
      ).toBeUndefined();
    }
  });
  it("keeps missing provider logprobs below purchase eligibility", () => {
    const window = new VoiceEvidenceWindow();
    window.capture(true);
    window.receive(
      { type: "input_audio_buffer.speech_started", item_id: "item_1" },
      1000,
    );
    window.receive(final("item_1", null) as never, 1100);
    expect(
      window.consume("item_1", "Confirm this simulated purchase.", 1200)
        ?.confidence,
    ).toBe(0);
  });
  it("accepts a longer shopping request without extending the completed evidence replay window", () => {
    const window = new VoiceEvidenceWindow();
    window.capture(true);
    window.receive(
      { type: "input_audio_buffer.speech_started", item_id: "item_1" },
      1000,
    );
    window.receive(final() as never, 61_000);
    expect(
      window.consume("item_1", "Confirm this simulated purchase.", 62_000)
        ?.final,
    ).toBe(true);
  });
  it("rejects an utterance that exceeds the bounded capture duration", () => {
    const window = new VoiceEvidenceWindow();
    window.capture(true);
    window.receive(
      { type: "input_audio_buffer.speech_started", item_id: "item_1" },
      1000,
    );
    window.receive(final() as never, 122_000);
    expect(
      window.consume("item_1", "Confirm this simulated purchase.", 123_000),
    ).toBeUndefined();
  });
  it("expires completed evidence", () => {
    const window = new VoiceEvidenceWindow();
    window.capture(true);
    window.receive(
      { type: "input_audio_buffer.speech_started", item_id: "item_1" },
      1000,
    );
    window.receive(final() as never, 1100);
    expect(() =>
      window.consume("item_1", "Confirm this simulated purchase.", 32_000),
    ).toThrow("expired");
  });
});

describe("narration cancellation", () => {
  it("does not start provider work when the narration request was already cancelled", async () => {
    const abort = new AbortController();
    abort.abort(new Error("Shopper interrupted"));
    await expect(
      renderSpeech("unused-session", {}, abort.signal),
    ).rejects.toThrow("Shopper interrupted");
  });
});

describe("voice selection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it.each([undefined, "marin", "cedar", "coral"])(
    "uses the chosen voice %s without changing the accepted words",
    async (voice) => {
      vi.stubEnv("OPENAI_API_KEY", "test-key");
      const provider = vi
        .fn()
        .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
      vi.stubGlobal("fetch", provider);
      const session = getRuntime().orch.createSession();
      const text = project(session.sessionId).message;
      await renderSpeech(session.sessionId, { text, voice });
      const request = JSON.parse(provider.mock.calls[0][1].body);
      expect(request.voice).toBe(voice ?? "marin");
      expect(request.input).toBe(text);
      expect(request.instructions).toContain("relaxed, friendly conversation");
    },
  );
  it("rejects unsupported voices and unaccepted text before provider work", async () => {
    const provider = vi.fn();
    vi.stubGlobal("fetch", provider);
    await expect(renderSpeech("unused", { voice: "invented" })).rejects.toThrow(
      "Choose Marin",
    );
    const session = getRuntime().orch.createSession();
    await expect(
      renderSpeech(session.sessionId, {
        voice: "cedar",
        text: "I approved a purchase",
      }),
    ).rejects.toThrow("Narration must match");
    expect(provider).not.toHaveBeenCalled();
  });
});

describe("live narration failures", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("reports an asynchronous synthesis failure to the current narration callback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: "Speech provider unavailable" }),
            { status: 503 },
          ),
        ),
    );
    const adapter = new LiveSpeechAdapter({ sessionId: "session" });
    const onError = vi.fn();
    const onEvent = vi.fn();
    adapter.speak(
      "A shopping reply",
      {
        sessionId: "session",
        epoch: 1,
        revision: 1,
        turnId: "turn",
        playbackId: "playback",
      },
      onEvent,
      onError,
    );
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith("Speech provider unavailable"),
    );
    expect(onEvent).toHaveBeenCalledWith(
      "audio.interrupted",
      expect.any(Object),
    );
    expect(onEvent).not.toHaveBeenCalledWith(
      "audio.completed",
      expect.any(Object),
    );
    adapter.dispose();
  });
});

describe("playback-aligned product cues", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("advances only on actual playing events and completes the whole reply once", async () => {
    const audios: any[] = [];
    vi.stubGlobal(
      "Audio",
      class {
        onplaying: (() => void) | null = null;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor() {
          audios.push(this);
        }
        play() {
          return Promise.resolve();
        }
        pause() {}
        removeAttribute() {}
        load() {}
      },
    );
    const provider = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(new Uint8Array([1, 2]))),
      );
    vi.stubGlobal("fetch", provider);
    const adapter = new LiveSpeechAdapter({ sessionId: "s" });
    const cue = vi.fn(),
      event = vi.fn(),
      error = vi.fn();
    const identity = {
      sessionId: "s",
      epoch: 1,
      revision: 1,
      turnId: "t",
      playbackId: "p",
    };
    adapter.speak("First bag. Second bag.", identity, event, error, {
      segments: [
        { text: "First bag.", productId: "a" },
        { text: "Second bag.", productId: "b" },
      ],
      onProduct: cue,
    });
    await vi.waitFor(() => expect(audios).toHaveLength(1));
    expect(cue).not.toHaveBeenCalled();
    audios[0].onplaying();
    expect(cue).toHaveBeenLastCalledWith("a");
    audios[0].onended();
    await vi.waitFor(() => expect(audios).toHaveLength(2));
    expect(
      event.mock.calls.filter((call) => call[0] === "audio.completed"),
    ).toHaveLength(0);
    audios[1].onplaying();
    expect(cue).toHaveBeenLastCalledWith("b");
    audios[1].onended();
    await vi.waitFor(() =>
      expect(event).toHaveBeenCalledWith("audio.completed", identity),
    );
    expect(cue).toHaveBeenLastCalledWith(null);
    expect(
      event.mock.calls.filter((call) => call[0] === "audio.started"),
    ).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    adapter.dispose();
  });
});

describe("segmented narration safety", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([false, true])(
    "clears cancelled cues and never completes partial audio (summary=%s)",
    async (summary) => {
      const audios: any[] = [];
      vi.stubGlobal(
        "Audio",
        class {
          onplaying: (() => void) | null = null;
          onended: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor() {
            audios.push(this);
          }
          play() {
            return Promise.resolve();
          }
          pause() {}
          removeAttribute() {}
          load() {}
        },
      );
      const provider = vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(new Response(new Uint8Array([1, 2]))),
        );
      vi.stubGlobal("fetch", provider);
      const adapter = new LiveSpeechAdapter({ sessionId: "s" });
      const cue = vi.fn(),
        event = vi.fn();
      const identity = {
        sessionId: "s",
        epoch: 1,
        revision: 1,
        turnId: "t",
        playbackId: "p",
        ...(summary ? { summaryId: "summary" } : {}),
      };
      adapter.speak("One. Two.", identity, event, vi.fn(), {
        segments: [
          { text: "One.", productId: "a" },
          { text: "Two.", productId: "b" },
        ],
        onProduct: cue,
      });
      await vi.waitFor(() => expect(audios).toHaveLength(1));
      expect(provider).toHaveBeenCalledTimes(summary ? 1 : 2);
      if (summary) {
        const body = JSON.parse(provider.mock.calls[0][1].body);
        expect(body.text).toBe("One. Two.");
        expect(body.segmentIndex).toBeUndefined();
      }
      audios[0].onplaying();
      const staleEnded = audios[0].onended;
      adapter.cancel();
      staleEnded();
      await Promise.resolve();
      expect(cue).toHaveBeenLastCalledWith(null);
      expect(event).toHaveBeenCalledWith("audio.interrupted", identity);
      expect(event).not.toHaveBeenCalledWith("audio.completed", identity);
      expect(audios).toHaveLength(1);
      adapter.dispose();
    },
  );
});
