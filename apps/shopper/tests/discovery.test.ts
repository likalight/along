import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  POST as pairPost,
  OPTIONS as pairOptions,
} from "@/app/api/discovery/pair/route";
import { POST as discoveryPost } from "@/app/api/discovery/route";
import {
  GET as inboxGet,
  POST as inboxPost,
} from "@/app/api/discovery/inbox/route";
import { getRuntime } from "@/lib/integration/runtime";
import {
  getPendingHandoff,
  CODE_TTL_MS,
  TOKEN_TTL_MS,
  RESULT_TTL_MS,
} from "@/lib/discovery/store";
import { coupangSignature } from "@/lib/discovery/providers";
import { MAX_DISCOVERY_BODY } from "@/lib/discovery/security";

const EXT = "a".repeat(32),
  OTHER = "b".repeat(32),
  ORIGIN = "chrome-extension://" + EXT;
const BASE = "http://localhost";
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";
const observation = {
  pageUrl: "https://www.amazon.com/dp/B012345678",
  title: "Navy work tote bag",
  text: "A bag for work",
  kind: "product",
};
function session() {
  const { session, accessToken } = getRuntime().store.core.create();
  return {
    id: session.id,
    epoch: session.epoch,
    cookie: "along-session-" + session.id + "=" + accessToken,
  };
}
function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
async function code(s = session()) {
  const response = await pairPost(
    request(
      "/api/discovery/pair",
      { action: "create", sessionId: s.id, extensionId: EXT },
      { Origin: BASE, Cookie: s.cookie },
    ),
  );
  expect(response.status).toBe(200);
  return { ...s, ...(await response.json()) };
}
async function paired() {
  const c = await code();
  const response = await pairPost(
    request(
      "/api/discovery/pair",
      { action: "claim", code: c.code, extensionId: EXT },
      { Origin: ORIGIN },
    ),
  );
  expect(response.status).toBe(200);
  return { ...c, ...(await response.json()) } as typeof c & { token: string };
}
const extensionRequest = (token: string, body: unknown, origin = ORIGIN) =>
  request("/api/discovery", body, {
    Origin: origin,
    Authorization: "Bearer " + token,
  });
const configureLive = () => {
  vi.stubEnv("ALONG_DISCOVERY_PROVIDER", "coupang");
  vi.stubEnv("COUPANG_PARTNERS_APPROVED", "true");
  vi.stubEnv("COUPANG_ACCESS_KEY", "test-access");
  vi.stubEnv("COUPANG_SECRET_KEY", "test-secret");
};
const product = (overrides: Record<string, unknown> = {}) => ({
  productId: 123,
  productName: "Cotton sheets",
  productPrice: 45000,
  productUrl: "https://www.coupang.com/vp/products/123",
  productImage: "https://thumbnail.coupangcdn.com/test.jpg",
  ...overrides,
});
const upstream = (rows: unknown[]) =>
  Response.json({ rCode: "0", data: { productData: rows } });

