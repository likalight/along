import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    scenarioId?: "cafe_dictation" | "bag_inspiration" | "warm_bedding" | null;
    preparedAttachmentId?: string;
  };
  const { orch, voice } = getRuntime();
  const snapshot = orch.createSession({
    scenarioId: body.scenarioId ?? null,
    preparedAttachmentId: body.preparedAttachmentId,
  });
  return NextResponse.json({
    snapshot,
    voiceAdapter: {
      id: voice.id,
      duplex: voice.duplex,
      pendingEvents: voice.pending.length,
    },
  });
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  const { orch } = getRuntime();
  const snapshot = orch.getSnapshot(sessionId);
  if (!snapshot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ snapshot });
}
