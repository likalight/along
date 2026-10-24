import WebSocket from "ws";
import { authorize, assertOrigin } from "@/lib/integration/access";
import { getRuntime } from "@/lib/integration/runtime";
import { project } from "@/lib/integration/projection";

const API = "https://api.openai.com/v1";
const EVIDENCE_TTL_MS = 30_000;
// Open-ended shopping requests can be longer than the replay window.
const MAX_UTTERANCE_MS = 120_000;
const CALL_TTL_MS = 15 * 60_000;
const MAX_CALLS = 32;
const CAPTURE_SYNC_TIMEOUT_MS = 5000;
const EVIDENCE_WAIT_MS = 8000;

type LogProbability = { token: string; logprob: number };
type ProviderEvent = {
  type?: string;
  item_id?: string;
  transcript?: string;
  logprobs?: LogProbability[] | null;
};
export type TrustedVoiceEvidence = {
  transcript: string;
  final: true;
  confidence: number;
  source: "shopper";
  echoDetected: false;
};

/** Conservative ASR token-quality score, not calibrated utterance correctness. */
export function transcriptionQuality(logprobs: unknown): number | null {
  if (!Array.isArray(logprobs) || !logprobs.length) return null;
  const lexical: number[] = [];
  for (const entry of logprobs) {
    if (
      !entry ||
      typeof entry.token !== "string" ||
      typeof entry.logprob !== "number" ||
      !Number.isFinite(entry.logprob) ||
      entry.logprob > 0
    )
      return null;
    if (/[\p{L}\p{N}]/u.test(entry.token))
      lexical.push(Math.exp(entry.logprob));
  }
  return lexical.length ? Math.min(...lexical) : null;
}

/** Only server-observed provider events can produce one-use shopper evidence. */
export class VoiceEvidenceWindow {
  private generation = 0;
  private enabled = false;
  private starts = new Map<string, { generation: number; at: number }>();
  private completed = new Map<
    string,
    { transcript: string; quality: number | null; at: number }
  >();
  private consumed = new Set<string>();

  capture(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.invalidate();
    // A final event may reach the browser before the sideband. Disabling capture
    // preserves already-started speech so that a subsequent input can consume it.
  }

  invalidate() {
    this.generation++;
    this.starts.clear();
    this.completed.clear();
  }

  speaking() {
    this.enabled = false;
    this.invalidate();
  }

  receive(event: ProviderEvent, now = Date.now()) {
    const item = event.item_id;
    if (!item || item.length > 256 || this.consumed.has(item)) return;
    if (event.type === "input_audio_buffer.speech_started" && this.enabled) {
      if (this.starts.size >= 64)
        this.starts.delete(this.starts.keys().next().value!);
      this.starts.set(item, { generation: this.generation, at: now });
      return;
    }
    if (event.type !== "conversation.item.input_audio_transcription.completed")
      return;
    const start = this.starts.get(item);
    this.starts.delete(item);
    if (
      !start ||
      start.generation !== this.generation ||
      now - start.at > MAX_UTTERANCE_MS ||
      typeof event.transcript !== "string" ||
      event.transcript.length > 4000
    )
      return;
    this.completed.set(item, {
      transcript: event.transcript.trim(),
      quality: transcriptionQuality(event.logprobs),
      at: now,
    });
  }

  consume(
    item: string,
    text: string,
    now = Date.now(),
  ): TrustedVoiceEvidence | undefined {
    if (this.consumed.has(item))
      throw new Error("That spoken turn was already used. Please speak again.");
    const evidence = this.completed.get(item);
    if (!evidence) return undefined;
    if (now - evidence.at > EVIDENCE_TTL_MS) {
      this.completed.delete(item);
      throw new Error("That spoken turn expired. Please speak again.");
    }
    if (evidence.transcript !== text.trim())
      throw new Error("Spoken text does not match the provider transcript.");
    this.completed.delete(item);
    this.consumed.add(item);
    if (this.consumed.size > 256)
      this.consumed.delete(this.consumed.values().next().value!);
    return {
      transcript: evidence.transcript,
      final: true,
      // A missing score must fail the existing >=0.9 purchase gate; never invent
      // high confidence merely because a provider marked its transcript complete.
      confidence: evidence.quality ?? 0,
      source: "shopper",
      echoDetected: false,
    };
  }
}

type Call = {
  sessionId: string;
  callId: string;
  socket: WebSocket;
  evidence: VoiceEvidenceWindow;
  touchedAt: number;
  unavailable: boolean;
  captureQueue: Promise<void>;
  pendingCapture?: { complete: () => void; fail: () => void };
};
const globals = globalThis as unknown as {
  __alongVoiceCalls?: Map<string, Call>;
};
const calls = (globals.__alongVoiceCalls ??= new Map<string, Call>());

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key)
    throw new Error(
      "OpenAI voice is not configured. Text mode remains available.",
    );
  return key;
}

