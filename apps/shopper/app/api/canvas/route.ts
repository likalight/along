import { NextResponse } from "next/server";
import {
  applyDemo,
  createDemo,
  type DemoInput,
} from "@/lib/canvas/demo-engine";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 12000)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return NextResponse.json(
      { error: "Expected an input object" },
      { status: 400 },
    );
  if (body.action === "create") {
    if (!["audio", "bags", "bedsheets"].includes(String(body.category)))
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    return NextResponse.json({
      snapshot: createDemo(body.category as "audio" | "bags" | "bedsheets"),
    });
  }
  if (
    typeof body.sessionId !== "string" ||
    typeof body.eventId !== "string" ||
    typeof body.turnId !== "string" ||
    typeof body.text !== "string" ||
    body.text.length > 2000 ||
    !["voice", "text"].includes(String(body.modality)) ||
    !Array.isArray(body.visibleProductIds) ||
    !body.visibleProductIds.every((id) => typeof id === "string") ||
    !["baseRevision", "epoch", "visibleRevision"].every((k) =>
      Number.isSafeInteger(body[k]),
    )
  )
    return NextResponse.json(
      { error: "Malformed shopper input" },
      { status: 400 },
    );
  const result = applyDemo(body as DemoInput);
  return NextResponse.json(result, { status: result.status });
}
