import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getCatalog, importMicrophoneIndex, legacyMicrophoneArchive, microphoneArchive, quoteOffer, eligibleOffers, validateCatalog, resolveKnownLink } from "../src/index.ts";
const indexSource = readFileSync(new URL("../sources/microphone-demo-data-100.md", import.meta.url), "utf8");

test("100-index joins original 50 details by ID without silently refreshing their facts", () => {
  for (const old of legacyMicrophoneArchive.records) {
    const imported = microphoneArchive.records.find(r => r.id === old.id)!;
    for (const key of Object.keys(old) as (keyof typeof old)[]) assert.deepEqual(imported[key], old[key], `${old.id}/${key}`);
    assert.equal(imported.detailStatus, "legacy_details_available");
  }
  const groups = new Set(microphoneArchive.records.map(r => r.representationGroup));
  assert.equal(groups.size, 4);
  for (const group of groups) assert.equal(microphoneArchive.records.filter(r => r.representationGroup === group).length, 25);
  const reversed = indexSource.replace(/(?:^\| MIC-.*\r?\n)+/gm, table => table.trimEnd().split("\n").reverse().join("\n") + "\n");
  assert.deepEqual(importMicrophoneIndex(reversed).records, microphoneArchive.records);
});

test("index importer rejects omissions, duplicate IDs, changed old facts and malformed review ratings", () => {
  assert.throws(() => importMicrophoneIndex(indexSource.replace(/^\| MIC-100.*\n/m, "")), /EXPECTED_100/);
  assert.throws(() => importMicrophoneIndex(indexSource.replace("| MIC-100 |", "| MIC-099 |")), /EXPECTED_100/);
  assert.throws(() => importMicrophoneIndex(indexSource.replace("| 19.00 | search_snapshot | in_stock |", "| 18.00 | search_snapshot | in_stock |")), /LEGACY_INDEX_DRIFT/);
  assert.throws(() => importMicrophoneIndex(indexSource.replace("| 2/5 / 0 |", "| 9/5 / 0 |")), /INVALID_INDEX_RATING/);
});

test("missing new source details and nuanced review counts remain explicit", () => {
  const data = getCatalog();
  for (const product of data.products.filter(p => p.id >= "MIC-051" && p.id <= "MIC-100")) {
    assert.equal(product.specs.detailStatus, "linked_file_not_supplied");
    assert.equal(product.authoredFit, null);
    assert.match(String(product.specs.connection), /Unknown/);
    assert.equal((product.specs.demoConfiguration as { classification: string }).classification, "proxy");
    assert.equal(product.checkedOn, "2026-10-25");
  }
  const air = data.products.find(p => p.id === "MIC-099")!;
  assert.equal(air.buyerMetrics.rating, 2);
  assert.equal(air.buyerMetrics.ratingCount, 1);
  assert.equal(air.buyerMetrics.writtenReviewCount, 0);
  const noReviews = data.products.find(p => p.id === "MIC-051")!;
  assert.equal(noReviews.buyerMetrics.rating, null);
  assert.equal(noReviews.buyerMetrics.writtenReviewCount, 0);
  assert.equal(noReviews.buyerMetrics.ratingCount, null);
  assert.equal(data.products.find(p => p.id === "MIC-100")!.buyerMetrics.rating, null);
});

test("every product has distinct disclosed demo reviews without contaminating source aggregates", () => {
  const data = getCatalog();
  const reviews = data.products.flatMap(p => p.demoReviews!.entries);
  assert.equal(reviews.length, 592);
  assert.equal(new Set(reviews.map(r => r.id)).size, reviews.length);
  for (const product of data.products) {
    assert.equal(product.demoReviews!.classification, "proxy");
    assert.match(product.demoReviews!.disclosure, /Fictional/);
    assert.ok(product.demoReviews!.entries.every(r => r.verifiedPurchase === false && r.body.length > 80));
    const evidence = data.evidence.find(e => e.id === `DEMO-REVIEWS-${product.id}`)!;
    assert.equal(evidence.classification, "proxy");
    assert.equal(evidence.rating, null);
    if (product.provenance!.kind === "synthetic") assert.ok(Object.values(product.buyerMetrics).every(v => v === null));
  }
  const headset = data.products.find(p => p.id === "MIC-003")!;
  assert.equal(headset.buyerMetrics.rating, null);
  assert.ok(headset.demoReviews!.rating > 0);
});

