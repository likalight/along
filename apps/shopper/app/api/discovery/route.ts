import {
  authenticateExtension,
  assertPairCurrent,
  beginDiscovery,
  createHandoff,
  rateLimit,
  retainResult,
} from "@/lib/discovery/store";
import { discover, providerStatus } from "@/lib/discovery/providers";
import { DiscoveryError } from "@/lib/discovery/types";
import {
  corsHeaders,
  failure,
  MAX_DISCOVERY_BODY,
  onlyKeys,
  parseObservation,
  preflight,
  readJson,
} from "@/lib/discovery/security";
export const runtime = "nodejs";
export const OPTIONS = preflight;
export async function POST(request: Request) {
  let headers: Record<string, string> = { "Cache-Control": "no-store" };
  try {
    headers = corsHeaders(request);
    const pair = authenticateExtension(request);
    const body = await readJson(request, MAX_DISCOVERY_BODY);
    if (body.action === "status") {
      onlyKeys(body, ["action"]);
      return Response.json(
        {
          sessionId: pair.sessionId,
          epoch: pair.epoch,
          expiresAt: pair.expiresAt,
          ...providerStatus(),
        },
        { headers },
      );
    }
    if (body.action === "discover") {
      onlyKeys(body, ["action", "observation", "demo"]);
      if (body.demo !== undefined && typeof body.demo !== "boolean")
        throw new DiscoveryError("Demo must be explicitly true or false.");
      rateLimit("discover:" + pair.key, 12);
      const requestUrl = new URL(request.url);
      const demoOrigin =
        body.demo === true
          ? requestUrl.protocol +
            "//" +
            (request.headers.get("host") ?? requestUrl.host)
          : undefined;
      const observation = parseObservation(body.observation, demoOrigin);
      const generation = beginDiscovery(pair);
      const result = await discover(observation, body.demo === true);
      assertPairCurrent(pair); // A reset or revocation during provider work invalidates its result.
      retainResult(pair, result, generation);
      return Response.json(result, { headers });
    }
    if (body.action === "handoff") {
      onlyKeys(body, ["action", "observationId", "candidateId"]);
      const handoff = createHandoff(pair, body.observationId, body.candidateId);
      return Response.json(
        {
          sessionId: pair.sessionId,
          handoffId: handoff.handoffId,
          url: "/?discoverySession=" + encodeURIComponent(pair.sessionId),
        },
        { headers },
      );
    }
    throw new DiscoveryError("Unsupported discovery action.");
  } catch (error) {
    return failure(error, headers);
  }
}
