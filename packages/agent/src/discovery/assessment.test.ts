import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import type { Constraints } from "@concierge/backend/contracts";
import { DiscoveryReferenceSchema, type DiscoveryReference, type InputEvent } from "@coupang/contract";
import { assessDiscovery } from "./assessment.js";
import { isExplicitCatalogRequest } from "./reference.js";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import { SessionThread } from "../thread/SessionThread.js";
import { executeShoppingTool } from "../tools/shoppingTools.js";
import { openEndedLoop } from "../orchestrator/openEndedLoop.js";
import { VoiceOrchestrator } from "../orchestrator/VoiceOrchestrator.js";
import { FixtureVoiceAdapter } from "../voice/adapter.js";

const reference = (): DiscoveryReference => ({
  handoffId: randomUUID(), mode: "live",
  source: { url: "https://www.youtube.com/watch?v=test", title: "A bag in a video" },
  candidate: { id: "external", title: "Similar bag", url: "https://www.coupang.com/np/search?q=bag", linkKind: "search",
    price: { amount: 120, currency: "USD" }, match: "similar", reasons: ["Similar shape"], unknowns: ["Dimensions"] },
});

test("discovery accepts canonical product media paths without allowing local traversal or arbitrary folders", () => {
  for (const path of ["/catalog/images/products/BAG-001.webp", "/catalog/images/BAG-001.svg"])
    assert.equal(DiscoveryReferenceSchema.safeParse({ ...reference(), candidate: { ...reference().candidate, imageUrl: path } }).success, true);
  for (const path of ["/catalog/images/products/../secret.webp", "/catalog/images/products/%2e%2e/secret.webp", "/catalog/images/other/BAG-001.webp", "/catalog/images/products/BAG-001.webp?secret=1"])
    assert.equal(DiscoveryReferenceSchema.safeParse({ ...reference(), candidate: { ...reference().candidate, imageUrl: path } }).success, false);
});
function input(store: AuthoritativeSessionStore, id: string, text: string): InputEvent {
  const s = store.get(id)!;
  return { sessionId: id, epoch: s.epoch, baseRevision: s.revision, eventId: randomUUID(), turnId: randomUUID(),
    modality: "text", text, visibleRevision: s.revision, visibleProductIds: s.displayOrder };
}
function session(constraints: Constraints = {}, oldSelection = false) {
  const store = new AuthoritativeSessionStore(), id = store.create().sessionId;
  const first = input(store, id, "Find me a bag");
  store.ingestInput(first);
  let s = store.core.get(id);
  store.core.propose(id, { expectedRevision: s.revision, turnId: s.turn!.id, constraints,
    needs: ["Work and gym"], excludedProductIds: ["BAG-006"],
    ...(oldSelection ? { shortlist: ["BAG-001"], displayOrder: ["BAG-001"], selection: { offerId: "BAG-001-B", quantity: 1 } } : {}) });
  s = store.core.get(id);
  store.importDiscovery(id, reference(), { epoch: s.epoch, baseRevision: s.revision });
  return { store, id };
}

test("live assessment changes with saved needs without inventing fit, delivered cost or currency conversion", () => {
  const ref = reference();
  const evaluate = (constraints: Constraints) => assessDiscovery(ref, { constraints, needs: ["Work and gym"], quotes: () => [] });
  const small = evaluate({ currency: "USD", budgetMinor: 10000, laptopInches: 17, deliveryWithinDays: 1 });
  assert.equal(small.checks.find(c => c.key === "budget")?.status, "conflict");
  assert.equal(small.checks.find(c => c.key === "laptop")?.status, "unknown");
  assert.equal(small.checks.find(c => c.key === "delivery")?.status, "unknown");
  assert.match(small.nextQuestion, /compartment dimensions/);
  const larger = evaluate({ currency: "USD", budgetMinor: 15000, compatibility: { bedWidthInches: 60, bedLengthInches: 80 } });
  assert.equal(larger.checks.find(c => c.key === "budget")?.status, "unknown", "item-only price under budget is not a verified delivered total");
  assert.match(larger.nextQuestion, /mattress/);
  ref.candidate.price = { amount: 90000, currency: "KRW" };
  const foreign = evaluate({ currency: "USD", budgetMinor: 10000 });
  assert.equal(foreign.checks.find(c => c.key === "budget")?.status, "unknown");
  assert.match(foreign.checks.find(c => c.key === "budget")!.detail, /No currency conversion/);
  assert.ok(foreign.checks.every(c => c.status !== "match"));
  assert.equal(foreign.alternatives.length, 0);
});

