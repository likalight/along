import {
  integrationResponse,
  sessionView,
  acceptAction,
  acceptApproval,
} from "./integration.ts";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import { eligibleOffers } from "./catalog.ts";
import { alongProfile } from "./along-catalog.ts";
import type { CatalogProfile } from "./contracts.ts";
import { SessionStore, safeEqual } from "./store.ts";
import {
  ApiError,
  requireThat,
  object,
  keys,
  validateConstraints,
  integer,
} from "./validation.ts";
import type { Constraints } from "./contracts.ts";

export function createApp(options: {
  agentToken: string;
  origins?: string[];
  store?: SessionStore;
  profile?: CatalogProfile;
}) {
  const profile = options.profile ?? options.store?.profile ?? alongProfile;
  if (options.store && options.profile && options.store.profile !== options.profile)
    throw new Error("The HTTP catalog and session store must share one profile.");
  const { catalog, scenarios, preparedImages } = profile;
  const store = options.store ?? new SessionStore(undefined, profile);
  const origins = new Set(
    options.origins ?? [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
    ],
  );
  const integrated = new WeakSet<ServerResponse>();
  function trustedBridge(req: IncomingMessage) {
    const supplied = req.headers["x-agent-token"];
    requireThat(
      typeof supplied === "string" && options.agentToken.length >= 24 &&
        safeEqual(supplied, options.agentToken),
      "AGENT_UNAUTHORIZED",
      "This route requires the trusted AI/voice server.",
      403,
    );
  }
  function json(res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
    });
    res.end(
      JSON.stringify(integrated.has(res) ? integrationResponse(body) : body),
    );
  }
  async function body(req: IncomingMessage) {
    requireThat(
      req.headers["content-type"]?.split(";")[0] === "application/json",
      "CONTENT_TYPE",
      "Use application/json.",
      415,
    );
    let n = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      n += chunk.length;
      requireThat(
        n <= 32768,
        "BODY_TOO_LARGE",
        "Maximum request size is 32 KiB.",
        413,
      );
      chunks.push(chunk);
    }
    try {
      const b = JSON.parse(Buffer.concat(chunks).toString());
      object(b);
      return b;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(400, "INVALID_JSON", "Malformed JSON body.");
    }
  }
  const server = createServer(async (req, res) => {
    res.setHeader("cache-control", "no-store");
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("referrer-policy", "no-referrer");
    const origin = req.headers.origin;
    let authenticatedSessionId: string | undefined;
    try {
      if (origin) {
        requireThat(
          origins.has(origin),
          "ORIGIN_DENIED",
          "Origin is not configured for this demo.",
          403,
        );
        res.setHeader("access-control-allow-origin", origin);
        res.setHeader("vary", "Origin");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers":
            "Content-Type,Authorization,X-Agent-Token,X-Session-Revision",
          "access-control-max-age": "600",
        });
        res.end();
        return;
      }
      const path = new URL(req.url ?? "/", "http://localhost").pathname
        .split("/")
        .filter(Boolean);
      if (path[0] === "v1" && path[1] === "integration") {
        integrated.add(res);
        path.splice(1, 1);
      }
      if (req.method === "GET" && path.join("/") === "health") {
        json(res, 200, {
          ok: true,
          service: "concierge-backend",
          contractVersion: "1",
          purchaseMode: "simulated",
          storage: "ephemeral-memory",
        });
        return;
      }
      if (
        req.method === "GET" &&
        [
          "reference/bag-style.svg",
          "reference/bedding-style.svg",
          "reference/lamp-blue.svg",
          "reference/lamp-ivory.svg",
          "reference/lamp-sage.svg",
          "reference/lamp-terracotta.svg",
          "reference/lamp-white.svg",
          "reference/microphone-style.svg",
        ].includes(path.join("/"))
      ) {
        res.writeHead(200, {
          "content-type": "image/svg+xml",
          "content-security-policy":
            "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        });
        res.end(
          await readFile(
            new URL("../public/" + path.join("/"), import.meta.url),
          ),
        );
        return;
      }
      if (req.method === "GET" && [
        "catalog/images/bag.svg", "catalog/images/bedding.svg", "catalog/images/audio.svg",
      ].includes(path.join("/"))) {
        const asset = await readFile(new URL("../../catalog/public/" + path.join("/"), import.meta.url));
        res.writeHead(200, {
          "content-type": "image/svg+xml",
          "content-security-policy": "default-src 'none'; sandbox",
        });
        res.end(asset);
        return;
      }
      if (req.method === "GET" && path.join("/") === "v1/prepared-images") {
        json(res, 200, { images: preparedImages });
        return;
      }
      if (req.method === "GET" && path.join("/") === "v1/catalog") {
        json(res, 200, catalog);
        return;
      }
      if (req.method === "GET" && path.join("/") === "v1/scenarios") {
        json(res, 200, { scenarios });
        return;
      }
      if (req.method === "POST" && path.join("/") === "v1/catalog/search") {
        const b = await body(req);
        keys(b, ["constraints", "quantity", "excludedProductIds"]);
        validateConstraints(b.constraints ?? {});
        requireThat(
          b.quantity === undefined || integer(b.quantity, 1, 99),
          "INVALID_QUANTITY",
          "Invalid quantity.",
        );
        requireThat(
          b.excludedProductIds === undefined ||
            (Array.isArray(b.excludedProductIds) &&
              b.excludedProductIds.every((x) => typeof x === "string")),
          "INVALID_EXCLUSIONS",
          "Invalid exclusions.",
        );
        const results = eligibleOffers(
          (b.constraints ?? {}) as Constraints,
          (b.quantity ?? 1) as number,
          (b.excludedProductIds ?? []) as string[],
          catalog,
          profile.destination,
        );
        json(res, 200, {
          eligible: results.filter((x) => x.eligible),
          ineligible: results.filter((x) => !x.eligible),
          scope: "curated demo offers only",
        });
        return;
      }
      requireThat(
        path[0] === "v1" && path[1] === "sessions",
        "NOT_FOUND",
        "Unknown endpoint.",
        404,
      );
      if (path.length === 2 && req.method === "POST") {
        const b = await body(req);
        keys(b, ["scenarioId"]);
        requireThat(
          b.scenarioId === undefined || typeof b.scenarioId === "string",
          "INVALID_SCENARIO",
          "Invalid scenario ID.",
        );
        json(res, 201, store.create(b.scenarioId as string | undefined));
        return;
      }
      const id = path[2];
      requireThat(id, "NOT_FOUND", "Session ID required.", 404);
      const bearer = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : "";
      store.authenticate(id, bearer);
      authenticatedSessionId = id;
      const action = path.slice(3).join("/");
      const agentActions = [
        "proposals",
        "actions",
        "summaries",
        "approval",
        "confirm",
      ];
      if (agentActions.includes(action)) {
        trustedBridge(req);
      }
      if (req.method === "GET" && !action) {
        json(res, 200, { session: store.get(id) });
        return;
      }
      if (req.method === "GET" && action === "events") {
        // Use fetch streaming so credentials stay in headers, never query strings.
        res.writeHead(200, {
          "content-type": "text/event-stream",
          connection: "keep-alive",
        });
        const emit = (event: any) => {
          const writable = res.write(
            `data: ${JSON.stringify(integrated.has(res) && event.type === "session.snapshot" ? { type: "session.updated", sessionId: id, epoch: event.session.epoch, eventId: `state-${event.session.epoch}-${event.session.revision}`, turnId: event.session.turn?.id ?? null, revision: event.session.revision, snapshot: sessionView(event.session) } : event)}\n\n`,
          );
          // Slow consumers reconnect to the latest snapshot rather than accumulating
          // an unbounded queue of stale display/approval state in memory.
          if (!writable) res.end();
        };
        emit({ type: "session.snapshot", session: store.get(id) });
        const listener = (event: any) => {
          emit(event);
          if (event.type === "session.expired" || event.type === "session.ended") res.end();
        };
        store.events.on(id, listener);
        const heartbeat = setInterval(
          () => res.write(": heartbeat\n\n"),
          15000,
        );
        heartbeat.unref();
        res.on("close", () => {
          clearInterval(heartbeat);
          store.events.off(id, listener);
        });
        return;
      }
      if (action.startsWith("attachments/") && req.method === "GET") {
        const asset = store.attachment(id, action.slice("attachments/".length));
        res.writeHead(200, {
          "content-type": asset.contentType,
          "content-security-policy": "default-src 'none'; sandbox",
        });
        res.end(asset.bytes);
        return;
      }
      if (action === "attachments" && req.method === "POST") {
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          size += chunk.length;
          requireThat(
            size <= 2 * 1024 * 1024,
            "INVALID_IMAGE_SIZE",
            "Maximum image is 2 MiB.",
            413,
          );
          chunks.push(chunk);
        }
        const result = store.addAttachment(
          id,
          Number(req.headers["x-session-revision"]),
          String(req.headers["content-type"] ?? "").split(";")[0],
          Buffer.concat(chunks),
        );
        json(res, 201, result);
        return;
      }
      requireThat(
        req.method === "POST",
        "METHOD_NOT_ALLOWED",
        "Use POST for session actions.",
        405,
      );
      const b = await body(req);
      if ((action === "inputs" && b.modality === "voice") ||
          (action === "presentation" && b.event !== "displayed") ||
          (action === "lifecycle" && typeof b.type === "string" && b.type.startsWith("audio.")))
        trustedBridge(req);
      let result: unknown;
      switch (action) {
        case "lifecycle":
          result = { session: store.lifecycle(id, b) };
          break;
        case "end":
          keys(b, ["expectedRevision"]);
          result = store.end(id, b.expectedRevision as number);
          break;
        case "inputs":
          result = { session: store.input(id, b) };
          break;
        case "actions":
          result = acceptAction(store, id, b);
          break;
        case "confirm":
          result = acceptApproval(store, id, b);
          break;
        case "mode":
          keys(b, ["expectedRevision", "mode"]);
          result = {
            session: store.switchMode(id, b.expectedRevision as number, b.mode),
          };
          break;
        case "media":
          keys(b, ["expectedRevision", "type", "videoId"]);
          result = {
            session: store.media(
              id,
              b.expectedRevision as number,
              b.type,
              b.videoId,
            ),
          };
          break;
        case "turns":
          keys(b, ["expectedRevision"]);
          result = {
            session: store.beginTurn(id, b.expectedRevision as number),
          };
          break;
        case "cancel":
          if (profile.catalog.canonical) {
            keys(b, ["epoch", "eventId", "expectedRevision", "turnId"]);
            requireThat(
              ["epoch", "eventId", "expectedRevision", "turnId"].every(field => b[field] !== undefined),
              "INVALID_CANCELLATION_ENVELOPE",
              "Cancellation requires epoch, eventId, expectedRevision and turnId from the current snapshot.",
            );
            result = { session: store.lifecycle(id, {
              sessionId: id, epoch: b.epoch, eventId: b.eventId,
              revision: b.expectedRevision, turnId: b.turnId, type: "turn.cancelled",
            }) };
          } else {
            keys(b, ["turnId"]);
            result = { session: store.cancel(id, b.turnId as string) };
          }
          break;
        case "reset":
          keys(b, ["expectedRevision"]);
          result = { session: store.reset(id, b.expectedRevision as number) };
          break;
        case "proposals":
          result = store.propose(id, b);
          break;
        case "summaries":
          keys(b, ["expectedRevision", "turnId"]);
          result = {
            session: store.summarize(
              id,
              b.expectedRevision as number,
              b.turnId as string,
            ),
          };
          break;
        case "presentation":
          requireThat(
            !profile.catalog.canonical || ["epoch", "eventId", "expectedRevision", "summaryRevision"].every(field => b[field] !== undefined),
            "INVALID_PRESENTATION_ENVELOPE",
            "Presentation requires epoch, eventId, expectedRevision and summaryRevision for the current displayed summary.",
          );
          result = { session: store.presentation(id, b) };
          break;
        case "approval":
          requireThat(
            !profile.catalog.canonical,
            "LEGACY_APPROVAL_DISABLED",
            "Use /confirm with a fresh shopper input, epoch, eventId, turnId, baseRevision and summaryRevision. Legacy approval is unavailable for this catalog.",
            409,
          );
          result = store.approve(id, b);
          break;
        default:
          throw new ApiError(404, "NOT_FOUND", "Unknown session action.");
      }
      json(res, 200, result);
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      const error =
        e instanceof ApiError
          ? e
          : new ApiError(500, "INTERNAL_ERROR", "Unexpected server error.");
      if (!(e instanceof ApiError))
        console.error(
          "backend error",
          e instanceof Error ? e.message : "unknown",
        );
      let details = error.details;
      // Conflicting decisions are re-evaluated from the same accepted state
      // returned to an authenticated shopper, never a partially applied proposal.
      if (authenticatedSessionId && (error.status === 409 || error.status === 422)) {
        try {
          details = {
            ...(details && typeof details === "object" ? details : {}),
            session: store.get(authenticatedSessionId),
          };
        } catch { /* Expired/ended sessions have no resumable snapshot. */ }
      }
      json(res, error.status, {
        error: {
          code: error.code,
          message: error.message,
          ...(details !== undefined ? { details } : {}),
        },
      });
    }
  });
  const sweep = setInterval(() => store.sweep(), 30000);
  sweep.unref();
  server.on("close", () => clearInterval(sweep));
  return { server, store };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const agentToken = process.env.AGENT_API_TOKEN ?? "";
  if (agentToken.length < 24) {
    console.error(
      "Set AGENT_API_TOKEN to a random secret of at least 24 characters. See README.",
    );
    process.exitCode = 1;
  } else {
    const port = Number(process.env.PORT ?? 4318),
      host = process.env.HOST ?? "127.0.0.1";
    const { server } = createApp({
      agentToken,
      origins: process.env.ALLOWED_ORIGINS?.split(","),
    });
    server.listen(port, host, () =>
      console.log(
        `Concierge backend http://${host}:${port} — SIMULATED purchases only`,
      ),
    );
  }
}
