import { DiscoveryError, type Observation } from "./types";
import { validateImage } from "@/lib/attachments/validation";

export const MAX_IMAGE_BYTES = 1024 * 1024;
export const MAX_DISCOVERY_BODY = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 16_384;
export const extensionId = (value: unknown): string => {
  if (typeof value !== "string" || !/^[a-p]{32}$/.test(value))
    throw new DiscoveryError("A valid Chrome extension ID is required.");
  return value;
};
export function extensionOrigin(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  if (!/^chrome-extension:\/\/[a-p]{32}$/.test(origin))
    throw new DiscoveryError(
      "The paired Chrome extension origin is required.",
      403,
    );
  return origin;
}
const loopback = (name: string) =>
  ["localhost", "127.0.0.1", "[::1]"].includes(name);
/** Next may use a loopback alias internally; only the exact public Host/scheme/port is trusted. */
export function assertShopperOrigin(request: Request, required = true) {
  const value = request.headers.get("origin");
  if (!value) {
    if (required)
      throw new DiscoveryError(
        "A same-origin shopper request is required.",
        403,
      );
    return;
  }
  try {
    const origin = new URL(value),
      destination = new URL(request.url);
    const host = request.headers.get("host") ?? destination.host;
    if (
      origin.origin !== value ||
      !["http:", "https:"].includes(origin.protocol) ||
      origin.protocol !== destination.protocol ||
      origin.host !== host ||
      (origin.origin !== destination.origin &&
        !(
          loopback(origin.hostname) &&
          loopback(destination.hostname) &&
          origin.port === destination.port
        ))
    )
      throw new Error();
  } catch {
    throw new DiscoveryError("Cross-origin shopper request rejected.", 403);
  }
}
export async function readJson(
  request: Request,
  max = 8192,
): Promise<Record<string, unknown>> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    throw new DiscoveryError("JSON body required.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > max)
    throw new DiscoveryError("Discovery request too large.", 413);
  if (!request.body) throw new DiscoveryError("Request body required.");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let count = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > max) {
        await reader.cancel();
        throw new DiscoveryError("Discovery request too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new DiscoveryError("A valid JSON object is required.");
  }
}
export function onlyKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new DiscoveryError("Unexpected discovery request field.");
}
export function cleanText(
  value: unknown,
  max: number,
  required = false,
): string {
  if (typeof value !== "string" || value.length > max) {
    if (value === undefined && !required) return "";
    throw new DiscoveryError("Invalid or oversized text.");
  }
  const clean = value
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (required && !clean) throw new DiscoveryError("Text is required.");
  return clean;
}
export function sourceUrl(value: unknown, demoOrigin?: string) {
  if (typeof value !== "string" || value.length > 2048)
    throw new DiscoveryError("Invalid page URL.");
  try {
    const u = new URL(value);
    if (
      demoOrigin &&
      u.protocol === "http:" &&
      loopback(u.hostname) &&
      u.origin === demoOrigin &&
      u.pathname === "/extension-demo" &&
      !u.search &&
      !u.username &&
      !u.password
    ) {
      u.hash = "";
      return u.href;
    }
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !u.hostname.includes(".") ||
      /^\d+(?:\.\d+){3}$/.test(u.hostname) ||
      u.hostname.startsWith("[") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname)
    )
      throw new Error();
    u.hash = "";
    return u.href;
  } catch {
    throw new DiscoveryError(
      "Use an HTTPS public page URL without credentials.",
    );
  }
}
export function parseObservation(
  value: unknown,
  demoOrigin?: string,
): Observation {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new DiscoveryError("Observation required.");
  const o = value as Record<string, unknown>;
  onlyKeys(o, ["pageUrl", "title", "text", "kind", "imageDataUrl"]);
  if (!["product", "post", "video"].includes(String(o.kind)))
    throw new DiscoveryError("Invalid observation kind.");
  const result: Observation = {
    pageUrl: sourceUrl(o.pageUrl, demoOrigin),
    title: cleanText(o.title, 500, true),
    text: cleanText(o.text, 4000),
    kind: o.kind as Observation["kind"],
  };
  if (o.imageDataUrl !== undefined) {
    if (
      typeof o.imageDataUrl !== "string" ||
      o.imageDataUrl.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 40
    )
      throw new DiscoveryError("Image exceeds the 1 MiB discovery limit.", 413);
    const m =
      /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        o.imageDataUrl,
      );
    if (!m || m[2].length % 4)
      throw new DiscoveryError("Use a base64 PNG, JPEG or WebP image.");
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== m[2])
      throw new DiscoveryError("Invalid or oversized image.");
    try {
      validateImage(bytes, m[1]);
    } catch {
      throw new DiscoveryError(
        "A structurally valid PNG, JPEG or WebP image is required.",
      );
    }
    result.imageDataUrl = o.imageDataUrl;
  }
  return result;
}
export function corsHeaders(request: Request) {
  const origin = extensionOrigin(request);
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}
export function preflight(request: Request) {
  try {
    const headers = corsHeaders(request);
    if (
      request.headers.get("access-control-request-method") !== "POST" ||
      (request.headers.get("access-control-request-headers") ?? "")
        .split(",")
        .some(
          (h) =>
            h.trim() &&
            !["authorization", "content-type"].includes(h.trim().toLowerCase()),
        )
    )
      throw new DiscoveryError("Unsupported preflight.", 403);
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "300",
      },
    });
  } catch {
    return Response.json(
      { error: "Extension origin required." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export function failure(error: unknown, headers: HeadersInit = {}) {
  const known = error instanceof DiscoveryError;
  return Response.json(
    {
      error: known
        ? error.message
        : "Discovery is unavailable. Reconnect your shopper session.",
    },
    {
      status: known ? error.status : 400,
      headers: { ...headers, "Cache-Control": "no-store" },
    },
  );
}
