import assert from "node:assert/strict";
import { test } from "node:test";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import { resolveReference } from "./router.js";
import { PRODUCTS } from "../fixtures/catalog.js";

test("spatial references never confuse rotating screen positions with product ordinals", () => {
  const snapshot = new AuthoritativeSessionStore().create();
  snapshot.displayOrder = ["BAG-001", "BAG-002", "BAG-003"];
  snapshot.focusedProductId = "BAG-003";
  for (const text of [
    "the left one",
    "the right one",
    "the middle one",
    "the center one",
    "the top one",
  ]) {
    const result = resolveReference(text, snapshot, snapshot.displayOrder);
    assert.equal(result.productId, undefined);
    assert.match(result.ambiguous!, /name or number/);
  }
  assert.equal(
    resolveReference("the first one", snapshot, snapshot.displayOrder)
      .productId,
    "BAG-001",
  );
  assert.equal(
    resolveReference("the second one", snapshot, snapshot.displayOrder)
      .productId,
    "BAG-002",
  );
});

test("color references use declared product colors rather than old product IDs", () => {
  const snapshot = new AuthoritativeSessionStore().create();
  snapshot.displayOrder = ["BAG-001", "BAG-006"];
  assert.equal(
    resolveReference("the navy one", snapshot, snapshot.displayOrder).productId,
    undefined,
  );
  // Reference resolution must be tested against explicit color facts, not the
  // current catalog's incidental mix of manufacturer color variants.
  const base = PRODUCTS.find((p) => p.category === "bags")!;
  const navy = {
    ...base,
    id: "TEST-NAVY",
    model: "Test Navy Bag",
    specs: { color: "navy" },
  };
  const other = {
    ...base,
    id: "TEST-OLIVE",
    model: "Test Olive Bag",
    specs: { color: "olive" },
  };
  const duplicate = {
    ...base,
    id: "TEST-NAVY-2",
    model: "Second Test Bag",
    specs: { color: "navy blue" },
  };
  const originalLength = PRODUCTS.length;
  PRODUCTS.push(navy, other, duplicate);
  try {
    snapshot.displayOrder = [other.id, navy.id];
    assert.equal(
      resolveReference("the navy one", snapshot, snapshot.displayOrder)
        .productId,
      navy.id,
    );
    assert.equal(
      resolveReference("the blue one", snapshot, snapshot.displayOrder)
        .productId,
      navy.id,
    );
    assert.equal(
      resolveReference(navy.model, snapshot, snapshot.displayOrder).productId,
      navy.id,
    );
    snapshot.displayOrder.push(duplicate.id);
    assert.match(
      resolveReference("the navy one", snapshot, snapshot.displayOrder)
        .ambiguous!,
      /More than one/,
    );
    assert.equal(
      resolveReference("the navy one", snapshot, [other.id]).productId,
      undefined,
    );
  } finally {
    PRODUCTS.splice(originalLength);
  }
});
