import { authorize } from "@/lib/integration/access";
import { acknowledgeHandoff, getPendingHandoff } from "@/lib/discovery/store";
import {
  assertShopperOrigin,
  cleanText,
  failure,
  onlyKeys,
  readJson,
} from "@/lib/discovery/security";
import { DiscoveryError } from "@/lib/discovery/types";
export const runtime = "nodejs";
function auth(request: Request, id: string, mutation = false) {
  assertShopperOrigin(request, mutation);
  try {
    authorize(request, id);
  } catch {
    throw new DiscoveryError("Unauthorized shopper session.", 401);
  }
}
export async function GET(request: Request) {
  try {
    const id = cleanText(
      new URL(request.url).searchParams.get("sessionId"),
      100,
      true,
    );
    auth(request, id);
    return Response.json(
      { pending: getPendingHandoff(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertShopperOrigin(request);
    const body = await readJson(request);
    onlyKeys(body, ["action", "sessionId", "handoffId"]);
    if (body.action !== "ack")
      throw new DiscoveryError("Unsupported inbox action.");
    const id = cleanText(body.sessionId, 100, true),
      handoffId = cleanText(body.handoffId, 100, true);
    auth(request, id, true);
    return Response.json(
      { acknowledged: acknowledgeHandoff(id, handoffId) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
