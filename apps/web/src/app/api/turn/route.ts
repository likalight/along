import { NextResponse } from "next/server";
import { assertSessionAccess, sessionPayload } from "@/server/session-access";
import { getRuntime } from "@/server/runtime";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    sessionId: string;
    epoch: number;
    text?: string;
    modality?: "voice" | "text" | "image" | "link";
    attachmentId?: string;
    visibleProductIds?: string[];
    visibleRevision: number;
  };

  if (!body.sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    assertSessionAccess(req, body.sessionId);
  } catch {
    return NextResponse.json(
      { error: "unauthorized_session" },
      { status: 403 },
    );
  }
  const { orch, store } = getRuntime();
  const current = orch.getSnapshot(body.sessionId);
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const turnId = `turn-${crypto.randomUUID().slice(0, 8)}`;
  const eventId = `input-${crypto.randomUUID().slice(0, 8)}`;

  try {
    const input = {
      sessionId: body.sessionId,
      epoch: body.epoch ?? current.epoch,
      eventId,
      turnId,
      baseRevision: body.visibleRevision,
      modality: body.modality ?? "text",
      text: body.text,
      attachmentId: body.attachmentId,
      visibleRevision: body.visibleRevision,
      visibleProductIds: body.visibleProductIds ?? current.displayOrder,
    };
    if (
      input.modality === "text" &&
      /^confirm this simulated purchase[.!]?$/i.test(input.text?.trim() ?? "")
    ) {
      store.ingestInput(input);
      store.confirmText(input);
      return NextResponse.json({
        ...sessionPayload(body.sessionId),
        route: "trusted_confirmation",
        speakable: [
          {
            content: "Simulated purchase confirmed. No payment or real order.",
            channel: "commentary",
            revision: store.get(body.sessionId)!.revision,
          },
        ],
      });
    }
    const outcome = await orch.handleInput(input);
    return NextResponse.json({
      ...sessionPayload(body.sessionId),
      turnId,
      eventId,
      route: outcome.route,
      cancelled: outcome.cancelled,
      snapshot: outcome.snapshot,
      speakable: outcome.speakable,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "turn_failed";
    return NextResponse.json(
      { error: message, ...sessionPayload(body.sessionId) },
      { status: 409 },
    );
  }
}
