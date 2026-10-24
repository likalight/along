import { NextResponse } from "next/server";
import { disconnectVoice, voiceBody } from "@/lib/voice/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await voiceBody(request);
    disconnectVoice(body.sessionId, body.callId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to disconnect voice." }, { status: 400 });
  }
}
