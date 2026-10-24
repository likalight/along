import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getCatalog, validateCatalog, quoteOffer, eligibleOffers, microphoneArchive, resolveDelivery } from "../src/index.ts";
import type { Catalog } from "../src/types.ts";

test("source is retained verbatim with reproducible hash and active/archive separation", () => {
  const bytes = readFileSync(new URL("../sources/microphone-demo-data.md", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), microphoneArchive.sourceSha256);
  assert.equal(microphoneArchive.records.length, 50);
  const data = getCatalog();
  assert.equal(data.products.length, 24);
  assert.equal(data.offers.length, 48);
  assert.equal(data.products.filter(p => p.id.startsWith("MIC-")).length, 12);
  for (const product of data.products) assert.equal(data.offers.filter(o => o.productId === product.id).length, 2);
  assert.equal(data.products.some(p => p.id === "MIC-018"), false);
  assert.equal(microphoneArchive.records.find(p => p.id === "MIC-018")!.availability, "discontinued");
});

test("every scenario's cumulative revisions yield exactly its expected offers, including no-match", () => {
  const data = getCatalog();
  for (const scenario of data.scenarios) {
    const constraints = { ...scenario.constraints };
    for (const change of scenario.changes) {
      Object.assign(constraints, change.constraints);
      assert.deepEqual(eligibleOffers(data, constraints).map(q => q.offerId).sort(), [...change.expectedOfferIds].sort(), scenario.id);
    }
  }
});

test("same-variant cheap/late versus dearer/on-time and all setup costs are explicit", () => {
  const data = getCatalog();
  const a = data.offers.find(o => o.id === "MIC-044-A")!;
  const b = data.offers.find(o => o.id === "MIC-044-B")!;
  assert.equal(a.variantId, b.variantId);
  assert.equal(a.totalMinor, 13400);
  assert.equal(b.totalMinor, 14800);
  assert.equal(a.otherFeesMinor, 2000);
  assert.equal(a.setupHardware.length, 2);
  assert.ok(Date.parse(a.deliveryWindow.latest) > Date.parse(b.deliveryWindow.latest));
  assert.equal(resolveDelivery(1), "2026-10-25T18:00:00+08:00");
  assert.equal(resolveDelivery(10), "2026-11-03T18:00:00+08:00");
  assert.throws(() => resolveDelivery(-1));
  assert.throws(() => resolveDelivery(0.5));
});

test("reference price changes cannot turn research amounts into executable offers", () => {
  const data = getCatalog();
  const before = quoteOffer(data, "MIC-003-A", {hostConnection: "usb-a"}).totalMinor;
  const p = data.products.find(p => p.id === "MIC-003")!;
  p.referencePrice.amountMinor = 1;
  p.referencePrice.price_kind = "search_range_floor";
  assert.equal(quoteOffer(data, "MIC-003-A", {hostConnection: "usb-a"}).totalMinor, before);
  assert.equal(p.referencePrice.payableTotalMinor, null);
  assert.equal(quoteOffer(data, "MIC-003-A", {currency: "SGD", hostConnection: "usb-a"}).eligible, false);
});

test("unavailable products, unknown evidence, incompatible hardware and exact mattress limits stay visible", () => {
  const data = getCatalog();
  assert.ok(quoteOffer(data, "MIC-025-A", {hostConnection: "usb-a"}).conflicts.includes("UNAVAILABLE"));
  assert.ok(quoteOffer(data, "MIC-038-A", {hostConnection: "usb-c"}).conflicts.includes("UNAVAILABLE"));
  assert.ok(quoteOffer(data, "MIC-037-A", {hostConnection: "headphone-only"}).conflicts.includes("INCOMPATIBLE_HARDWARE"));
  assert.ok(quoteOffer(data, "MIC-037-A").conflicts.includes("HOST_CONNECTION_REQUIRED"));
  assert.equal(quoteOffer(data, "MIC-037-A", {hostConnection: "usb-c"}).eligible, true);
  assert.ok(quoteOffer(data, "BAG-004-A", {laptopInches: 14}).conflicts.includes("LAPTOP_FIT_UNKNOWN_OR_INCOMPATIBLE"));
  assert.ok(quoteOffer(data, "BED-001-A", {bedWidthIn:60, bedLengthIn:80, mattressDepthIn:12}).conflicts.includes("MATTRESS_DEPTH_UNKNOWN_OR_INCOMPATIBLE"));
  assert.ok(quoteOffer(data, "BED-003-A", {bedWidthIn:60, bedLengthIn:80, mattressDepthIn:14.8}).conflicts.includes("MATTRESS_DEPTH_UNKNOWN_OR_INCOMPATIBLE"));
  assert.ok(quoteOffer(data, "BED-005-A", {bedWidthIn:60, bedLengthIn:80, mattressDepthIn:12}).conflicts.includes("ESSENTIAL_PRODUCT_DETAILS_UNKNOWN"));
  assert.equal(data.products.find(p => p.id === "BAG-001")!.buyerMetrics.rating, null);
  assert.equal(data.products.find(p => p.id === "MIC-044")!.authoredFit!.measuredPerformance, false);
  assert.ok(data.products.every(p => p.video.status === "missing"));
});

