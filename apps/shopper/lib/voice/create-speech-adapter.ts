import type { SpeechAdapter } from "./adapter";
import { BrowserSpeechAdapter } from "./browser-adapter";
import { LiveSpeechAdapter } from "./live-adapter";

export type SpeechAdapterKind = "live" | "browser";

/**
 * Prefer GPT-Live when mint returns a real client secret; otherwise the labeled
 * browser Speech fallback. Never claims duplex without a successful mint.
 */
export async function createSpeechAdapter(
  sessionId?: string,
): Promise<{ adapter: SpeechAdapter; kind: SpeechAdapterKind; note?: string }> {
  if (!sessionId) {
    return { adapter: new BrowserSpeechAdapter(), kind: "browser" };
  }
  try {
    const res = await fetch("/api/voice/mint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json();
    if (res.ok && data.mode === "live" && data.clientSecret) {
      return {
        adapter: new LiveSpeechAdapter({
          clientSecret: data.clientSecret,
          model: data.model,
        }),
        kind: "live",
      };
    }
    return {
      adapter: new BrowserSpeechAdapter(),
      kind: "browser",
      note:
        typeof data.note === "string"
          ? data.note
          : "Live voice is not connected; using browser speech fallback.",
    };
  } catch {
    return {
      adapter: new BrowserSpeechAdapter(),
      kind: "browser",
      note: "Live voice mint unreachable; using browser speech fallback.",
    };
  }
}
