import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  findWebListings,
  parseWebListings,
  webListingUrl,
} from "@/lib/discovery/web-listings";

const url = "https://www.coupang.com/vp/products/12345";
const listing = (overrides: Record<string, unknown> = {}) => ({
  title: "오스프리 데이라이트 가방",
  url,
  relevant: true,
  confidence: 0.9,
  ...overrides,
});
const response = (
  listings: unknown[] = [listing()],
  sources: unknown[] = [{ type: "url", url }],
) => ({
  status: "completed",
  output: [
    {
      type: "web_search_call",
      status: "completed",
      action: { type: "search", sources },
    },
    {
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{ type: "output_text", text: JSON.stringify({ listings }) }],
    },
  ],
});

beforeEach(() => {
  delete (globalThis as { __alongDiscovery?: unknown }).__alongDiscovery;
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("ALONG_DISCOVERY_WEB_MODEL", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("source-backed web listing validation", () => {
  it("returns selected sourced listings without manufacturing live data", () => {
    const found = parseWebListings(response());
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: "web-coupang-12345",
      title: "오스프리 데이라이트 가방",
      url,
      price: null,
      match: "similar",
      linkKind: "listing",
    });
    expect(found[0]).not.toHaveProperty("imageUrl");
    expect(found[0].reasons.join(" ")).toContain("web search");
    expect(found[0].unknowns.join(" ")).toContain("stale");
  });

  it("does not use an invented URL, an unselected source, or a changed variant", () => {
    expect(parseWebListings(response([listing()], []))).toEqual([]);
    expect(parseWebListings(response([listing({ url: url + "0" })]))).toEqual(
      [],
    );
    expect(parseWebListings(response([]))).toEqual([]);
    expect(
      parseWebListings(response([listing({ url: url + "?itemId=88" })])),
    ).toEqual([]);
  });

  it("strips tracking while retaining source-verified item and vendor IDs", () => {
    const source = url + "?vendorItemId=99&itemId=88&affiliate=tracking";
    const selected = url + "?itemId=88&vendorItemId=99&ref=search";
    expect(
      parseWebListings(
        response([listing({ url: selected })], [{ url: source }]),
      )[0].url,
    ).toBe(url + "?itemId=88&vendorItemId=99");
  });

  it.each([
    "http://www.coupang.com/vp/products/12345",
    "https://coupang.com/vp/products/12345",
    "https://www.coupang.com.evil.test/vp/products/12345",
    "https://www.coupang.com@evil.test/vp/products/12345",
    "https://evil.test@www.coupang.com/vp/products/12345",
    "https://www.coupang.com:444/vp/products/12345",
    "https://www.coupang.com/np/search?q=bag",
    "https://www.coupang.com/vp/products/no-id",
    "https://www.coupang.com/vp/products/012345",
    url + "/details",
    url + "#capture",
    url + "?itemId=88&itemId=99",
    url + "?itemId=invalid",
    url + "?vendorItemId=-1",
    url + "\n",
    "https://www.coupang.com\\@evil.test/vp/products/12345",
  ])(
    "rejects unsafe/non-listing URL %s even if included as a source",
    (bad) => {
      expect(webListingUrl(bad)).toBeNull();
      expect(
        parseWebListings(response([listing({ url: bad })], [{ url: bad }])),
      ).toEqual([]);
    },
  );

  it("rejects low relevance, invalid schema and duplicate product IDs", () => {
    expect(parseWebListings(response([listing({ relevant: false })]))).toEqual(
      [],
    );
    expect(parseWebListings(response([listing({ confidence: 0.74 })]))).toEqual(
      [],
    );
    expect(parseWebListings(response([listing({ confidence: 1.5 })]))).toEqual(
      [],
    );
    expect(parseWebListings(response([listing({ price: 123 })]))).toEqual([]);
    expect(
      parseWebListings(response([listing({ title: "a".repeat(301) })])),
    ).toEqual([]);
    expect(parseWebListings(response([listing(), listing()]))).toHaveLength(1);
    expect(
      parseWebListings(response(Array.from({ length: 4 }, () => listing()))),
    ).toEqual([]);
  });

  it("fails closed for incomplete searches, refusals, multiple texts and malformed output", () => {
    const incomplete = response();
    incomplete.output[0].status = "in_progress";
    expect(parseWebListings(incomplete)).toEqual([]);
    expect(parseWebListings({ ...response(), status: "incomplete" })).toEqual(
      [],
    );
    const malformed = response();
    malformed.output[1].content = [{ type: "output_text", text: "not JSON" }];
    expect(parseWebListings(malformed)).toEqual([]);
    const refused = response();
    refused.output[1].content = [{ type: "refusal", text: "refused" }];
    expect(parseWebListings(refused)).toEqual([]);
    const multiple = response();
    multiple.output.push(multiple.output[1]);
    expect(parseWebListings(multiple)).toEqual([]);
    expect(parseWebListings(null)).toEqual([]);
  });
});

describe("optional web enrichment request", () => {
  it("requires search and source evidence, using no-store and an 8-second timeout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(response()));
    vi.stubGlobal("fetch", fetchMock);
    const found = await findWebListings("네이비 토트 가방");
    expect(found).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("https://api.openai.com/v1/responses");
    expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({
      model: "gpt-4.1-mini",
      store: false,
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      tools: [{ type: "web_search", search_context_size: "low" }],
      text: { format: { type: "json_schema", strict: true } },
    });
    expect(JSON.parse(body.input).searchQuery).toBe(
      "site:coupang.com/vp/products/ 네이비 토트 가방",
    );
  });

  it("skips calls when key, model or query is unusable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await findWebListings("bag")).toEqual([]);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("ALONG_DISCOVERY_WEB_MODEL", "not a model");
    expect(await findWebListings("bag")).toEqual([]);
    vi.stubEnv("ALONG_DISCOVERY_WEB_MODEL", "gpt-4.1-mini");
    expect(await findWebListings("")).toEqual([]);
    expect(await findWebListings("x".repeat(121))).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces a six-request ceiling per minute", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Response.json(response()));
    vi.stubGlobal("fetch", fetchMock);
    for (let index = 0; index < 6; index++)
      expect(await findWebListings("bag")).toHaveLength(1);
    expect(await findWebListings("bag")).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    vi.advanceTimersByTime(60_001);
    expect(await findWebListings("bag")).toHaveLength(1);
  });

  it("returns an empty list for provider errors, oversized bodies and missing sources", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("provider error"))
      .mockResolvedValueOnce(new Response("bad", { status: 400 }))
      .mockResolvedValueOnce(
        new Response("{}", { headers: { "content-length": "999999" } }),
      )
      .mockResolvedValueOnce(new Response("x".repeat(256 * 1024 + 1)))
      .mockResolvedValueOnce(Response.json(response([listing()], [])));
    vi.stubGlobal("fetch", fetchMock);
    for (let index = 0; index < 5; index++)
      expect(await findWebListings("bag")).toEqual([]);
  });
});
