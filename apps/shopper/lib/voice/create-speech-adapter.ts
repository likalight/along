import type { SpeechAdapter } from "./adapter";
import { BrowserSpeechAdapter } from "./browser-adapter";
import { GptLiveAdapter } from "./gpt-live-adapter";

export type SpeechAdapterKind = "live" | "browser";

/** Check server configuration only. Microphone/provider sessions start on a user action. */
export async function createSpeechAdapter(
  sessionId?: string,
): Promise<{ adapter: SpeechAdapter; kind: SpeechAdapterKind; note?: string }> {
  if (!sessionId)
    return { adapter: new BrowserSpeechAdapter(), kind: "browser" };
  try {
    const response = await fetch("/api/voice/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await response.json();
    if (response.ok && data.mode === "available") {
      return { adapter: new GptLiveAdapter({ sessionId }), kind: "live" };
    }
    return {
      adapter: new BrowserSpeechAdapter(),
      kind: "browser",
      note:
        typeof data.note === "string"
          ? data.note
          : "OpenAI voice is not configured; browser speech remains available.",
    };
  } catch {
    return {
      adapter: new BrowserSpeechAdapter(),
      kind: "browser",
      note: "Could not check OpenAI voice configuration. Browser speech and text remain available.",
    };
  }
}
