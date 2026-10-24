import { NextResponse } from "next/server";
import { assertSessionAccess } from "@/server/session-access";
import { getRuntime } from "@/server/runtime";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    sessionId: string;
    epoch: number;
    turnId: string;
    revision: number;
    type:
      | "audio.started"
      | "audio.completed"
      | "audio.interrupted"
      | "turn.cancelled"
      | "video.started"
      | "video.stopped";
    playbackId?: string;
    summaryId?: string;
  };

  try {
    assertSessionAccess(req, body.sessionId);
  } catch {
    return NextResponse.json(
      { error: "unauthorized_session" },
      { status: 403 },
    );
  }
  const { orch } = getRuntime();
  const current = orch.getSnapshot(body.sessionId);
  if (
    !current ||
    body.epoch !== current.epoch ||
    body.revision !== current.revision
  )
    return NextResponse.json({ error: "stale_lifecycle" }, { status: 409 });
  if (body.type !== "turn.cancelled" && body.type !== "audio.interrupted")
    return NextResponse.json(
      {
        error:
          "Live audio/video transport is not connected; use exact presentation callbacks when implemented.",
      },
      { status: 409 },
    );
  const snapshot = await orch.handleLifecycle(body);
  if (!snapshot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ snapshot });
}
