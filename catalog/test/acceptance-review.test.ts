import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { activeAudioIds, legacyAudioIds, legacyMicrophoneArchive, buildAudio, decimalToMinor, importMicrophones, microphoneArchive } from "../src/microphones.ts";
import { nonTechEvidence, nonTechProducts } from "../src/nontech.ts";
import { getCatalog, quoteOffer, validateCatalog } from "../src/index.ts";

const source = readFileSync(new URL("../sources/microphone-demo-data.md", import.meta.url), "utf8");

test("microphone joins remain correct when each source table has a different row order", () => {
  let tableNumber = 0;
  const reordered = source.replace(/(?:^\| MIC-.*\r?\n)+/gm, (table) => {
    const rows = table.trimEnd().split(/\r?\n/);
    const offset = ++tableNumber * 7;
    return [...rows.slice(offset), ...rows.slice(0, offset)].join("\n") + "\n";
  });
  assert.equal(tableNumber, 3);
  const imported = importMicrophones(reordered);
  assert.equal(imported.records.length, 50);
  for (const original of legacyMicrophoneArchive.records) {
    const actual = imported.records.find(row => row.id === original.id)!;
    assert.deepEqual(actual, original);
    assert.equal(actual.sourceRows.commercial.id, actual.sourceRows.technical.id);
    assert.equal(actual.sourceRows.technical.id, actual.sourceRows.reviews.id);
  }
});

test("ambiguous, fractional-cent, negative and overflowing monetary input cannot enter the catalog", () => {
  for (const invalid of ["1e3", "1,000.00", "-0.01", "0.001", "12.999", "NaN", "Infinity", " 19.00", "90071992547409.92"]) {
    assert.throws(() => decimalToMinor(invalid), Error, invalid);
  }
  assert.equal(decimalToMinor("57.99"), 5799);
  assert.equal(decimalToMinor("0.29"), 29);
  assert.equal(decimalToMinor("90071992547409.91"), Number.MAX_SAFE_INTEGER);
});

test("all100 audio IDs include negative-stock references and retain original rehearsal IDs", () => {
  assert.equal(activeAudioIds.length, 100);
  assert.deepEqual([...legacyAudioIds], ["MIC-001", "MIC-003", "MIC-009", "MIC-015", "MIC-020", "MIC-022", "MIC-025", "MIC-037", "MIC-038", "MIC-040", "MIC-044", "MIC-047"]);
  const { products, evidence } = buildAudio();
  assert.equal(products.find(p => p.id === "MIC-025")?.sourceAvailability, "unavailable");
  assert.equal(products.find(p => p.id === "MIC-038")?.sourceAvailability, "out_of_stock");
  assert.equal(microphoneArchive.records.find(p => p.id === "MIC-018")?.availability, "discontinued");
  assert.equal(microphoneArchive.records.find(p => p.id === "MIC-049")?.referencePrice.price_kind, "historical_page");
  for (const p of products) {
    assert.equal(p.referencePrice.payableTotalMinor, null);
    if (p.authoredFit) assert.equal(p.authoredFit.measuredPerformance, false);
    assert.equal(p.buyerMetrics.purchaseCount, null);
    assert.equal(p.buyerMetrics.purchaseCountPeriod, null);
  }
  for (const e of evidence.filter(e => e.sourceType === "authored")) assert.equal(e.rating, null);
});

test("unknown reviews stay unknown and paraphrases are never emitted as verbatim excerpts", () => {
  const { products, evidence } = buildAudio();
  const deity = products.find(p => p.id === "MIC-047")!;
  assert.equal(deity.buyerMetrics.rating, null);
  assert.equal(deity.buyerMetrics.ratingCount, null);
  assert.equal(deity.buyerMetrics.writtenReviewCount, 43);
  const headset = products.find(p => p.id === "MIC-003")!;
  assert.equal(headset.buyerMetrics.rating, null);
  assert.equal(headset.buyerMetrics.writtenReviewCount, null);
  for (const e of [...evidence, ...nonTechEvidence]) assert.equal(e.excerpt, undefined);
});

test("non-tech specifications keep dimensional units, physical fit limitations and unverified fields", () => {
  const bags = nonTechProducts.filter(p => p.category === "everyday-bags");
  const beds = nonTechProducts.filter(p => p.category === "bedsheet-sets");
  assert.equal(bags.length, 6);
  assert.equal(beds.length, 6);
  for (const bag of bags) {
    assert.ok(bag.specs.dimensions);
    for (const key of ["capacityLitres", "weightGrams", "material", "compartments", "laptopFitInches"]) assert.ok(key in bag.specs, `${bag.id}/${key}`);
  }
  assert.equal(bags.find(p => p.id === "BAG-003")!.specs.weightGrams, null);
  assert.equal(bags.find(p => p.id === "BAG-004")!.specs.laptopFitInches, null);
  assert.equal(bags.find(p => p.id === "BAG-004")!.specs.separateShoeCompartment, null);
  for (const bed of beds) {
    assert.equal(bed.specs.fittedWidthInches, 60);
    assert.equal(bed.specs.fittedLengthInches, 80);
    for (const key of ["maxMattressDepthInches", "composition", "includedPieces", "care"]) assert.ok(key in bed.specs, `${bed.id}/${key}`);
  }
  assert.equal(beds.find(p => p.id === "BED-003")!.specs.maxMattressDepthInches, 14.625);
  assert.equal(beds.find(p => p.id === "BED-006")!.specs.maxMattressDepthInches, null);
  assert.equal(beds.find(p => p.id === "BED-006")!.specs.pocketDepthInches, 15);
});

test("catalog validation rejects a known-link mapping unrelated to its product source", () => {
  const data = getCatalog();
  data.knownLinks[0].url = "https://unrelated.example/pretend-product";
  assert.throws(() => validateCatalog(data));
});

test("malformed fulfillment dates cannot create an eligible quote", () => {
  for (const target of ["cutoff", "earliest", "latest"] as const) {
    const data = getCatalog();
    const offer = data.offers.find(o => o.id === "BAG-001-A")!;
    if (target === "cutoff") offer.orderCutoff = "not-a-date";
    else offer.deliveryWindow[target] = "not-a-date";
    assert.equal(quoteOffer(data, offer.id).eligible, false, target);
  }
});

test("non-finite compatibility values are not treated as supported fit", () => {
  const data = getCatalog();
  data.products.find(p => p.id === "BAG-001")!.specs.laptopFitInches = NaN;
  assert.equal(quoteOffer(data, "BAG-001-A", { laptopInches: 14 }).eligible, false);
  assert.throws(() => validateCatalog(data));
});