beforeEach(() => {
  delete (globalThis as { __alongDiscovery?: unknown }).__alongDiscovery;
  for (const name of [
    "ALONG_DISCOVERY_PROVIDER",
    "COUPANG_PARTNERS_APPROVED",
    "COUPANG_ACCESS_KEY",
    "COUPANG_SECRET_KEY",
    "COUPANG_SEARCH_PATH",
    "ALONG_DISCOVERY_VISION",
    "OPENAI_API_KEY",
  ])
    vi.stubEnv(name, "");
  vi.stubEnv(
    "COUPANG_SEARCH_PATH",
    "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Unexpected external call");
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("discovery pairing and boundaries", () => {
  it("requires a same-origin session cookie and exact scheme, then one-time matching extension claim", async () => {
    const s = session();
    for (const headers of [
      { Origin: BASE },
      { Origin: "https://localhost", Cookie: s.cookie },
      { Origin: "https://evil.example", Cookie: s.cookie },
      { Cookie: s.cookie },
    ] as Record<string, string>[])
      expect(
        (
          await pairPost(
            request(
              "/api/discovery/pair",
              { action: "create", sessionId: s.id, extensionId: EXT },
              headers,
            ),
          )
        ).status,
      ).toBeGreaterThanOrEqual(400);
    const c = await code(s);
    expect(
      (
        await pairPost(
          request(
            "/api/discovery/pair",
            { action: "claim", code: c.code, extensionId: EXT },
            { Origin: "chrome-extension://" + OTHER },
          ),
        )
      ).status,
    ).toBe(403);
    const claimed = await pairPost(
      request(
        "/api/discovery/pair",
        { action: "claim", code: c.code, extensionId: EXT },
        { Origin: ORIGIN },
      ),
    );
    expect(claimed.status).toBe(200);
    const payload = await claimed.json();
    expect(payload).toMatchObject({
      sessionId: s.id,
      epoch: s.epoch,
      mode: "unavailable",
      visionAvailable: false,
    });
    expect(claimed.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(claimed.headers.get("access-control-allow-credentials")).toBeNull();
    expect(
      (
        await pairPost(
          request(
            "/api/discovery/pair",
            { action: "claim", code: c.code, extensionId: EXT },
            { Origin: ORIGIN },
          ),
        )
      ).status,
    ).toBe(401);
    const retained = JSON.stringify(
      (globalThis as { __alongDiscovery?: unknown }).__alongDiscovery,
      (_key, value) => (value instanceof Map ? [...value] : value),
    );
    expect(retained).not.toContain(payload.token);
    expect(retained).not.toContain(c.code);
  });
  it("limits CORS to syntactically valid extension origins and supported preflight headers", () => {
    for (const origin of [
      "https://evil.example",
      "null",
      ORIGIN + "/",
      "chrome-extension://" + EXT + ".evil",
    ])
      expect(
        pairOptions(
          new Request(BASE + "/api/discovery/pair", {
            method: "OPTIONS",
            headers: {
              Origin: origin,
              "Access-Control-Request-Method": "POST",
            },
          }),
        ).status,
      ).toBe(403);
    const allowed = pairOptions(
      new Request(BASE + "/api/discovery/pair", {
        method: "OPTIONS",
        headers: {
          Origin: ORIGIN,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type,authorization",
        },
      }),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(
      pairOptions(
        new Request(BASE + "/api/discovery/pair", {
          method: "OPTIONS",
          headers: {
            Origin: ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "cookie",
          },
        }),
      ).status,
    ).toBe(403);
  });
  it("rejects missing bearer, different extension, expired code and expired token", async () => {
    vi.useFakeTimers();
    const c = await code();
    vi.setSystemTime(Date.now() + CODE_TTL_MS + 1);
    expect(
      (
        await pairPost(
          request(
            "/api/discovery/pair",
            { action: "claim", code: c.code, extensionId: EXT },
            { Origin: ORIGIN },
          ),
        )
      ).status,
    ).toBe(401);
    const p = await paired();
    expect(
      (
        await discoveryPost(
          request("/api/discovery", { action: "status" }, { Origin: ORIGIN }),
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await discoveryPost(
          extensionRequest(
            p.token,
            { action: "status" },
            "chrome-extension://" + OTHER,
          ),
        )
      ).status,
    ).toBe(401);
    vi.setSystemTime(Date.now() + TOKEN_TTL_MS + 1);
    expect(
      (await discoveryPost(extensionRequest(p.token, { action: "status" })))
        .status,
    ).toBe(401);
  });
  it("invalidates pairing codes and tokens on reset or session end", async () => {
    const c = await code(),
      core = getRuntime().store.core;
    core.reset(c.id, core.get(c.id).revision);
    expect(
      (
        await pairPost(
          request(
            "/api/discovery/pair",
            { action: "claim", code: c.code, extensionId: EXT },
            { Origin: ORIGIN },
          ),
        )
      ).status,
    ).toBe(401);
    const p = await paired();
    core.end(p.id, core.get(p.id).revision);
    expect(
      (await discoveryPost(extensionRequest(p.token, { action: "status" })))
        .status,
    ).toBe(401);
  });
  it("bounds streamed bodies and rejects invalid URLs, types and image containers", async () => {
    const p = await paired();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_DISCOVERY_BODY + 1));
        controller.close();
      },
    });
    const tooLarge = new Request(BASE + "/api/discovery", {
      method: "POST",
      headers: {
        Origin: ORIGIN,
        Authorization: "Bearer " + p.token,
        "Content-Type": "application/json",
      },
      body,
      duplex: "half",
    } as RequestInit);
    expect((await discoveryPost(tooLarge)).status).toBe(413);
    for (const patch of [
      { pageUrl: "http://127.0.0.1/admin" },
      { pageUrl: "https://user:password@amazon.com/" },
      { pageUrl: "javascript:alert(1)" },
      { kind: "instruction" },
      { imageDataUrl: "data:image/png;base64,bm90YW5pbWFnZQ==" },
    ])
      expect(
        (
          await discoveryPost(
            extensionRequest(p.token, {
              action: "discover",
              demo: true,
              observation: { ...observation, ...patch },
            }),
          )
        ).status,
      ).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("truthful discovery and explicit handoff", () => {
  it("keeps earlier sidebar cards usable after newer and duplicate discoveries, with bounded expiry", async () => {
    vi.useFakeTimers();
    const p = await paired();
    const original = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          demo: true,
          observation,
        }),
      )
    ).json();
    await discoveryPost(
      extensionRequest(p.token, {
        action: "discover",
        demo: true,
        observation: { ...observation, title: "Cotton bedsheet set" },
      }),
    );
    const repeated = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          demo: true,
          observation,
        }),
      )
    ).json();
    expect(repeated.observationId).not.toBe(original.observationId);
    const oldHandoff = await discoveryPost(
      extensionRequest(p.token, {
        action: "handoff",
        observationId: original.observationId,
        candidateId: original.candidates[0].id,
      }),
    );
    expect(oldHandoff.status).toBe(200);
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, {
            action: "handoff",
            observationId: repeated.observationId,
            candidateId: repeated.candidates[0].id,
          }),
        )
      ).status,
    ).toBe(200);
    vi.setSystemTime(Date.now() + RESULT_TTL_MS + 1);
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, {
            action: "handoff",
            observationId: original.observationId,
            candidateId: original.candidates[0].id,
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (await discoveryPost(extensionRequest(p.token, { action: "status" })))
        .status,
    ).toBe(200);
  });
  it("retains at most twelve recent result cards per pairing", async () => {
    vi.useFakeTimers();
    const p = await paired();
    const responses = [];
    for (let index = 0; index < 13; index++) {
      if (index === 12) vi.setSystemTime(Date.now() + 61_000);
      responses.push(
        await (
          await discoveryPost(
            extensionRequest(p.token, {
              action: "discover",
              demo: true,
              observation: { ...observation, title: "Bag " + index },
            }),
          )
        ).json(),
      );
    }
    // All thirteen are younger than ten minutes; only the per-pair count evicts the first.
    const first = responses[0],
      latest = responses.at(-1)!;
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, {
            action: "handoff",
            observationId: first.observationId,
            candidateId: first.candidates[0].id,
          }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, {
            action: "handoff",
            observationId: latest.observationId,
            candidateId: latest.candidates[0].id,
          }),
        )
      ).status,
    ).toBe(200);
  });
  it("allows only the same-origin local demo fixture, never loopback live or arbitrary paths", async () => {
    const p = await paired();
    const allowed = await discoveryPost(
      extensionRequest(p.token, {
        action: "discover",
        demo: true,
        observation: { ...observation, pageUrl: BASE + "/extension-demo" },
      }),
    );
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).mode).toBe("demo");
    for (const [pageUrl, demo] of [
      [BASE + "/extension-demo", false],
      [BASE + "/private", true],
      ["http://localhost:9999/extension-demo", true],
      ["http://127.0.0.1/extension-demo", true],
    ] as const) {
      expect(
        (
          await discoveryPost(
            extensionRequest(p.token, {
              action: "discover",
              demo,
              observation: { ...observation, pageUrl },
            }),
          )
        ).status,
      ).toBe(400);
    }
  });
  it("an old epoch bearer cannot revoke a newly paired epoch", async () => {
    const p = await paired(),
      core = getRuntime().store.core;
    core.reset(p.id, core.get(p.id).revision);
    const c = await code(p);
    const fresh = await (
      await pairPost(
        request(
          "/api/discovery/pair",
          { action: "claim", code: c.code, extensionId: EXT },
          { Origin: ORIGIN },
        ),
      )
    ).json();
    expect(
      (await discoveryPost(extensionRequest(p.token, { action: "status" })))
        .status,
    ).toBe(401);
    expect(
      (await discoveryPost(extensionRequest(fresh.token, { action: "status" })))
        .status,
    ).toBe(200);
  });
  it("defaults unavailable with no network; demo is opt-in and irrelevant content has no matches", async () => {
    const p = await paired();
    const unavailable = await (
      await discoveryPost(
        extensionRequest(p.token, { action: "discover", observation }),
      )
    ).json();
    expect(unavailable).toMatchObject({ mode: "unavailable", candidates: [] });
    const demo = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          demo: true,
          observation,
        }),
      )
    ).json();
    expect(demo.mode).toBe("demo");
    expect(demo.candidates.length).toBeGreaterThan(0);
    expect(
      demo.candidates.every(
        (c: { match: string; linkKind: string; url: string }) =>
          c.match === "similar" &&
          c.linkKind === "search" &&
          c.url.startsWith("https://www.coupang.com/np/search?"),
      ),
    ).toBe(true);
    expect(demo.notice).toContain("fictional");
    const irrelevant = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          demo: true,
          observation: {
            ...observation,
            title: "Astronomy sunset",
            text: "Clouds and stars",
          },
        }),
      )
    ).json();
    expect(irrelevant.candidates).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never persists raw image/text and hands off only a chosen stored candidate to its own authenticated session", async () => {
    const p = await paired(),
      other = session();
    const response = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          demo: true,
          observation: {
            ...observation,
            imageDataUrl: png,
            text: "tote bag UNIQUE_PRIVATE_PAGE_MARKER",
          },
        }),
      )
    ).json();
    expect(response.candidates[0].unknowns.join(" ")).toContain("not analyzed");
    expect(getPendingHandoff(p.id)).toBeNull();
    const handoffBody = {
      action: "handoff",
      observationId: response.observationId,
      candidateId: response.candidates[0].id,
    };
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, {
            ...handoffBody,
            candidate: { url: "https://evil.example" },
          }),
        )
      ).status,
    ).toBe(400);
    const handoff = await (
      await discoveryPost(extensionRequest(p.token, handoffBody))
    ).json();
    const duplicate = await (
      await discoveryPost(extensionRequest(p.token, handoffBody))
    ).json();
    expect(duplicate.handoffId).toBe(handoff.handoffId);
    const inbox = await inboxGet(
      new Request(BASE + "/api/discovery/inbox?sessionId=" + p.id, {
        headers: { Cookie: p.cookie },
      }),
    );
    expect((await inbox.json()).pending.candidate.id).toBe(
      response.candidates[0].id,
    );
    expect(
      (
        await inboxGet(
          new Request(BASE + "/api/discovery/inbox?sessionId=" + p.id, {
            headers: { Cookie: other.cookie },
          }),
        )
      ).status,
    ).toBe(401);
    const retained = JSON.stringify(
      (globalThis as { __alongDiscovery?: unknown }).__alongDiscovery,
      (_key, value) => (value instanceof Map ? [...value] : value),
    );
    expect(retained).not.toContain("UNIQUE_PRIVATE_PAGE_MARKER");
    expect(retained).not.toContain(png);
    expect(
      (
        await inboxPost(
          request(
            "/api/discovery/inbox",
            { action: "ack", sessionId: p.id, handoffId: handoff.handoffId },
            { Origin: BASE, Cookie: p.cookie },
          ),
        )
      ).status,
    ).toBe(200);
    await discoveryPost(extensionRequest(p.token, handoffBody));
    expect(getPendingHandoff(p.id)).toBeNull();
  });
  it("rejects old results from another pairing and rejects reset during asynchronous provider work", async () => {
    configureLive();
    const p = await paired();
    let resolveFetch!: (value: Response) => void, started!: () => void;
    const start = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        started();
        return new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        });
      }),
    );
    const pending = discoveryPost(
      extensionRequest(p.token, { action: "discover", observation }),
    );
    await start;
    const core = getRuntime().store.core;
    core.reset(p.id, core.get(p.id).revision);
    resolveFetch(upstream([product()]));
    expect((await pending).status).toBe(401);
    expect(getPendingHandoff(p.id)).toBeNull();
  });
  it("limits per-pair discovery work", async () => {
    const p = await paired();
    for (let i = 0; i < 12; i++)
      expect(
        (
          await discoveryPost(
            extensionRequest(p.token, { action: "discover", observation }),
          )
        ).status,
      ).toBe(200);
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, { action: "discover", observation }),
        )
      ).status,
    ).toBe(429);
  });
});