test("new non-tech categories use real manufacturer products and usable sourced constraints", () => {
  const data = getCatalog();
  assert.equal(data.products.filter(p => p.category === "everyday-bags").length, 24);
  const beds = data.products.filter(p => p.category === "bedsheet-sets");
  assert.equal(beds.length, 24);
  assert.ok(["US Twin", "US Full/Double", "US King", "US Queen"].every(size => beds.some(p => p.specs.sizeMarket === size)));
  assert.ok(new Set(beds.map(p => p.specs.compositionLabel)).size >= 4);
  const added = data.products.filter(p => /^(BAG|BED)-/.test(p.id) && Number(p.id.slice(4)) >= 7);
  assert.equal(added.length, 36);
  assert.ok(added.every(p => p.provenance?.kind === "source_snapshot" && p.sourceUrls[0].startsWith("https://www.") && p.specs.specificationClassification === "snapshot"));
  assert.equal(quoteOffer(data, "BAG-010-A", { category: "everyday-bags", laptopInches: 16, budgetMinor: 15000 }).eligible, true);
  assert.equal(quoteOffer(data, "BED-007-A", { bedWidthIn: 60, bedLengthIn: 80, mattressDepthIn: 8, composition: "100% cotton" }).eligible, true);
  assert.ok(eligibleOffers(data, { category: "everyday-bags", laptopInches: 14 }).length > 2);
  assert.ok(quoteOffer(data, "BED-013-A", { bedWidthIn: 60, bedLengthIn: 80, mattressDepthIn: 12 }).conflicts.includes("BED_DIMENSION_CONFLICT"));
});

test("catalogue JSON preserves unknown source fields without dropping undefined values", () => {
  const data = getCatalog();
  assert.deepEqual(JSON.parse(JSON.stringify(data)), data);
  for (const id of ["BED-012", "BED-014", "BED-016", "BED-022", "BED-023"]) {
    const product = data.products.find(p => p.id === id)!;
    assert.equal(product.specs.color, null, id);
    assert.equal(product.specs.material, null, id);
  }
});

test("expanded audio simulated bundles are quoteable, with all setup costs and negative stock preserved", () => {
  const data = getCatalog();
  for (const product of data.products.filter(p => p.category === "audio-accessories")) {
    const path = product.specs.compatibilityFixture as { supportedHostConnections: string[] };
    assert.ok(path.supportedHostConnections.length > 0, product.id);
    const quote = quoteOffer(data, `${product.id}-A`, { hostConnection: path.supportedHostConnections[0] });
    const negative = product.specs.demoPurchaseHold === true || ["out_of_stock", "unavailable", "discontinued", "discontinued_at_seller", "backordered", "special_order", "available_soon"].includes(product.sourceAvailability);
    assert.equal(quote.eligible, !negative, product.id);
    if (negative) assert.ok(quote.conflicts.includes("UNAVAILABLE"));
  }
  const broadcast = data.offers.find(o => o.id === "MIC-084-A")!;
  assert.equal(broadcast.setupHardware.some(h => h.id === "usb-c-xlr-audio-kit"), true);
  assert.equal(broadcast.otherFeesMinor, broadcast.setupHardware.reduce((sum, h) => sum + h.priceMinor, 0));
});

test("later recall notice preserves the source snapshot and withholds unverified offers", () => {
  const data = getCatalog();
  const product = data.products.find(p => p.id === "MIC-095")!;
  assert.equal(product.sourceAvailability, "unknown");
  assert.match(product.limitations.join(" "), /serial-number check/);
  assert.equal(data.evidence.find(e => e.id === "NOTICE-MIC-095")?.classification, "snapshot");
  assert.ok(data.offers.filter(o => o.productId === product.id).every(o => o.availability === "unavailable"));
});

test("shared family source links do not resolve to an arbitrary product variant", () => {
  const data = getCatalog();
  assert.deepEqual(resolveKnownLink("https://store.boyamic.com/products/by-m1", data.knownLinks), { status: "unsupported" });
});

test("validator rejects mixed synthetic/source provenance, altered demo averages and loss of review disclosure", () => {
  for (const change of [
    (data: ReturnType<typeof getCatalog>) => { data.products.find(p => p.id === "BAG-007")!.provenance!.kind = "synthetic"; },
    (data: ReturnType<typeof getCatalog>) => { data.products[0].demoReviews!.rating = 5; },
    (data: ReturnType<typeof getCatalog>) => { data.products[0].demoReviews!.disclosure = "Customer reviews"; },
    (data: ReturnType<typeof getCatalog>) => { data.products[0].demoReviews!.entries[0].verifiedPurchase = true as false; },
  ]) {
    const data = getCatalog(); change(data); assert.throws(() => validateCatalog(data));
  }
});
