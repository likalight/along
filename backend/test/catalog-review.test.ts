import { test } from "node:test";
import assert from "node:assert/strict";
import { getCatalog } from "../../catalog/src/index.ts";
import { buildAlongProfile } from "../src/along-catalog.ts";
import { catalog, eligibleOffers, quoteOffer, validateCatalog } from "../src/catalog.ts";
import { validateConstraints } from "../src/validation.ts";
import { catalogView, quoteView } from "../src/integration.ts";
import type { CatalogProfile, Constraints } from "../src/contracts.ts";

function quote(profile: CatalogProfile, id: string, constraints: Constraints = {}, quantity = 1, destination = profile.destination) {
  return quoteOffer(id, quantity, constraints, [], profile.catalog, destination);
}
const has = (result: ReturnType<typeof quote>, code: string) => result.conflicts.some(conflict => conflict.code === code);

test("#6: default backend retains the shared 24/48 catalog, all canonical provenance, nullable metrics and archive identities", () => {
  const expected = getCatalog();
  assert.equal(catalog.products.length, 24);
  assert.equal(catalog.offers.length, 48);
  assert.deepEqual(catalog.canonical, expected);
  validateCatalog(catalog);
  const exposed = catalogView(catalog);
  assert.deepEqual(exposed.products, expected.products);
  assert.deepEqual(exposed.offers, expected.offers);
  assert.deepEqual(exposed.evidence, expected.evidence);
  assert.deepEqual(exposed.sellers, expected.sellers);
  assert.deepEqual(exposed.knownLinks, expected.knownLinks);
  assert(!new Set<string>(exposed.products.map(product => product.category)).has("home-lighting"));
  assert(exposed.products.some(product => product.buyerMetrics?.writtenReviewCount === null));
  assert(exposed.products.every(product => product.referencePrice?.payableTotalMinor === null));
});

test("#8.1: unknown IDs, mismatched variants, unavailable stock, invalid quantities and currency conflicts are rejected", () => {
  const p = buildAlongProfile();
  assert.throws(() => quote(p, "NOT-AN-OFFER"), /UNKNOWN_OFFER/);
  assert(has(quote(p, "BAG-001-B", { variantId: "different-variant" }), "VARIANT_CONFLICT"));
  assert(has(quote(p, "MIC-025-A", { hostConnection: "usb-c" }), "UNAVAILABLE"));
  assert(has(quote(p, "MIC-038-A", { hostConnection: "usb-c" }), "UNAVAILABLE"));
  for (const quantity of [0, -1, 1.5, 2, NaN, Infinity]) {
    const result = quote(p, "BAG-001-B", {}, quantity);
    assert(!result.eligible);
    assert(has(result, "UNSUPPORTED_QUANTITY"));
    assert.equal(result.total, null, "Unpriced quantities cannot expose a payable total");
  }
  assert(has(quote(p, "BAG-001-B", { currency: "SGD" }), "CURRENCY_CONFLICT"));
  assert(has(quote(p, "BAG-001-B", {}, 1, "Singapore real address"), "UNSUPPORTED_DESTINATION"));
});

test("#8.2: reference prices stay separate, required hardware appears exactly once, and explicit tax completes the line items", () => {
  const p = buildAlongProfile();
  const result = quote(p, "MIC-044-A", { hostConnection: "usb-c" });
  assert(result.eligible);
  assert.equal(result.total, 13400);
  assert.equal(result.setupCost, 2000);
  assert.equal(result.tax, 0);
  assert.equal(result.otherFees, 0);
  assert.equal(result.subtotal + result.shipping! + result.otherFees! + result.setupCost! + result.tax!, result.total);
  assert.match(result.offer.setupConditions!, /usb-c-data-cable/);
  assert.match(result.offer.setupConditions!, /desktop-mic-stand/);
  assert.notEqual(result.product.canonical!.referencePrice.amountMinor, result.total);
  const publicQuote = quoteView(result);
  assert.equal(publicQuote.lineItemsMinor.tax, 0);
  assert("setupHardware" in publicQuote.offer);
  assert.equal(publicQuote.offer.setupHardware.length, 2);
});

