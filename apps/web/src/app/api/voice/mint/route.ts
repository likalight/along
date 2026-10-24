import { NextResponse } from "next/server";
import { VOICE_ADAPTER } from "@coupang/contract";
import { getRuntime } from "@/server/runtime";

/**
 * Mint a GPT-Live duplex session (client delegation).
 * Without OPENAI_API_KEY, returns adapter metadata + substitute mode for AFK work.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
  const { voice } = getRuntime();
  const sessionId = body.sessionId ?? "unbound";
  const connected = await voice.connect(sessionId);

  return NextResponse.json({
    adapter: VOICE_ADAPTER,
    connected,
    mode: process.env.OPENAI_API_KEY ? "live" : "fixture_substitute",
    note:
      "Full duplex WebRTC SDP exchange attaches here when credentials are present. Typed turns still request spoken replies.",
    pending: voice.pending.slice(-10),
  });
}
