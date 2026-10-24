import { authorize } from "@/lib/integration/access";
import { claimPair, createPairCode } from "@/lib/discovery/store";
import { providerStatus } from "@/lib/discovery/providers";
import { DiscoveryError } from "@/lib/discovery/types";
import {
  assertShopperOrigin,
  cleanText,
  corsHeaders,
  extensionOrigin,
  failure,
  onlyKeys,
  preflight,
  readJson,
} from "@/lib/discovery/security";
export const runtime = "nodejs";
export const OPTIONS = preflight;
export async function POST(request: Request) {
  let headers: Record<string, string> = { "Cache-Control": "no-store" };
  try {
    const isExtension = request.headers
      .get("origin")
      ?.startsWith("chrome-extension://");
    if (isExtension) {
      extensionOrigin(request);
      headers = corsHeaders(request);
    } else assertShopperOrigin(request);
    const body = await readJson(request);
    if (body.action === "create") {
      if (isExtension)
        throw new DiscoveryError(
          "Pair from the authenticated Along page.",
          403,
        );
      onlyKeys(body, ["action", "sessionId", "extensionId"]);
      const id = cleanText(body.sessionId, 100, true);
      try {
        authorize(request, id);
      } catch {
        throw new DiscoveryError("Unauthorized shopper session.", 401);
      }
      return Response.json(createPairCode(id, body.extensionId), { headers });
    }
    if (body.action === "claim") {
      if (!isExtension)
        throw new DiscoveryError("Claim from the matching extension.", 403);
      onlyKeys(body, ["action", "code", "extensionId"]);
      const { token, pair } = claimPair(request, body.code, body.extensionId);
      return Response.json(
        {
          token,
          sessionId: pair.sessionId,
          epoch: pair.epoch,
          expiresAt: pair.expiresAt,
          ...providerStatus(),
        },
        { headers },
      );
    }
    throw new DiscoveryError("Unsupported pairing action.");
  } catch (error) {
    return failure(error, headers);
  }
}
