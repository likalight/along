import { NextResponse } from "next/server";
import { assertSessionAccess } from "@/server/session-access";
import { getRuntime } from "@/server/runtime";

/** Diagnostic harness mint — same honesty rules as the shopper mint. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    assertSessionAccess(req, b.sessionId);
    const { voice } = getRuntime();
    const minted = await voice.mint(b.sessionId);
    return NextResponse.json(minted);
  } catch {
    return NextResponse.json(
      { error: "unauthorized_session" },
      { status: 403 },
    );
  }
}
