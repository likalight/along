import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";
import { assertSessionAccess, sessionPayload } from "@/server/session-access";
export async function POST(req: Request) {
  try {
    const b = await req.json();
    assertSessionAccess(req, b.sessionId);
    getRuntime().store.acknowledge(b.sessionId, {
      summaryId: b.summaryId,
      turnId: b.turnId,
      textHash: b.textHash,
      event: b.event,
    });
    return NextResponse.json(sessionPayload(b.sessionId));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "presentation_failed" },
      { status: 409 },
    );
  }
}