describe("approved provider adapter", () => {
  it("uses the documented default when Compose forwards an empty search path", async () => {
    configureLive();
    vi.stubEnv("COUPANG_SEARCH_PATH", "");
    const p = await paired();
    const fetcher = vi.fn().mockResolvedValue(upstream([product()]));
    vi.stubGlobal("fetch", fetcher);
    const status = await (
      await discoveryPost(extensionRequest(p.token, { action: "status" }))
    ).json();
    expect(status.mode).toBe("live");
    const result = await (
      await discoveryPost(
        extensionRequest(p.token, { action: "discover", observation }),
      )
    ).json();
    expect(result.mode).toBe("live");
    expect(new URL(fetcher.mock.calls[0][0]).pathname).toBe(
      "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search",
    );
  });
  it("normalizes affiliate responses to plain listing links with only verified option IDs", async () => {
    configureLive();
    const p = await paired();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        upstream([
          product({
            productUrl:
              "https://link.coupang.com/re/AFFSDP?lptag=AF123&pageKey=123&itemId=456&vendorItemId=789&traceid=tracking",
          }),
        ]),
      ),
    );
    const result = await (
      await discoveryPost(
        extensionRequest(p.token, { action: "discover", observation }),
      )
    ).json();
    expect(result.candidates[0].url).toBe(
      "https://www.coupang.com/vp/products/123?itemId=456&vendorItemId=789",
    );
    expect(JSON.stringify(result)).not.toContain("lptag");
    expect(JSON.stringify(result)).not.toContain("traceid");
  });
  it("a late older lookup cannot replace the current result or be handed off", async () => {
    configureLive();
    const p = await paired();
    let resolveFirst!: (value: Response) => void, started!: () => void;
    const start = new Promise<void>((resolve) => {
      started = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(() => {
          started();
          return new Promise<Response>((resolve) => {
            resolveFirst = resolve;
          });
        })
        .mockResolvedValueOnce(
          upstream([
            product({
              productId: 456,
              productUrl: "https://www.coupang.com/vp/products/456",
            }),
          ]),
        ),
    );
    const first = discoveryPost(
      extensionRequest(p.token, { action: "discover", observation }),
    );
    await start;
    const latest = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          observation: { ...observation, title: "Cotton sheets" },
        }),
      )
    ).json();
    resolveFirst(upstream([product()]));
    expect((await first).status).toBe(409);
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, {
            action: "handoff",
            observationId: latest.observationId,
            candidateId: latest.candidates[0].id,
          }),
        )
      ).status,
    ).toBe(200);
    expect(getPendingHandoff(p.id)?.candidate.id).toBe("coupang-456");
  });
  it("uses fixed signed HTTPS API requests, preserves KRW, and rejects hostile returned URLs", async () => {
    configureLive();
    const p = await paired();
    const fetcher = vi.fn().mockResolvedValue(
      upstream([
        product(),
        product({
          productId: 124,
          productUrl: "https://www.coupang.com.evil.example/vp/products/124",
        }),
        product({
          productId: 125,
          productUrl: "https://user@www.coupang.com/vp/products/125",
        }),
        product({ productId: 126, productPrice: -1 }),
      ]),
    );
    vi.stubGlobal("fetch", fetcher);
    const response = await (
      await discoveryPost(
        extensionRequest(p.token, { action: "discover", observation }),
      )
    ).json();
    expect(response.mode).toBe("live");
    expect(response.candidates).toHaveLength(1);
    expect(response.candidates[0]).toMatchObject({
      price: { amount: 45000, currency: "KRW" },
      match: "similar",
      linkKind: "listing",
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toMatch(
      /^https:\/\/api-gateway\.coupang\.com\/v2\/providers\/affiliate_open_api\/apis\/openapi\/v1\/products\/search\?/,
    );
    expect(options.redirect).toBe("error");
    expect(options.headers.Authorization).toContain("CEA algorithm=HmacSHA256");
    expect(url).not.toContain("test-secret");
    expect(
      coupangSignature(
        "GET",
        "/x",
        "keyword=bag",
        "a",
        "s",
        new Date("2026-10-25T00:00:00Z"),
      ),
    ).toContain("signed-date=261025T000000Z");
  });
  it("does not call a provider before approval, allow arbitrary provider paths, or substitute demo after provider failure", async () => {
    configureLive();
    const p = await paired(),
      fetcher = vi.fn().mockRejectedValue(new Error("secret diagnostic"));
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("COUPANG_PARTNERS_APPROVED", "false");
    expect(
      (
        await (
          await discoveryPost(
            extensionRequest(p.token, { action: "discover", observation }),
          )
        ).json()
      ).mode,
    ).toBe("unavailable");
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("COUPANG_PARTNERS_APPROVED", "true");
    vi.stubEnv("COUPANG_SEARCH_PATH", "https://evil.example/");
    await discoveryPost(
      extensionRequest(p.token, { action: "discover", observation }),
    );
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv(
      "COUPANG_SEARCH_PATH",
      "/v2/providers/affiliate_open_api/apis/openapi/products/search",
    );
    const failed = await (
      await discoveryPost(
        extensionRequest(p.token, { action: "discover", observation }),
      )
    ).json();
    expect(failed).toMatchObject({ mode: "unavailable", candidates: [] });
    expect(JSON.stringify(failed)).not.toContain("secret diagnostic");
  });
  it("uses optional vision only when enabled, store:false and strict outputs; never follows arbitrary image URLs", async () => {
    configureLive();
    vi.stubEnv("ALONG_DISCOVERY_VISION", "true");
    vi.stubEnv("OPENAI_API_KEY", "fake-key");
    const p = await paired(),
      fetcher = vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            status: "completed",
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      keyword: "cotton sheets",
                      confidence: 0.8,
                      productVisible: true,
                    }),
                  },
                ],
              },
            ],
          }),
        )
        .mockResolvedValueOnce(upstream([product()]));
    vi.stubGlobal("fetch", fetcher);
    const result = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          observation: { ...observation, imageDataUrl: png },
        }),
      )
    ).json();
    expect(result.mode).toBe("live");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const payload = JSON.parse(options.body);
    expect(payload.store).toBe(false);
    expect(payload.text.format.strict).toBe(true);
    expect(payload.input[0].content[1]).toMatchObject({
      type: "input_image",
      image_url: png,
    });
    expect(fetcher.mock.calls[1][0]).toContain("keyword=cotton+sheets");
    expect(
      (
        await discoveryPost(
          extensionRequest(p.token, {
            action: "discover",
            observation: {
              ...observation,
              imageDataUrl: "https://evil.example/frame.png",
            },
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("rejects uncertain or refused vision without manufacturing a product", async () => {
    configureLive();
    vi.stubEnv("ALONG_DISCOVERY_VISION", "true");
    vi.stubEnv("OPENAI_API_KEY", "fake-key");
    const p = await paired(),
      fetcher = vi.fn().mockResolvedValue(
        Response.json({
          status: "completed",
          output: [
            { content: [{ type: "refusal", refusal: "Cannot determine" }] },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = await (
      await discoveryPost(
        extensionRequest(p.token, {
          action: "discover",
          observation: { ...observation, imageDataUrl: png },
        }),
      )
    ).json();
    expect(result).toMatchObject({ mode: "unavailable", candidates: [] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