async function hangup(callId: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return;
  await fetch(`${API}/realtime/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

function release(call: Call) {
  if (calls.get(call.sessionId) === call) calls.delete(call.sessionId);
  call.unavailable = true;
  call.evidence.speaking();
  call.pendingCapture?.fail();
  call.socket.close();
  void hangup(call.callId);
}

function currentCall(sessionId: string, callId: string): Call {
  const call = calls.get(sessionId);
  if (
    !call ||
    call.callId !== callId ||
    call.unavailable ||
    Date.now() - call.touchedAt > CALL_TTL_MS
  ) {
    if (call && Date.now() - call.touchedAt > CALL_TTL_MS) release(call);
    throw new Error("Voice connection expired. Start voice again.");
  }
  call.touchedAt = Date.now();
  return call;
}

export async function voiceBody(
  request: Request,
  maxBytes = 8192,
): Promise<Record<string, unknown> & { sessionId: string }> {
  assertOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new Error("JSON body required.");
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    throw new Error("Voice request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Voice request is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Voice request is too large.");
    }
    chunks.push(value);
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Invalid voice request.");
  }
  if (!body || Array.isArray(body) || typeof body.sessionId !== "string")
    throw new Error("Session required.");
  authorize(request, body.sessionId);
  return body as Record<string, unknown> & { sessionId: string };
}

export async function connectVoice(sessionId: string, sdp: unknown) {
  if (typeof sdp !== "string" || sdp.length > 64_000 || !sdp.startsWith("v=0"))
    throw new Error("A valid SDP offer is required.");
  const key = apiKey();
  for (const call of calls.values())
    if (Date.now() - call.touchedAt > CALL_TTL_MS) release(call);
  const old = calls.get(sessionId);
  if (old) release(old);
  if (calls.size >= MAX_CALLS)
    throw new Error("The local voice demo is busy. Try again shortly.");
  const form = new FormData();
  form.set("sdp", sdp);
  form.set(
    "session",
    JSON.stringify({
      type: "realtime",
      model: "gpt-realtime-2.1",
      output_modalities: ["text"],
      include: ["item.input_audio_transcription.logprobs"],
      audio: {
        input: {
          transcription: { model: "gpt-4o-transcribe", language: "en" },
          noise_reduction: { type: "near_field" },
          turn_detection: {
            type: "server_vad",
            create_response: false,
            interrupt_response: false,
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
          },
        },
      },
      tools: [],
      max_output_tokens: 1,
    }),
  );
  let response: Response;
  try {
    response = await fetch(`${API}/realtime/calls`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(
      "The voice provider could not be reached. Retry or use text mode.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Voice connection failed (${response.status}). Retry or use text mode.`,
    );
  const answer = await response.text();
  const location = response.headers.get("location");
  const callId = location?.split("/").pop();
  if (
    !callId ||
    !/^rtc_[A-Za-z0-9_-]+$/.test(callId) ||
    !answer.startsWith("v=0")
  )
    throw new Error("The voice provider returned an invalid connection.");
  const socket = new WebSocket(
    `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`,
    {
      headers: { Authorization: `Bearer ${key}` },
      handshakeTimeout: 10_000,
      maxPayload: 1_048_576,
    },
  );
  const call: Call = {
    sessionId,
    callId,
    socket,
    evidence: new VoiceEvidenceWindow(),
    touchedAt: Date.now(),
    unavailable: false,
    captureQueue: Promise.resolve(),
  };
  socket.on("message", (raw) => {
    try {
      const event = JSON.parse(raw.toString()) as ProviderEvent;
      call.evidence.receive(event);
      if (event.type === "input_audio_buffer.cleared")
        call.pendingCapture?.complete();
    } catch {
      /* Ignore malformed provider data; it can never authorize input. */
    }
  });
  socket.on("close", () => {
    call.unavailable = true;
    call.evidence.speaking();
    call.pendingCapture?.fail();
  });
  socket.on("error", () => {
    call.unavailable = true;
    call.evidence.speaking();
    call.pendingCapture?.fail();
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Voice verification connection timed out.")),
        10_000,
      );
      socket.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once("error", () => {
        clearTimeout(timer);
        reject(new Error("Voice verification connection failed."));
      });
      socket.once("close", () => {
        clearTimeout(timer);
        reject(new Error("Voice verification connection closed."));
      });
    });
  } catch (error) {
    socket.close();
    void hangup(callId);
    throw error;
  }
  calls.set(sessionId, call);
  const expiry = setTimeout(() => {
    if (calls.get(sessionId) === call) release(call);
  }, CALL_TTL_MS);
  expiry.unref();
  return { sdp: answer, callId };
}