test("#8.2: missing fees, inconsistent totals, missing hardware and changed display aliases fail closed", () => {
  for (const mutate of [
    (p: CatalogProfile) => { (p.catalog.canonical!.offers.find(o => o.id === "MIC-044-A")! as any).shippingMinor = null; },
    (p: CatalogProfile) => { p.catalog.canonical!.offers.find(o => o.id === "MIC-044-A")!.totalMinor = 1; },
    (p: CatalogProfile) => { p.catalog.canonical!.offers.find(o => o.id === "MIC-044-A")!.setupHardware = []; },
    (p: CatalogProfile) => { p.catalog.offers.find(o => o.id === "MIC-044-A")!.unitPrice = 1; },
    (p: CatalogProfile) => { p.catalog.offers.find(o => o.id === "MIC-044-A")!.uncertainties = []; },
  ]) {
    const p = buildAlongProfile();
    mutate(p);
    const result = quote(p, "MIC-044-A", { hostConnection: "usb-c" });
    assert(!result.eligible);
    assert(result.conflicts.some(conflict => ["INVALID_CATALOG", "CATALOG_ALIAS_MISMATCH"].includes(conflict.code)));
  }
});

test("#8.3: bag laptop fit and exterior dimensions use evidence, convert units and reject unknown or ambiguous measurements", () => {
  const p = buildAlongProfile();
  assert(quote(p, "BAG-001-B", { laptopInches: 16, bagMaxDimensionsCm: { height: 37.5, width: 50, depth: 19 } }).eligible);
  assert(has(quote(p, "BAG-001-B", { bagMaxDimensionsCm: { width: 49 } }), "BAG_DIMENSIONS_CONFLICT"));
  assert(has(quote(p, "BAG-004-B", { laptopInches: 14 }), "LAPTOP_FIT_UNKNOWN_OR_INCOMPATIBLE"));
  assert(has(quote(p, "BAG-001-B", { laptopInches: 17 }), "LAPTOP_FIT_UNKNOWN_OR_INCOMPATIBLE"));
  assert(has(quote(p, "BAG-002-B", { bagMaxDimensionsCm: { height: 100 } }), "BAG_DIMENSIONS_UNKNOWN"));
  assert(quote(p, "BAG-003-B", { bagMaxDimensionsCm: { height: 44, width: 31, depth: 18 } }).eligible);
  assert(has(quote(p, "BAG-003-B", { bagMaxDimensionsCm: { height: 42 } }), "BAG_DIMENSIONS_CONFLICT"));
  assert(has(quote(p, "BAG-005-B", { separateShoeCompartment: true }), "SHOE_COMPARTMENT_UNKNOWN_OR_INCOMPATIBLE"));
});

test("#8.3: exact bedding dimensions, conservative depth and essential package information are required", () => {
  const p = buildAlongProfile();
  const measurements = { bedWidthIn: 60, bedLengthIn: 80, mattressDepthIn: 12 };
  assert(quote(p, "BED-003-A", measurements).eligible);
  assert(has(quote(p, "BED-003-A"), "BED_MEASUREMENTS_REQUIRED"));
  assert(has(quote(p, "BED-003-A", { ...measurements, bedLengthIn: 75 }), "BED_DIMENSION_CONFLICT"));
  assert(has(quote(p, "BED-003-A", { ...measurements, mattressDepthIn: 15 }), "MATTRESS_DEPTH_UNKNOWN_OR_INCOMPATIBLE"));
  assert(has(quote(p, "BED-001-A", measurements), "MATTRESS_DEPTH_UNKNOWN_OR_INCOMPATIBLE"));
  assert(has(quote(p, "BED-005-A", measurements), "ESSENTIAL_PRODUCT_DETAILS_UNKNOWN"));
  assert(has(quote(p, "BED-003-A", { ...measurements, composition: "100% cotton" }), "COMPOSITION_CONFLICT"));
});

