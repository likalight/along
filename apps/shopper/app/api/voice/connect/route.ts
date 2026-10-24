import { NextResponse } from "next/server";
import { connectVoice, voiceBody } from "@/lib/voice/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await voiceBody(request, 72_000);
    return NextResponse.json(await connectVoice(body.sessionId, body.sdp), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to connect voice." }, { status: 400 });
  }
}
