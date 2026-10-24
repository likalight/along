import { NextResponse } from "next/server";
import { sessionPayload, assertSessionAccess } from "@/server/session-access";
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
  const response = NextResponse.json({
    ...sessionPayload(snapshot.sessionId),
    voiceAdapter: {
      id: voice.id,
      duplex: voice.duplex,
      pendingEvents: 0,
    },
  });
  response.cookies.set(
    `along-session-${snapshot.sessionId}`,
    getRuntime().store.accessToken(snapshot.sessionId)!,
    {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(req.url).protocol === "https:",
      path: "/",
      maxAge: 7200,
    },
  );
  return response;
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  try {
    assertSessionAccess(req, sessionId);
  } catch {
    return NextResponse.json(
      { error: "unauthorized_session" },
      { status: 403 },
    );
  }
  const { orch } = getRuntime();
  const snapshot = orch.getSnapshot(sessionId);
  if (!snapshot) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(sessionPayload(sessionId));
}
