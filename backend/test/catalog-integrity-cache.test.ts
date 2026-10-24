import assert from "node:assert/strict";
import test from "node:test";
import { alongProfile, buildAlongProfile } from "../src/along-catalog.ts";
import { eligibleOffers, quoteOffer } from "../src/catalog.ts";

test("the reusable canonical source is recursively immutable and returned quotes are independent", () => {
  const source = alongProfile.catalog.canonical!;
  const visited = new WeakSet<object>();
  const frozen = (value: unknown) => {
    if (value === null || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    assert.equal(Object.isFrozen(value), true);
    Object.values(value).forEach(frozen);
  };
  frozen(source);
  assert.throws(() => { source.offers[0].totalMinor = 1; }, TypeError);
  assert.throws(() => { source.products[0].evidenceIds.push("FORGED"); }, TypeError);
  const first = quoteOffer("BAG-001-A", 1);
  first.offer.canonical!.totalMinor = 1;
  assert.notEqual(quoteOffer("BAG-001-A", 1).offer.canonical!.totalMinor, 1);
});

test("mutable catalog integrity is rechecked after a successful quote and across a full offer batch", () => {
  const profile = buildAlongProfile();
  const args = [1, {}, [] as string[], profile.catalog, profile.destination] as const;
  assert.equal(quoteOffer("BAG-001-A", ...args).eligible, true);
  profile.catalog.canonical!.offers.find(o => o.id === "BED-050-B")!.totalMinor = 1;
  const next = quoteOffer("BAG-001-A", ...args);
  assert.equal(next.eligible, false);
  assert.equal(next.total, null);
  assert.ok(next.conflicts.some(c => c.code === "INVALID_CATALOG"));
  assert.ok(eligibleOffers({}, 1, [], profile.catalog, profile.destination).every(q => !q.eligible && q.total === null));
});

test("reusing immutable source validation never bypasses mutable presentation aliases", () => {
  const data = { ...alongProfile.catalog, offers: structuredClone(alongProfile.catalog.offers) };
  assert.equal(quoteOffer("BAG-001-A", 1, {}, [], data).eligible, true);
  data.offers.find(o => o.id === "BAG-001-A")!.unitPrice = 1;
  const next = quoteOffer("BAG-001-A", 1, {}, [], data);
  assert.equal(next.eligible, false);
  assert.ok(next.conflicts.some(c => c.code === "CATALOG_ALIAS_MISMATCH"));
});
