import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { buildAlongProfile } from "../src/along-catalog.ts";
import { quoteOffer } from "../src/catalog.ts";
import type { CatalogProfile, Constraints } from "../src/contracts.ts";
import { SessionStore } from "../src/store.ts";
import { validateConstraints } from "../src/validation.ts";

const quote = (profile: CatalogProfile, id: string, constraints: Constraints = {}) =>
  quoteOffer(id, 1, constraints, [], profile.catalog, profile.destination);
const has = (result: ReturnType<typeof quote>, code: string) => result.conflicts.some(conflict => conflict.code === code);
const errorCode = (code: string) => (error: unknown) => (error as { code?: string }).code === code;

test("shopper can handle one product's USB cabling without inventing a host connector", () => {
  const profile = buildAlongProfile();
  const strict = quote(profile, "MIC-067-A");
  assert(has(strict, "HOST_CONNECTION_REQUIRED"));
  for (const hostConnection of [undefined, "USB", "USB port", "USB-A", "USB Type-C"]) {
    const constraints: Constraints = { ...(hostConnection ? { hostConnection } : {}), shopperHandledConnectionFor: ["MIC-067"] };
    const original = structuredClone(constraints);
    const result = quote(profile, "MIC-067-A", constraints);
    assert.equal(result.eligible, true, `${hostConnection}: ${JSON.stringify(result.conflicts)}`);
    assert.equal(result.total, strict.total);
    assert.deepEqual(result.product, strict.product);
    assert.deepEqual(constraints, original, "Shopper responsibility must not manufacture a known connector");
  }
  assert(quote(profile, "MIC-067-A", { compatibility: { hostConnection: "USB-A" }, shopperHandledConnectionFor: ["MIC-067"] }).eligible);
});

test("shopper-handled cabling is product-specific, revocable and cannot erase a hard non-USB mismatch", () => {
  const profile = buildAlongProfile();
  assert(has(quote(profile, "MIC-044-A", { shopperHandledConnectionFor: ["MIC-067"] }), "HOST_CONNECTION_REQUIRED"));
  assert(has(quote(profile, "MIC-067-A", { shopperHandledConnectionFor: [] }), "HOST_CONNECTION_REQUIRED"));
  for (const hostConnection of ["bluetooth", "headphone-only", "3.5mm", "xlr"]) {
    const result = quote(profile, "MIC-067-A", { hostConnection, shopperHandledConnectionFor: ["MIC-067"] });
    assert(has(result, "INCOMPATIBLE_HARDWARE"), hostConnection);
  }
  const conflicting = quote(profile, "MIC-067-A", {
    hostConnection: "usb-a", compatibility: { hostConnection: "usb-c" }, shopperHandledConnectionFor: ["MIC-067"],
  });
  assert(has(conflicting, "CONFLICTING_COMPATIBILITY"));
  assert(has(quote(profile, "BED-003-A", { shopperHandledConnectionFor: ["BED-003"] }), "BED_MEASUREMENTS_REQUIRED"));
});

test("non-proxy offers cannot use shopper-handled connection allowance", () => {
  for (const classification of ["real", "snapshot"] as const) {
    const profile = buildAlongProfile();
    const source = profile.catalog.canonical!.offers.find(offer => offer.id === "MIC-067-A")!;
    Object.assign(source, { classification });
    profile.catalog.offers.find(offer => offer.id === source.id)!.classification = classification;
    const result = quote(profile, source.id, { shopperHandledConnectionFor: [source.productId] });
    assert.equal(result.eligible, false);
    assert(has(result, "HOST_CONNECTION_REQUIRED"), classification);
  }
});

