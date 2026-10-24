import { NextResponse } from "next/server";
import { authorize, assertOrigin } from "@/lib/integration/access";
import { getRuntime } from "@/lib/integration/runtime";

export const runtime = "nodejs";

/**
 * Mint a GPT-Live client-delegated WebRTC session for the shopper shell.
 * Returns mode:"live" only when a real client secret is obtained; otherwise
 * authenticated mode:"not_connected" (never a silent fake duplex claim).
 */
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("Turn too large.");
    const body = JSON.parse(raw) as { sessionId?: string };
    if (!body.sessionId) throw new Error("sessionId required");
    authorize(request, body.sessionId);
    const { voice } = getRuntime();
    const minted = await voice.mint(body.sessionId);
    return NextResponse.json(minted);
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
