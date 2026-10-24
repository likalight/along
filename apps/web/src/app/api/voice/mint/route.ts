import { NextResponse } from "next/server";
import { assertSessionAccess } from "@/server/session-access";
export async function POST(req: Request) {
  try {
    const b = await req.json();
    assertSessionAccess(req, b.sessionId);
    return NextResponse.json({
      mode: "not_connected",
      note: "Live voice transport is not implemented in this integration branch. Text mode is available.",
    });
  } catch {
    return NextResponse.json(
      { error: "unauthorized_session" },
      { status: 403 },
    );
  }
}