test("demo catalog checks distinguish a fitting laptop from a conflict without verifying the external listing", () => {
  const ref = reference();
  ref.mode = "demo";
  ref.candidate.catalogProductId = "BAG-001";
  const fit = assessDiscovery(ref, { constraints: { laptopInches: 14 }, needs: [], quotes: () => [] });
  const conflict = assessDiscovery(ref, { constraints: { laptopInches: 17 }, needs: [], quotes: () => [] });
  assert.equal(fit.checks.find(c => c.key === "laptop")?.status, "match");
  assert.equal(conflict.checks.find(c => c.key === "laptop")?.status, "conflict");
  assert.match(conflict.checks.find(c => c.key === "laptop")!.detail, /not verification of the external listing/);
  assert.equal(conflict.checks.find(c => c.key === "identity")?.status, "unknown");
});

test("catalog alternatives are complete eligible quotes, exclude rejected products and recompute after requirements change", () => {
  const { store, id } = session({ category: "everyday-bags", currency: "USD", budgetMinor: 20000, minimumCapacityL: 20 });
  const assessment = store.get(id)!.discoveryAssessment!;
  assert.ok(assessment.alternatives.length > 0);
  for (const alternative of assessment.alternatives) {
    const quote = store.quotes(id, alternative.productId).find(q => q.offer.id === alternative.offerId)!;
    assert.ok(quote.eligible);
    assert.equal(alternative.total.amount, quote.total! / 100);
    assert.equal(alternative.total.currency, quote.currency);
    assert.notEqual(alternative.productId, "BAG-006");
  }
  assert.match(assessment.alternativesNotice, /simulated offers/);
  assert.equal(store.get(id)!.selectedOfferId, null);
  const turn = input(store, id, "My budget is now one dollar");
  store.ingestInput(turn);
  const current = store.core.get(id);
  store.core.propose(id, { expectedRevision: current.revision, turnId: turn.turnId, constraints: { ...current.constraints, budgetMinor: 100 } });
  assert.equal(store.get(id)!.discoveryAssessment!.alternatives.length, 0);
  assert.equal(store.get(id)!.discoveryAssessment!.checks.find(c => c.key === "budget")?.status, "conflict");
});

test("live tools inspect discovery but cannot apply old catalog choices or approve external items", () => {
  const { store, id } = session({ category: "everyday-bags", budgetMinor: 20000 }, true);
  const request = input(store, id, "Buy this one");
  store.ingestInput(request);
  request.baseRevision = store.get(id)!.revision;
  const thread = new SessionThread(store.get(id)!);
  const run = (name: string, args: unknown) => executeShoppingTool({ name, arguments: args, input: request, store, thread });
  assert.equal(run("inspect_discovery", {}).ok, true);
  assert.equal(run("inspect_product", { productId: "BAG-001" }).ok, true);
  for (const [name, args] of [
    ["prepare_summary", { productId: "BAG-001" }], ["prepare_summary", { productId: null, offerId: null }], ["select_offer", { offerId: "BAG-001-B" }],
    ["save", { productId: "BAG-001", rationale: "User said this" }],
    ["shortlist", { entries: [{ productId: "BAG-001", fitReason: "Same", compromise: "None" }] }],
  ] as const) {
    const result = run(name, args);
    assert.equal(result.ok, false, name);
    assert.match(result.reason!, /external discovery reference is active/i);
  }
  assert.equal(store.get(id)!.summaryId, null);
  assert.equal(store.get(id)!.selectedOfferId, "BAG-001-B", "the historical selection is preserved but cannot be used for the external reference");
  assert.equal(store.core.get(id).receipt, null);
});

