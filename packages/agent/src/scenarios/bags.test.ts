import assert from "node:assert/strict";
import { test } from "node:test";
import { FixtureSessionStore } from "../session/FixtureSessionStore.js";
import { completeTotalMinor, getProduct, offersForProduct } from "../fixtures/catalog.js";
import { buildBagDiscovery } from "./bags.js";

test("capacity ranking finds affordable bags before selecting its top three", () => {
  const snapshot = new FixtureSessionStore().create();
  snapshot.hardConstraints = { budgetMinor: 15000, currency: "USD" };
  snapshot.preferences = { bagPriority: "capacity" };
  const discovery = buildBagDiscovery(snapshot);
  assert.equal(discovery.narrowed.length, 3);
  for (const { productId } of discovery.narrowed) {
    assert(offersForProduct(productId).some(offer => {
      const total = completeTotalMinor(offer);
      return total !== null && total <= 15000 && offer.currency === "USD";
    }), `${productId} needs a complete offer within the accepted budget`);
  }
  const capacities = discovery.narrowed.map(({ productId }) => Number(getProduct(productId)!.specs.capacityLitres ?? 0));
  assert.deepEqual(capacities, [...capacities].sort((a, b) => b - a));
});

test("a budget with no qualifying bag stays empty instead of relaxing the ceiling", () => {
  const snapshot = new FixtureSessionStore().create();
  snapshot.hardConstraints = { budgetMinor: 1, currency: "USD" };
  snapshot.preferences = { bagPriority: "capacity" };
  assert.deepEqual(buildBagDiscovery(snapshot).narrowed, []);
  assert.equal(snapshot.hardConstraints.budgetMinor, 1);
});
