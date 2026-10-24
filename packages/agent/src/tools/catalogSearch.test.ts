import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCTS, OFFERS, EVIDENCE, audioSolutionType } from "../fixtures/catalog.js";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import { SessionThread } from "../thread/SessionThread.js";
import { executeShoppingTool } from "./shoppingTools.js";

type SearchPage = {
  products: Array<{ product: { id: string; category: string; demoReviews: unknown }; quotes: unknown[] }>;
  totalProducts: number; matchingProducts: number; nextOffset: number | null; offset: number; pageSize: number;
};

function searchContext() {
  const store = new AuthoritativeSessionStore();
  const s = store.create();
  const input = { sessionId: s.sessionId, epoch: s.epoch, baseRevision: s.revision, eventId: "catalog", turnId: "catalog-turn", modality: "text" as const, text: "Explore the catalog", visibleRevision: s.revision, visibleProductIds: [] };
  store.ingestInput(input);
  input.baseRevision = store.get(s.sessionId)!.revision;
  const thread = new SessionThread(store.get(s.sessionId)!);
  const run = (name: string, args: unknown) => executeShoppingTool({ name, arguments: args, input, store, thread });
  const search = (category: string | null, query: string | null, offset: number | null = null) => {
    const result = run("search_catalog", { category, query, offset });
    assert.equal(result.ok, true, result.reason);
    return result.data as SearchPage;
  };
  return { store, run, search };
}

test("catalog pages are complete, disjoint, deterministic and quote only returned products", () => {
  const { store, search } = searchContext();
  const quoted: string[] = [];
  const original = store.quotes.bind(store);
  store.quotes = (sessionId, productId) => {
    assert.ok(productId, "search must not quote the entire catalog");
    quoted.push(productId);
    return original(sessionId, productId);
  };
  const expected = PRODUCTS.filter(p => p.category === "bags").map(p => p.id).sort();
  const ids: string[] = [];
  let offset: number | null = null;
  do {
    const page = search("bags", null, offset);
    assert.equal(page.totalProducts, expected.length);
    assert.ok(page.products.length <= 12);
    assert.ok(page.products.every(row => row.product.category === "bags"));
    ids.push(...page.products.map(row => row.product.id));
    offset = page.nextOffset;
  } while (offset !== null);
  assert.deepEqual(ids, expected);
  assert.deepEqual(quoted, ids);
  assert.deepEqual(search("bags", null).products.map(row => row.product.id), expected.slice(0, 12));
  const beyond = search("bags", null, expected.length + 12);
  assert.equal(beyond.products.length, 0);
  assert.equal(beyond.nextOffset, null);
});

test("exact IDs and new family metadata make every catalog product reachable", () => {
  const { search, run } = searchContext();
  for (const category of ["audio", "bags", "bedding"] as const) {
    const product = PRODUCTS.filter(p => p.category === category).at(-1)!;
    const page = search(category, product.id);
    assert.equal(page.products[0].product.id, product.id);
    assert.equal(page.products[0].product.demoReviews === null, product.demoReviews === undefined);
    const inspected = run("inspect_product", { productId: product.id });
    assert.equal(inspected.ok, true, inspected.reason);
    const details = inspected.data as { product: { id: string; demoReviews?: unknown }; quotes: unknown[] };
    assert.equal(details.product.id, product.id);
    assert.deepEqual(details.product.demoReviews, product.demoReviews);
    assert.equal(details.quotes.length, 2);
  }
  assert.equal(audioSolutionType({ solutionType: "headset" }, "Evolve2 55"), "headset");
  assert.equal(audioSolutionType({ solutionType: "clip" }, "Tiny Wireless Set"), "clip_on");
  assert.equal(audioSolutionType({ solutionType: "desktop" }, "Studio Set"), "directional_desktop");
  assert.equal(audioSolutionType({ family: "Headsets and earbuds" }, "Unknown model"), "headset");
});

test("product inspection returns only its own evidence and referenced seller evidence", () => {
  const { run } = searchContext();
  const product = PRODUCTS.at(-1)!;
  const result = run("inspect_product", { productId: product.id });
  assert.equal(result.ok, true, result.reason);
  const data = result.data as { evidence: typeof EVIDENCE };
  const permitted = new Set(OFFERS.filter(o => o.productId === product.id).flatMap(o => o.evidenceIds));
  for (const evidence of data.evidence) {
    assert.ok(evidence.subjectType === "product" ? evidence.subjectId === product.id : permitted.has(evidence.id));
  }
  const ownEvidence = EVIDENCE.filter(e => e.subjectType === "product" && e.subjectId === product.id);
  assert.equal(data.evidence.filter(e => e.subjectType === "product").length, ownEvidence.length);
});

test("search rejects invalid offsets and preserves category scope for unmatched queries", () => {
  const { run, search } = searchContext();
  for (const offset of [-1, 0.5, 100001, "12"])
    assert.equal(run("search_catalog", { category: null, query: null, offset }).ok, false);
  const page = search("bags", "zzzz-nonexistent-model");
  assert.equal(page.matchingProducts, 0);
  assert.equal(page.totalProducts, PRODUCTS.filter(p => p.category === "bags").length);
  assert.ok(page.products.every(row => row.product.category === "bags"));
});
