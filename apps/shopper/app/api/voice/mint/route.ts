import { NextResponse } from "next/server";
import { voiceBody } from "@/lib/voice/server";

export const runtime = "nodejs";

/** Availability only: opening the page never creates a paid provider session. */
export async function POST(request: Request) {
  try {
    await voiceBody(request, 4096);
    const available = Boolean(process.env.OPENAI_API_KEY);
    return NextResponse.json({
      mode: available ? "available" : "not_connected",
      duplex: false,
      note: available
        ? "OpenAI voice is available. Microphone capture pauses during spoken replies."
        : "OpenAI voice is not configured. Browser speech and text mode remain available.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Unable to mint voice session.",
        mode: "not_connected",
        duplex: false,
      },
      { status: 403 },
    );
  }
}
