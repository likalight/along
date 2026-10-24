import assert from "node:assert/strict";
import { test } from "node:test";
import type { AgentProposal, InputEvent } from "@coupang/contract";
import { AuthoritativeSessionStore } from "./AuthoritativeSessionStore.js";
import { PRODUCTS } from "../fixtures/catalog.js";

function setup() {
  const store = new AuthoritativeSessionStore();
  const initial = store.create();
  const input: InputEvent = {
    sessionId: initial.sessionId,
    epoch: initial.epoch,
    baseRevision: initial.revision,
    eventId: "shopper-bags",
    turnId: "shopper-bags",
    modality: "text",
    text: "Show me bags under five thousand dollars",
    visibleRevision: initial.revision,
    visibleProductIds: [],
  };
  store.ingestInput(input);
  let event = 0;
  const apply = (
    action: AgentProposal["action"],
    payload: AgentProposal["payload"],
  ) =>
    store.apply({
      sessionId: initial.sessionId,
      epoch: initial.epoch,
      baseRevision: store.get(initial.sessionId)!.revision,
      eventId: `proposal-${++event}`,
      turnId: input.turnId,
      action,
      payload,
      evidenceIds: [],
    });
  const remembered = apply("set_constraints", {
    hardConstraints: {
      category: "bags",
      budgetMinor: 500000,
      maxDeliveryDays: 30,
      minimumCapacityL: 1,
    },
    needs: ["Everyday bag"],
    preferences: { color: "black" },
  });
  assert.equal(remembered.ok, true, remembered.reason);
  const ids = PRODUCTS.filter(
    (product) =>
      product.category === "bags" &&
      store
        .quotes(initial.sessionId, product.id)
        .some((quote) => quote.eligible),
  )
    .slice(0, 3)
    .map((product) => product.id);
  assert.equal(
    ids.length,
    3,
    "catalog needs three eligible bags for this regression",
  );
  const show = (productIds = ids) => {
    const result = apply("shortlist", {
      entries: productIds.map((productId) => ({
        productId,
        fitReason: "Everyday carry",
        compromise: "Check the fit",
      })),
    });
    assert.equal(result.ok, true, result.reason);
  };
  return { store, id: initial.sessionId, input, apply, ids, show };
}

test("excluding a visible bag atomically prunes presentation and preserves unrelated criteria and offer", () => {
  const h = setup();
  h.show();
  const [removed, other, selected] = h.ids;
  const quote = h.store.quotes(h.id, selected!).find((item) => item.eligible)!;
  assert.equal(h.apply("select_offer", { offerId: quote.offer.id }).ok, true);
  assert.equal(h.apply("focus", { productId: removed }).ok, true);
  assert.equal(h.apply("compare", { productIds: [removed, other] }).ok, true);
  h.store.core.propose(h.id, {
    expectedRevision: h.store.get(h.id)!.revision,
    turnId: h.input.turnId,
    displayOrder: [...h.ids].reverse(),
  });
  const before = structuredClone(h.store.core.get(h.id));
  const result = h.apply("set_constraints", { exclusions: [removed] });
  assert.equal(result.ok, true, result.reason);
  const after = h.store.core.get(h.id);
  assert.deepEqual(after.excludedProductIds, [removed]);
  assert.deepEqual(after.shortlist, [other, selected]);
  assert.deepEqual(after.displayOrder, [selected, other]);
  assert.deepEqual(
    after.view?.cards.map((card) => card.productId),
    [selected, other],
  );
  assert.equal(after.view?.focusProductId, null);
  assert.deepEqual(after.comparisonIds, [other]);
  assert.equal(after.stage, "shortlist");
  assert.deepEqual(after.constraints, before.constraints);
  assert.deepEqual(after.preferences, before.preferences);
  assert.deepEqual(after.needs, before.needs);
  assert.deepEqual(after.selection, before.selection);
  assert.deepEqual(after.receipt, before.receipt);
  assert.equal(after.revision, before.revision + 1);
});

test("excluding the last visible product clears evidence and focus and lets the backend invalidate its offer", () => {
  const h = setup();
  const productId = h.ids[0]!;
  h.show([productId]);
  const quote = h.store.quotes(h.id, productId).find((item) => item.eligible)!;
  assert.equal(h.apply("select_offer", { offerId: quote.offer.id }).ok, true);
  const evidenceId = PRODUCTS.find((product) => product.id === productId)!
    .evidenceIds[0]!;
  assert.equal(
    h.apply("show_evidence", { evidenceIds: [evidenceId] }).ok,
    true,
  );
  assert.equal(h.apply("prepare_summary", {}).ok, true);
  const before = structuredClone(h.store.core.get(h.id));
  const result = h.apply("set_constraints", { exclusions: [productId] });
  assert.equal(result.ok, true, result.reason);
  const after = h.store.core.get(h.id);
  assert.deepEqual(after.shortlist, []);
  assert.deepEqual(after.displayOrder, []);
  assert.deepEqual(after.comparisonIds, []);
  assert.deepEqual(after.view?.cards, []);
  assert.equal(after.view?.focusProductId, null);
  assert.deepEqual(after.evidenceIds, []);
  assert.deepEqual(after.view?.evidenceIds, []);
  assert.equal(after.stage, "understanding");
  assert.equal(after.selection, null);
  assert.equal(after.summary, null);
  assert.deepEqual(after.constraints, before.constraints);
  assert.deepEqual(after.receipt, before.receipt);
});

test("a rejected unknown exclusion leaves the authoritative presentation and criteria unchanged", () => {
  const h = setup();
  h.show();
  assert.equal(h.apply("focus", { productId: h.ids[0] }).ok, true);
  const before = structuredClone(h.store.core.get(h.id));
  const result = h.apply("set_constraints", {
    exclusions: [h.ids[0], "invented-product"],
  });
  assert.equal(result.ok, false);
  assert.match(result.reason!, /Unknown product/);
  assert.deepEqual(h.store.core.get(h.id), before);
});
