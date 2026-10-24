import { NextResponse } from "next/server";
import { voiceBody } from "@/lib/voice/server";
import { controlGptLive } from "@/lib/voice/gpt-live-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const b = await voiceBody(request);
    return NextResponse.json(
      await controlGptLive(b.sessionId, b.callId, b.action),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Live control failed.",
      },
      { status: 400 },
    );
  }
}
