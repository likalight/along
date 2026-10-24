import { NextResponse } from "next/server";
import { addAsset, removeAsset } from "@/lib/session/store";
import { preparedImage, supportedLinks } from "@/lib/session/fixtures";
import { MAX_IMAGE_BYTES } from "@/lib/attachments/limits";
import {
  AttachmentError,
  readBoundedBody,
  validateImage,
} from "@/lib/attachments/validation";
export const runtime = "nodejs";
const response = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const target = new URL(request.url);
  const authority = request.headers.get("host");
  let expectedOrigin = target.origin;
  if (authority && authority !== target.host) {
    // Next dev normalizes Request.url to localhost even when the browser used
    // 127.0.0.1. Trust the browser-facing Host only for same-port loopback aliases.
    const external = new URL(`${target.protocol}//${authority}`);
    const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
    if (
      !loopback.has(target.hostname) ||
      !loopback.has(external.hostname) ||
      external.port !== target.port ||
      external.host !== authority
    )
      throw new AttachmentError("Cross-origin requests are unavailable.", 403);
    expectedOrigin = external.origin;
  }
  if (origin !== expectedOrigin)
    throw new AttachmentError("Cross-origin requests are unavailable.", 403);
}
function sessionIdentity(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(value))
    throw new AttachmentError("Start a session before adding a reference.");
}
function failure(error: unknown) {
  return response(
    {
      error:
        error instanceof Error ? error.message : "Upload failed. Try again.",
    },
    error instanceof AttachmentError ? error.status : 400,
  );
}
export async function POST(request: Request) {
  try {
    originAllowed(request);
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.split(";")[0] === "application/json") {
      const body = JSON.parse(
        new TextDecoder().decode(await readBoundedBody(request, 8192)),
      );
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        !["prepared", "link"].includes(body.kind)
      )
        throw new AttachmentError(
          "Choose a prepared image or a supported link.",
        );
      const { sessionId, kind, url } = body;
      sessionIdentity(sessionId);
      if (kind === "prepared")
        return response(addAsset(sessionId, preparedImage));
      const asset =
        typeof url === "string" && Object.hasOwn(supportedLinks, url)
          ? supportedLinks[url as keyof typeof supportedLinks]
          : undefined;
      if (!asset)
        return response(
          {
            error:
              "Unavailable in this demo. Use https://demo.example/bags/navy or a photo.",
          },
          422,
        );
      return response(addAsset(sessionId, asset));
    }
    if (
      Number(request.headers.get("content-length") ?? 0) >
      MAX_IMAGE_BYTES + 8192
    )
      throw new AttachmentError("Choose an image of 5 MB or less.", 413);
    if (!contentType.startsWith("multipart/form-data;"))
      throw new AttachmentError(
        "Use a photo upload or a JSON reference request.",
        415,
      );
    const bytes = await readBoundedBody(request, MAX_IMAGE_BYTES + 8192);
    const form = await new Response(bytes, {
        headers: { "Content-Type": contentType },
      }).formData(),
      file = form.get("file"),
      sessionId = form.get("sessionId");
    if (!(file instanceof File) || typeof sessionId !== "string")
      throw new Error("Select a photo and start a session.");
    sessionIdentity(sessionId);
    const data = Buffer.from(await file.arrayBuffer());
    validateImage(data, file.type);
    return response(
      addAsset(sessionId, {
        kind: "image",
        name: file.name.slice(0, 120),
        url: `data:${file.type};base64,${data.toString("base64")}`,
        classification: "proxy",
        status: "ready",
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    originAllowed(request);
    if (
      request.headers.get("content-type")?.split(";")[0] !== "application/json"
    )
      throw new AttachmentError("Use a JSON reference request.", 415);
    const body = JSON.parse(
      new TextDecoder().decode(await readBoundedBody(request, 8192)),
    );
    sessionIdentity(body?.sessionId);
    if (typeof body.attachmentId !== "string" || body.attachmentId.length > 100)
      throw new AttachmentError("Choose a reference to remove.");
    return response({
      removed: removeAsset(body.sessionId, body.attachmentId),
    });
  } catch (error) {
    return failure(error);
  }
}