test("#8.3: audio requires an explicit compatible host and includes every required interface and cable", () => {
  const p = buildAlongProfile();
  assert(has(quote(p, "MIC-044-A"), "HOST_CONNECTION_REQUIRED"));
  assert(has(quote(p, "MIC-044-A", { hostConnection: "headphone-only" }), "INCOMPATIBLE_HARDWARE"));
  assert(quote(p, "MIC-044-A", { compatibility: { hostConnection: "USB-C" } }).eligible);
  assert(has(quote(p, "MIC-044-A", { hostConnection: "usb-c", compatibility: { hostConnection: "usb-a" } }), "CONFLICTING_COMPATIBILITY"));
  const interfaceOffer = p.catalog.canonical!.offers.find(offer => offer.setupHardware.some(item => item.id === "usb-c-trs-mic-interface"))!;
  assert(interfaceOffer);
  const product = p.catalog.canonical!.products.find(item => item.id === interfaceOffer.productId)!;
  const path = product.specs.compatibilityFixture as { supportedHostConnections: string[] };
  const result = quote(p, interfaceOffer.id, { hostConnection: path.supportedHostConnections[0] });
  assert(result.setupCost! >= 2000);
  assert.match(result.offer.setupConditions!, /microphone input/);
});

test("#8.4/6: deadline revisions recalculate the same-variant cheap/late versus fast/dearer trade-off and expose no-match conflicts", () => {
  const p = buildAlongProfile();
  const base: Constraints = { category: "everyday-bags", laptopInches: 14, separateShoeCompartment: true, budgetMinor: 15000 };
  const all = (constraints: Constraints) => eligibleOffers(constraints, 1, [], p.catalog, p.destination);
  assert.deepEqual(all(base).filter(q => q.eligible).map(q => q.offer.id), ["BAG-001-A", "BAG-001-B"]);
  const tomorrow = { ...base, deadline: "2026-10-25T18:00:00+08:00" };
  assert.deepEqual(all(tomorrow).filter(q => q.eligible).map(q => q.offer.id), ["BAG-001-B"]);
  const noMatch = all({ ...tomorrow, budgetMinor: 11000 });
  assert.equal(noMatch.filter(q => q.eligible).length, 0);
  assert(has(noMatch.find(q => q.offer.id === "BAG-001-A")!, "DELIVERY_CONFLICT"));
  assert(has(noMatch.find(q => q.offer.id === "BAG-001-B")!, "BUDGET_CONFLICT"));
  assert.equal(quote(p, "BAG-001-A").product.variantId, quote(p, "BAG-001-B").product.variantId);
  assert(quote(p, "BAG-001-B", { deliveryWithinDays: 1 }).eligible);
  assert(has(quote(p, "BAG-001-B", { deadline: "2026-10-24T18:00:00+08:00", deliveryWithinDays: 1 }), "DELIVERY_CONFLICT"));
});

test("#8.5: quote snapshot includes exact item/variant, seller, quantity, destination, timestamps, returns, hardware and uncertainty", () => {
  const p = buildAlongProfile();
  const result = quote(p, "MIC-044-B", { hostConnection: "usb-c" });
  assert(result.product.variantId);
  assert(result.offer.sellerName);
  assert.equal(result.quantity, 1);
  assert.equal(result.destination, p.destination);
  assert.match(result.offer.deliveryConditions, /2026-10-25T18:00:00\+08:00/);
  assert.match(result.offer.returnConditions, /30 days/);
  assert(result.offer.conditions.length > 0);
  assert(result.offer.uncertainties.length > 0);
  assert(result.offer.setupConditions);
  const original = structuredClone(result);
  p.catalog.canonical!.offers.find(offer => offer.id === "MIC-044-B")!.returnTerms = "Changed after snapshot";
  assert.deepEqual(result, original, "Quotes carry independent snapshots for immutable receipt storage");
});

test("#8: canonical constraint ingress rejects malformed measurements, unknown fields and date-only deadlines", () => {
  validateConstraints({ category: "everyday-bags", budgetMinor: 15000, laptopInches: 14, bagMaxDimensionsCm: { height: 45, width: 50 }, deadline: "2026-10-25T18:00:00+08:00" });
  for (const constraints of [{ bagMaxDimensionsCm: { width: -1 } }, { bagMaxDimensionsCm: { diameter: 20 } }, { bagMaxDimensionsCm: {} },
    { hostConnection: " " }, { deadline: "2026-10-25" }, { mattressDepthIn: Infinity }, { laptopInches: 0 }, { minimumCapacityL: "25" }, { budgetMinor: 1.5 }])
    assert.throws(() => validateConstraints(constraints));
});
