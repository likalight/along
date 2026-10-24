import { NextResponse } from "next/server";
import {
  browserAuthorized,
  nativeAuthorized,
  pairBrowser,
  memoryStatus,
  control,
  learn,
} from "@/lib/context/automatic";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function GET(req: Request) {
  try {
    if (!browserAuthorized(req))
      return json(
        { error: "Open Along from the Mac companion to pair this browser." },
        401,
      );
    return json(memoryStatus());
  } catch {
    return json(
      { error: "Mac companion is not configured on this local server." },
      503,
    );
  }
}
export async function POST(req: Request) {
  try {
    if (!req.headers.get("content-type")?.includes("application/json"))
      return json({ error: "JSON required" }, 415);
    const raw = await req.text();
    if (raw.length > 8000) return json({ error: "Request too large" }, 413);
    const b = JSON.parse(raw);
    if (b.action === "pair") {
      const token = pairBrowser(req, b.token);
      const response = json(memoryStatus());
      response.cookies.set("along-context", token, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
      });
      return response;
    }
    const native = nativeAuthorized(req),
      browser = browserAuthorized(req);
    if (!native && !browser)
      return json({ error: "Context pairing required" }, 401);
    if (b.action === "observe") {
      if (!native) return json({ error: "Native companion required" }, 403);
      return json(await learn(b.activity));
    }
    return json(control(b.action, b.key, b.value));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Context request failed",
      },
      400,
    );
  }
}