export async function captureVoice(
  sessionId: string,
  callId: unknown,
  enabled: unknown,
) {
  if (typeof callId !== "string" || typeof enabled !== "boolean")
    throw new Error("Voice capture identity required.");
  const call = currentCall(sessionId, callId);
  // HTTP and the browser's WebRTC channel can outrun the trusted sideband.
  // Change phases only at a provider acknowledgement on that same sideband:
  // delayed speech-start events before a stop remain in the listening phase;
  // old buffered audio before a start remains outside the new phase.
  // The server is the sole sender of clear events so acknowledgements cannot
  // be mistaken for a concurrent browser clear. Serialize transitions per call.
  call.captureQueue = call.captureQueue.then(() => {
    currentCall(sessionId, callId);
    return new Promise<void>((resolve, reject) => {
      const finish = (failed: boolean) => {
        clearTimeout(timer);
        call.pendingCapture = undefined;
        if (failed) {
          release(call);
          reject(
            new Error(
              "Voice capture could not synchronize. Start voice again.",
            ),
          );
        } else {
          call.evidence.capture(enabled);
          resolve();
        }
      };
      const timer = setTimeout(() => finish(true), CAPTURE_SYNC_TIMEOUT_MS);
      call.pendingCapture = {
        complete: () => finish(false),
        fail: () => finish(true),
      };
      try {
        call.socket.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      } catch {
        finish(true);
      }
    });
  });
  await call.captureQueue;
}

export function disconnectVoice(sessionId: string, callId: unknown) {
  if (typeof callId !== "string")
    throw new Error("Voice connection identity required.");
  const call = calls.get(sessionId);
  if (call?.callId === callId) release(call);
}

export async function consumeVoiceEvidence(
  sessionId: string,
  value: unknown,
  text: string,
): Promise<TrustedVoiceEvidence> {
  const evidence = value as { callId?: unknown; itemId?: unknown } | null;
  if (
    !evidence ||
    typeof evidence.callId !== "string" ||
    typeof evidence.itemId !== "string" ||
    evidence.itemId.length > 256
  )
    throw new Error(
      "Verified spoken input is required. Start voice again or choose text mode.",
    );
  const call = currentCall(sessionId, evidence.callId);
  const deadline = Date.now() + EVIDENCE_WAIT_MS;
  do {
    if (call.unavailable)
      throw new Error("Voice verification connection was lost.");
    const verified = call.evidence.consume(evidence.itemId, text);
    if (verified) return verified;
    await new Promise((resolve) => setTimeout(resolve, 40));
  } while (Date.now() < deadline);
  throw new Error(
    "The provider has not verified that spoken turn. Please speak again.",
  );
}

export async function renderSpeech(
  sessionId: string,
  body: Record<string, unknown>,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const voice = body.voice ?? "marin";
  if (typeof voice !== "string" || !["marin", "cedar", "coral"].includes(voice))
    throw new Error("Choose Marin, Cedar, or Coral for the voice.");
  const { store } = getRuntime();
  const core = store.core.get(sessionId);
  const snapshot = project(sessionId);
  let text = snapshot.message;
  if (body.summaryId !== undefined && !core.receipt) {
    if (
      !core.summary ||
      body.summaryId !== core.summary.id ||
      (body.textHash !== undefined && body.textHash !== core.summary.textHash)
    )
      throw new Error("The purchase summary changed. Review it again.");
    text = core.summary.spokenText;
  }
  if (body.segmentIndex !== undefined) {
    const segments = snapshot.narrationSegments;
    if (
      body.summaryId !== undefined ||
      core.summary?.spokenText === snapshot.message ||
      !Number.isInteger(body.segmentIndex) ||
      !segments ||
      body.turnId !== core.turn?.id ||
      body.revision !== core.revision ||
      segments.map((segment) => segment.text).join(" ") !== snapshot.message
    )
      throw new Error("Narration segment is no longer current.");
    const segment = segments[body.segmentIndex as number];
    if (!segment) throw new Error("Unknown narration segment.");
    text = segment.text;
  }
  if (
    typeof body.text !== "string" ||
    body.text !== text ||
    !text ||
    text.length > 12_000
  )
    throw new Error(
      "Narration must match the current accepted shopping response.",
    );
  const call = calls.get(sessionId);
  if (call) {
    call.evidence.speaking();
    call.touchedAt = Date.now();
  }
  let response: Response;
  try {
    response = await fetch(`${API}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice,
        input: text,
        response_format: "mp3",
        instructions:
          "Talk to one person in a relaxed, friendly conversation. Use easy pacing, flowing sentences, varied intonation, and light emphasis on the useful detail. Avoid an announcer voice, exaggerated pauses, or a formal reading cadence. Say the supplied words exactly, including all prices, conditions, and uncertainties. Do not add an introduction or any extra words.",
      }),
      signal: AbortSignal.any([
        AbortSignal.timeout(30_000),
        ...(signal ? [signal] : []),
      ]),
    });
  } catch {
    throw new Error(
      "Narration could not be generated. Retry or choose text mode.",
    );
  }
  if (!response.ok)
    throw new Error(
      `Narration failed (${response.status}). Retry or choose text mode.`,
    );
  return new Uint8Array(await response.arrayBuffer());
}
