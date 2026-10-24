import { NextResponse } from "next/server";
import { voiceBody } from "@/lib/voice/server";
import { connectGptLive } from "@/lib/voice/gpt-live-server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    return NextResponse.json(
      await connectGptLive(request, await voiceBody(request, 72000)),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start live voice.",
      },
      { status: 400 },
    );
  }
}