test("shopper-handled connections retain budget, stock, setup hardware and price checks", () => {
  const profile = buildAlongProfile();
  const accepted: Constraints = { shopperHandledConnectionFor: ["MIC-044"] };
  const result = quote(profile, "MIC-044-A", accepted);
  assert.equal(result.eligible, true);
  assert.equal(result.setupCost, 2000);
  assert.equal(result.total, 13400);
  assert(has(quote(profile, "MIC-044-A", { ...accepted, budgetMinor: 100 }), "BUDGET_CONFLICT"));
  assert(has(quote(profile, "MIC-025-A", { shopperHandledConnectionFor: ["MIC-025"] }), "UNAVAILABLE"));
  const source = profile.catalog.canonical!.offers.find(offer => offer.id === "MIC-044-A")!;
  source.setupHardware[0].included = false;
  const missingSetup = quote(profile, source.id, accepted);
  assert.equal(missingSetup.eligible, false);
  assert(has(missingSetup, "MISSING_SETUP_HARDWARE"));
  source.shippingMinor = null as unknown as number;
  const incomplete = quote(profile, source.id, accepted);
  assert.equal(incomplete.eligible, false);
  assert(has(incomplete, "INCOMPLETE_TOTAL"));
});

test("connection reassurance reaches review but remains separate from purchase approval", () => {
  const store = new SessionStore(60_000, buildAlongProfile());
  let session = store.create().session;
  session = store.beginTurn(session.id, session.revision);
  session = store.propose(session.id, { expectedRevision: session.revision, turnId: session.turn!.id,
    constraints: { shopperHandledConnectionFor: ["MIC-067"] }, shortlist: ["MIC-067"],
    selection: { offerId: "MIC-067-A", quantity: 1 } }, { includeOffers: false }).session;
  session = store.summarize(session.id, session.revision, session.turn!.id);
  assert.equal(session.constraints.hostConnection, undefined);
  assert.equal(session.receipt, null);
  session = store.presentation(session.id, { epoch: session.epoch, eventId: randomUUID(),
    expectedRevision: session.revision, summaryId: session.summary!.id, summaryRevision: session.summary!.revision,
    turnId: session.summary!.responseTurnId, textHash: session.summary!.textHash, event: "displayed" });
  const approval = { epoch: session.epoch, expectedRevision: session.revision,
    summaryId: session.summary!.id, summaryRevision: session.summary!.revision,
    responseTurnId: session.summary!.responseTurnId, delegationId: "connection-review" };
  assert.throws(() => store.completeLiveDemo(session.id, { ...approval, transcript: "I have a dongle" }), errorCode("AMBIGUOUS_APPROVAL"));
  assert.equal(store.get(session.id).receipt, null);
  const complete = store.completeLiveDemo(session.id, { ...approval, transcript: "Please place this order" });
  assert.equal(complete.session.stage, "receipt");
  assert.deepEqual(complete.receipt.quote, session.summary!.quote, "Completion rechecks the same product-specific allowance");
});

test("revoking shopper-handled connection invalidates a prepared order", () => {
  const store = new SessionStore(60_000, buildAlongProfile());
  let session = store.create().session;
  session = store.beginTurn(session.id, session.revision);
  session = store.propose(session.id, { expectedRevision: session.revision, turnId: session.turn!.id,
    constraints: { shopperHandledConnectionFor: ["MIC-067"] }, shortlist: ["MIC-067"],
    selection: { offerId: "MIC-067-A", quantity: 1 } }, { includeOffers: false }).session;
  session = store.summarize(session.id, session.revision, session.turn!.id);
  session = store.propose(session.id, { expectedRevision: session.revision, turnId: session.turn!.id,
    constraints: { shopperHandledConnectionFor: [] } }, { includeOffers: false }).session;
  assert.equal(session.selection, null);
  assert.equal(session.summary, null);
  assert.equal(session.receipt, null);
});

test("connection acceptance ingress is a bounded list with an explicit empty revocation", () => {
  validateConstraints({ shopperHandledConnectionFor: ["MIC-067"] });
  validateConstraints({ shopperHandledConnectionFor: [] });
  for (const value of [true, "MIC-067", [""], [" "], [" MIC-067"], ["MIC-067", "MIC-067"], ["x".repeat(101)], Array.from({ length: 21 }, (_, i) => `MIC-${i}`)])
    assert.throws(() => validateConstraints({ shopperHandledConnectionFor: value }));
});
