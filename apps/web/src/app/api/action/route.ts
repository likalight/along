import { NextResponse } from "next/server";
import { getRuntime } from "@/server/runtime";
import { assertSessionAccess, sessionPayload } from "@/server/session-access";
/** Deliberate UI actions share the same accepted-state boundary as model proposals. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    assertSessionAccess(req, b.sessionId);
    if (
      ![
        "select_offer",
        "prepare_summary",
        "save",
        "restore",
        "focus",
        "compare",
        "cancel",
      ].includes(b.action)
    )
      throw new Error("unsupported_ui_action");
    const { store } = getRuntime();
    const id = crypto.randomUUID();
    store.ingestInput({
      sessionId: b.sessionId,
      epoch: b.epoch,
      eventId: `input-${id}`,
      turnId: `turn-${id}`,
      baseRevision: b.visibleRevision,
      visibleRevision: b.visibleRevision,
      visibleProductIds: b.visibleProductIds,
      modality: "text",
      text: `UI ${b.action}`,
    });
    const result = store.apply({
      sessionId: b.sessionId,
      epoch: b.epoch,
      eventId: `action-${id}`,
      turnId: `turn-${id}`,
      baseRevision: store.get(b.sessionId)!.revision,
      action: b.action,
      payload: b.payload ?? {},
      evidenceIds: [],
    });
    return NextResponse.json(
      {
        ...sessionPayload(b.sessionId),
        speakable: [result.speakable],
        ...(result.ok ? {} : { error: result.reason }),
      },
      { status: result.ok ? 200 : 422 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "action_failed" },
      { status: 409 },
    );
  }
}