test("quote fails closed on malformed totals, unsupported destination, cutoff, quantity, stale hardware", () => {
  const data = getCatalog();
  assert.throws(() => quoteOffer(data, "unknown"), /UNKNOWN_OFFER/);
  assert.equal(quoteOffer(data, "BAG-001-A", {}, {quantity: 2}).eligible, false);
  assert.equal(quoteOffer(data, "BAG-001-A", {}, {destination:"real-address"}).eligible, false);
  assert.equal(quoteOffer(data, "BAG-001-A", {}, {now:"2026-10-24T12:00:01+08:00"}).eligible, false);
  assert.equal(quoteOffer(data, "BAG-001-A", {deadline:"tomorrow"}).eligible, false);
  const offer = data.offers.find(o => o.id === "BAG-001-A")!;
  (offer as unknown as {shippingMinor:null}).shippingMinor = null;
  assert.equal(quoteOffer(data, offer.id).totalMinor, null);
  assert.equal(quoteOffer(data, offer.id).eligible, false);
  data.offers.find(o => o.id === "MIC-044-A")!.setupHardware = [];
  assert.ok(quoteOffer(data, "MIC-044-A", {hostConnection:"usb-c"}).conflicts.includes("MISSING_SETUP_HARDWARE"));
});

const corruptions: [string, (data: Catalog) => void][] = [
  ["duplicate product", d => { d.products[1].id = d.products[0].id; }],
  ["invalid offer product", d => { d.offers[0].productId = "NOT-REAL"; }],
  ["variant mismatch", d => { d.offers[0].variantId = "OTHER"; }],
  ["seller mismatch", d => { d.offers[0].sellerId = "NOT-REAL"; }],
  ["unknown evidence", d => { d.products[0].evidenceIds.push("MISSING"); }],
  ["cross-product evidence", d => { d.products[0].evidenceIds = d.products[1].evidenceIds; }],
  ["orphan evidence", d => { d.evidence[0].subjectId = "MISSING"; }],
  ["unassociated source", d => { d.evidence[0].sourceUrl = "https://example.com/wrong"; }],
  ["null mandatory money", d => { (d.offers[0] as unknown as {taxMinor:null}).taxMinor = null; }],
  ["undefined mandatory money", d => { delete (d.offers[0] as Partial<typeof d.offers[0]>).shippingMinor; }],
  ["fractional cents", d => { d.offers[0].unitPriceMinor = 0.5; }],
  ["negative cents", d => { d.offers[0].shippingMinor = -1; }],
  ["wrong total", d => { d.offers[0].totalMinor++; }],
  ["unsafe money", d => { d.offers[0].totalMinor = Number.MAX_SAFE_INTEGER + 1; }],
  ["hardware omitted", d => { d.offers.find(o => o.id === "MIC-044-A")!.setupHardware = []; }],
  ["stock negative erased", d => { d.offers.find(o => o.id === "MIC-025-A")!.availability = "in_stock"; }],
  ["reversed delivery", d => { d.offers[0].deliveryWindow.latest = "2026-10-24T01:00:00+08:00"; }],
  ["different destination", d => { d.offers[0].destination = "unverified-real-location"; }],
  ["missing return policy", d => { d.offers[0].returnTerms = ""; }],
  ["invented purchase period", d => { d.products[0].buyerMetrics.purchaseCountPeriod = "month"; }],
  ["missing source date", d => { d.evidence[0].checkedOn = ""; }],
  ["missing image product", d => { d.imageFixtures[0].productIds.push("MISSING"); }],
];
for (const [name, mutate] of corruptions) test(`validator rejects ${name}`, () => {
  const data = getCatalog(); mutate(data);
  assert.throws(() => validateCatalog(data));
});

test("fresh reset cannot inherit mutated fixture state", () => {
  const first = getCatalog();
  first.products[0].title = "mutated";
  first.products.find(p => p.id === "BAG-001")!.specs.laptopFitInches = 999;
  first.offers[0].totalMinor = 0;
  first.scenarios[0].changes.length = 0;
  const next = getCatalog();
  assert.notEqual(next.products[0].title, "mutated");
  assert.equal(next.products.find(p => p.id === "BAG-001")!.specs.laptopFitInches, 16);
  assert.ok(next.scenarios[0].changes.length > 0);
  validateCatalog(next);
});
