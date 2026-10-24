import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    sessionId: string;
    epoch: number;
    text?: string;
    modality?: "voice" | "text" | "image" | "link";
    attachmentId?: string;
    visibleProductIds?: string[];
  };

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const { orch } = getRuntime();
  const current = orch.getSnapshot(body.sessionId);
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const turnId = `turn-${crypto.randomUUID().slice(0, 8)}`;
  const eventId = `input-${crypto.randomUUID().slice(0, 8)}`;

  try {
    const outcome = await orch.handleInput({
      sessionId: body.sessionId,
      epoch: body.epoch ?? current.epoch,
      eventId,
      turnId,
      baseRevision: current.revision,
      modality: body.modality ?? "text",
      text: body.text,
      attachmentId: body.attachmentId,
      visibleRevision: current.revision,
      visibleProductIds: body.visibleProductIds ?? current.displayOrder,
    });

    return NextResponse.json({
      turnId,
      eventId,
      route: outcome.route,
      cancelled: outcome.cancelled,
      snapshot: outcome.snapshot,
      speakable: outcome.speakable,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "turn_failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
