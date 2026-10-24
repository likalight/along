import { NextResponse } from "next/server";
import {
  accept,
  cancel,
  connect,
  Conflict,
  lifecycle,
  setMode,
} from "@/lib/session/store";
import type { Identity, Input, Lifecycle } from "@/lib/session/contract";
export const runtime = "nodejs";
// This bounded, unauthenticated fixture API is for local rehearsal, not deployment.
export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !==
        `${new URL(request.headers.get("origin")!).protocol}//${request.headers.get("host")}`
    )
      return NextResponse.json(
        { error: "Cross-origin requests are unavailable." },
        { status: 403 },
      );
    if (Number(request.headers.get("content-length") ?? 0) > 32_768)
      return NextResponse.json({ error: "Turn too large." }, { status: 413 });
    const body = await request.json();
    if (body.action === "connect")
      return NextResponse.json(connect(body.sessionId));
    const i = body.input as Identity;
    if (
      !i ||
      typeof i.sessionId !== "string" ||
      !Number.isInteger(i.epoch) ||
      typeof i.turnId !== "string"
    )
      throw new Error("Invalid turn identity.");
    if (body.action === "cancel") return NextResponse.json(cancel(i));
    if (
      body.action === "mode" &&
      (body.mode === "text" || body.mode === "voice")
    )
      return NextResponse.json(setMode(i, body.mode));
    if (body.action === "lifecycle") {
      if (
        ![
          "audio.started",
          "audio.completed",
          "audio.interrupted",
          "turn.cancelled",
        ].includes(body.input.type) ||
        typeof body.input.playbackId !== "string" ||
        !Number.isInteger(i.revision)
      )
        throw new Error("Invalid lifecycle event.");
      return NextResponse.json(lifecycle(body.input as Lifecycle));
    }
    if (body.action === "input") {
      const input = body.input as Input;
      if (
        !["voice", "text", "image", "link"].includes(input.modality) ||
        typeof input.eventId !== "string" ||
        !Number.isInteger(input.baseRevision) ||
        !Number.isInteger(input.visibleRevision) ||
        !Array.isArray(input.visibleProductIds) ||
        (typeof input.text !== "undefined" &&
          (typeof input.text !== "string" || input.text.length > 4000)) ||
        (!input.text?.trim() && !input.attachmentId)
      )
        throw new Error("Invalid session input.");
      return NextResponse.json(accept(input));
    }
    throw new Error("Unsupported session action.");
  } catch (error) {
    if (error instanceof Conflict)
      return NextResponse.json(
        { error: error.message, snapshot: error.snapshot },
        { status: 409 },
      );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update the session.",
      },
      { status: 400 },
    );
  }
}
