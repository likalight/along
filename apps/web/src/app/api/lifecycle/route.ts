import { NextResponse } from "next/server";
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

  const { orch } = getRuntime();
  const snapshot = await orch.handleLifecycle(body);
  if (!snapshot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ snapshot });
}