test("live model sees assessment and tool facts with external narration independent of catalog products", async () => {
  const { store, id } = session({ category: "everyday-bags", currency: "USD", budgetMinor: 10000, compatibility: { laptopInches: 17 } });
  const request = input(store, id, "Will this fit my laptop?");
  store.ingestInput(request);
  request.baseRevision = store.get(id)!.revision;
  const thread = new SessionThread(store.get(id)!);
  thread.append({ type: "user_input", data: request });
  let count = 0;
  const result = await openEndedLoop({ input: request, thread, store, cancel: new AbortController().signal,
    config: { apiKey: "test", fetch: async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      assert.match(JSON.stringify(body.input), /discoveryAssessment/);
      assert.match(JSON.stringify(body.input), /17 inches/);
      assert.match(body.instructions, /External references cannot be purchased here/);
      if (++count === 1) return new Response(JSON.stringify({ output: [{ type: "function_call", name: "inspect_discovery", arguments: "{}", call_id: "inspect" }] }));
      const output = body.input.find((entry: any) => entry.type === "function_call_output");
      assert.match(output.output, /usable laptop compartment/);
      return new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
        heading: "Check the compartment", message: "Your 17-inch laptop still needs the exact compartment measurements checked.",
        segments: [{ text: "Your 17-inch laptop still needs the exact compartment measurements checked.", productId: null }],
      }) }] }] }));
    } },
  });
  assert.match(result.speakable[0].content, /17-inch laptop/);
  assert.ok(store.get(id)!.discoveryReference);
  assert.equal(store.get(id)!.approvalStatus, "not_prepared");
});

test("only an explicit shopper catalog return leaves discovery even with the live model enabled", async () => {
  assert.equal(isExplicitCatalogRequest("Is this in your catalog?"), false);
  assert.equal(isExplicitCatalogRequest("Why does the catalog say this fits?"), false);
  assert.equal(isExplicitCatalogRequest("Don't open the catalog"), false);
  assert.equal(isExplicitCatalogRequest("Compare my catalog options"), true);
  const { store, id } = session({ category: "everyday-bags" });
  let providerCalls = 0;
  const orchestrator = new VoiceOrchestrator(store, new FixtureVoiceAdapter(), { agent: {
    apiKey: "test", fetch: async () => { providerCalls++; throw new Error("Return must not require model permission"); },
  } });
  const result = await orchestrator.handleInput(input(store, id, "Back to my catalog"));
  assert.equal(providerCalls, 0);
  assert.equal(result.snapshot.discoveryReference, undefined);
  assert.equal(result.snapshot.discoveryAssessment, undefined);
  assert.deepEqual(result.snapshot.needs, ["Work and gym"]);
});

test("an explicit demo catalog bridge opens that exact product and still requires a fresh purchase review", async () => {
  const { store, id } = session({ category: "everyday-bags", budgetMinor: 20000 });
  const orchestrator = new VoiceOrchestrator(store, new FixtureVoiceAdapter(), { agent: {
    apiKey: "test", fetch: async () => { throw new Error("Explicit catalog product must not depend on model choice"); },
  } });
  const before = structuredClone(store.get(id)!.hardConstraints);
  const result = await orchestrator.handleInput(input(store, id, "Show catalog BAG-001"));
  assert.equal(result.snapshot.discoveryReference, undefined);
  assert.deepEqual(result.snapshot.displayOrder, ["BAG-001"]);
  assert.equal(result.snapshot.focusedProductId, "BAG-001");
  assert.deepEqual(result.snapshot.hardConstraints, before);
  assert.equal(result.snapshot.selectedOfferId, null);
  assert.equal(result.snapshot.summaryId, null);
  assert.equal(store.core.get(id).receipt, null);
  const request = input(store, id, "Buy this one");
  store.ingestInput(request);
  request.baseRevision = store.get(id)!.revision;
  const review = executeShoppingTool({ name: "prepare_summary", arguments: { productId: "BAG-001", offerId: null },
    input: request, store, thread: new SessionThread(store.get(id)!) });
  assert.equal(review.ok, true, review.reason);
  assert.ok(review.snapshot.summaryId);
  assert.equal(store.core.get(id).receipt, null, "opening or reviewing the demo product never approves its purchase");
});
