import { NextResponse } from "next/server";
import { authorize } from "@/lib/integration/access";
import { gptLiveState } from "@/lib/voice/gpt-live-server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const id = p.get("sessionId") ?? "";
    authorize(request, id);
    return NextResponse.json(gptLiveState(id, p.get("callId")), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Live voice unavailable.",
      },
      { status: 403 },
    );
  }
}
