import { NextResponse } from "next/server";
import { captureVoice, voiceBody } from "@/lib/voice/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await voiceBody(request);
    await captureVoice(body.sessionId, body.callId, body.enabled);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to change voice capture.",
      },
      { status: 400 },
    );
  }
}
