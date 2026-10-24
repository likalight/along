import { NextResponse } from "next/server";
import { renderSpeech, voiceBody } from "@/lib/voice/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await voiceBody(request, 20_000);
    const audio = await renderSpeech(body.sessionId, body, request.signal);
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate narration." }, { status: 400 });
  }
}
