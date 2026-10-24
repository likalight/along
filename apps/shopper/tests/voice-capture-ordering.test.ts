import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestSocket = EventEmitter & {
  sent: string[];
  acknowledgeClear: boolean;
  provider: (event: Record<string, unknown>) => void;
};

vi.mock("ws", () => ({
  default: class extends EventEmitter {
    static sockets: TestSocket[] = [];
    sent: string[] = [];
    acknowledgeClear = true;
    constructor() {
      super();
      (this.constructor as unknown as { sockets: TestSocket[] }).sockets.push(
        this,
      );
      queueMicrotask(() => this.emit("open"));
    }
    send(raw: string) {
      this.sent.push(raw);
      if (
        this.acknowledgeClear &&
        JSON.parse(raw).type === "input_audio_buffer.clear"
      )
        queueMicrotask(() =>
          this.provider({ type: "input_audio_buffer.cleared" }),
        );
    }
    provider(event: Record<string, unknown>) {
      this.emit("message", Buffer.from(JSON.stringify(event)));
    }
    close() {
      this.emit("close");
    }
  },
}));

import WebSocket from "ws";
import {
  captureVoice,
  connectVoice,
  consumeVoiceEvidence,
  disconnectVoice,
} from "@/lib/voice/server";

const sessionId = "capture-ordering";
const callId = "rtc_capture_ordering";
const text = "Could you repeat what you said?";
function completed(itemId: string) {
  return {
    type: "conversation.item.input_audio_transcription.completed",
    item_id: itemId,
    transcript: text,
    logprobs: [{ token: "repeat", logprob: -0.01 }],
  };
}

describe("voice capture across HTTP and provider event ordering", () => {
  let socket: TestSocket;
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("v=0\r\n", {
            headers: {
              location: `https://api.openai.com/v1/realtime/calls/${callId}`,
            },
          }),
      ),
    );
    await connectVoice(sessionId, "v=0\r\n");
    socket = (WebSocket as unknown as { sockets: TestSocket[] }).sockets.at(
      -1,
    )!;
    await captureVoice(sessionId, callId, true);
  });
  afterEach(() => {
    disconnectVoice(sessionId, callId);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps an already spoken turn when browser completion beats the server sideband", async () => {
    // Browser already received the completed transcript and muted its track.
    // Its HTTP stop arrives before the same provider events on the sideband.
    socket.acknowledgeClear = false;
    const stopping = captureVoice(sessionId, callId, false);
    const result = consumeVoiceEvidence(
      sessionId,
      { callId, itemId: "delayed" },
      text,
    ).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(100);
    socket.provider({
      type: "input_audio_buffer.speech_started",
      item_id: "delayed",
    });
    socket.provider(completed("delayed"));
    socket.provider({ type: "input_audio_buffer.cleared" });
    await stopping;
    await vi.advanceTimersByTimeAsync(2200);
    expect(await result).toMatchObject({ transcript: text, final: true });
    await expect(
      consumeVoiceEvidence(sessionId, { callId, itemId: "delayed" }, text),
    ).rejects.toThrow("already used");
  });

  it("accepts a delayed final transcript after capture has closed", async () => {
    socket.provider({
      type: "input_audio_buffer.speech_started",
      item_id: "slow-final",
    });
    await captureVoice(sessionId, callId, false);
    const result = consumeVoiceEvidence(
      sessionId,
      { callId, itemId: "slow-final" },
      text,
    ).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(2500);
    socket.provider(completed("slow-final"));
    await vi.advanceTimersByTimeAsync(40);
    expect(await result).toMatchObject({ transcript: text, final: true });
  });

  it("rejects speech that starts after the provider has closed capture", async () => {
    await captureVoice(sessionId, callId, false);
    socket.provider({
      type: "input_audio_buffer.speech_started",
      item_id: "after-stop",
    });
    socket.provider(completed("after-stop"));
    const result = consumeVoiceEvidence(
      sessionId,
      { callId, itemId: "after-stop" },
      text,
    ).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(8100);
    expect(await result).toEqual(
      expect.objectContaining({
        message: expect.stringContaining("not verified"),
      }),
    );
  });

  it("does not open a fresh capture phase until buffered old audio has cleared", async () => {
    await captureVoice(sessionId, callId, false);
    socket.acknowledgeClear = false;
    let opened = false;
    const starting = captureVoice(sessionId, callId, true).then(() => {
      opened = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(opened).toBe(false);
    socket.provider({
      type: "input_audio_buffer.speech_started",
      item_id: "old-echo",
    });
    socket.provider({ type: "input_audio_buffer.cleared" });
    await starting;
    socket.provider(completed("old-echo"));
    socket.provider({
      type: "input_audio_buffer.speech_started",
      item_id: "fresh",
    });
    socket.provider(completed("fresh"));
    await expect(
      consumeVoiceEvidence(sessionId, { callId, itemId: "fresh" }, text),
    ).resolves.toMatchObject({ transcript: text });
    const old = consumeVoiceEvidence(
      sessionId,
      { callId, itemId: "old-echo" },
      text,
    ).catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(8100);
    expect(await old).toBeInstanceOf(Error);
  });

  it("serializes overlapping stop and start requests at separate acknowledgements", async () => {
    socket.acknowledgeClear = false;
    const before = socket.sent.length;
    const stopping = captureVoice(sessionId, callId, false);
    let opened = false;
    const starting = captureVoice(sessionId, callId, true).then(() => {
      opened = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.sent).toHaveLength(before + 1);
    socket.provider({ type: "input_audio_buffer.cleared" });
    await stopping;
    await vi.advanceTimersByTimeAsync(0);
    expect(socket.sent).toHaveLength(before + 2);
    expect(opened).toBe(false);
    socket.provider({ type: "input_audio_buffer.cleared" });
    await starting;
    expect(opened).toBe(true);
  });

  it("expires a missing capture acknowledgement and makes the call unavailable", async () => {
    socket.acknowledgeClear = false;
    const stopping = captureVoice(sessionId, callId, false).catch(
      (error: Error) => error,
    );
    await vi.advanceTimersByTimeAsync(5100);
    expect(await stopping).toEqual(
      expect.objectContaining({
        message: expect.stringContaining("could not synchronize"),
      }),
    );
    await expect(
      consumeVoiceEvidence(sessionId, { callId, itemId: "late" }, text),
    ).rejects.toThrow("expired");
  });

  it("rejects a pending capture transition as soon as the sideband closes", async () => {
    socket.acknowledgeClear = false;
    const stopping = captureVoice(sessionId, callId, false).catch(
      (error: Error) => error,
    );
    await vi.advanceTimersByTimeAsync(0);
    socket.emit("close");
    expect(await stopping).toBeInstanceOf(Error);
  });

  it("does not reopen capture when an earlier queued transition fails", async () => {
    socket.acknowledgeClear = false;
    const before = socket.sent.length;
    const stopping = captureVoice(sessionId, callId, false).catch(
      (error: Error) => error,
    );
    const starting = captureVoice(sessionId, callId, true).catch(
      (error: Error) => error,
    );
    await vi.advanceTimersByTimeAsync(5100);
    expect(await stopping).toBeInstanceOf(Error);
    expect(await starting).toBeInstanceOf(Error);
    expect(socket.sent).toHaveLength(before + 1);
  });
});
