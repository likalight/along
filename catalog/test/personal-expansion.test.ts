import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { getCatalog, quoteOffer } from "../src/index.ts";
import { personalNonTechSource } from "../src/personal-nontech.ts";
import { attachSourcePhotos } from "../src/source-photos.ts";

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isAddition = (id: string) => /^(BAG|BED)-(?:02[5-9]|0[34]\d|050)$/.test(id);
test("the personal portion is 100 unique identities without changing the existing 148 products or 296 offers", () => {
  const data = getCatalog();
  const existing = data.products.filter(p => !isAddition(p.id));
  assert.equal(existing.length, 148);
  // Fingerprints of main's complete records, including audio, photos, reviews and source notices.
  assert.equal(fingerprint(existing), "817b1b09f28a321d59a94326a19cd74d1993ae2afe6f4036b8bc1c569848dbe5");
  assert.equal(fingerprint(data.offers.filter(o => !isAddition(o.productId))), "f3ce2c1d14880615feb00e0385bd0fb21818e963c673c382066408281f67e6ff");
  const normalizedUrl = (url: string) => url.toLowerCase().replace(/[?#].*$/, "").replace(/\/$/, "");
  for (const prefix of ["BAG", "BED"]) {
    const products = data.products.filter(p => p.id.startsWith(prefix));
    assert.deepEqual(products.map(p => p.id).sort(), Array.from({ length: 50 }, (_, n) => `${prefix}-${String(n + 1).padStart(3, "0")}`));
    assert.equal(new Set(products.map(p => normalizedUrl(p.sourceUrls[0]))).size, 50);
  }
});

test("approved additions retain source identity, dated facts, evidence, unknowns and authored offer amounts", () => {
  const data = getCatalog();
  assert.equal(personalNonTechSource.records.length, 52);
  assert.match(personalNonTechSource.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(new Set(personalNonTechSource.records.map(row => row.sourceId)).size, 52);
  for (const row of personalNonTechSource.records) {
    const p = data.products.find(p => p.id === row.product.id)!;
    assert.deepEqual(p.specs, row.product.specs);
    assert.deepEqual(p.buyerMetrics, row.product.buyerMetrics);
    assert.deepEqual(p.referencePrice, row.product.referencePrice);
    assert.equal(p.checkedOn, row.product.checkedOn);
    assert.equal(p.sourceAvailability, row.product.sourceAvailability);
    assert.deepEqual(p.sourceUrls, row.product.sourceUrls);
    for (const e of row.evidence) assert.deepEqual(data.evidence.find(candidate => candidate.id === e.id), e);
    assert.deepEqual(data.offers.filter(o => o.productId === p.id).map(o => o.unitPriceMinor), row.offerPrices);
    assert.ok(data.offers.filter(o => o.productId === p.id).every(o => o.classification === "proxy"));
    assert.doesNotMatch(p.demoReviews!.entries.map(r => r.body).join(" "), /\b(?:null|undefined)\b/);
    if (p.category === "bedsheet-sets" && (p.specs.includedPieces === null || p.specs.care === null)) {
      assert.ok(quoteOffer(data, `${p.id}-A`, { bedWidthIn: 60, bedLengthIn: 80, mattressDepthIn: 12 }).conflicts.includes("ESSENTIAL_PRODUCT_DETAILS_UNKNOWN"));
    }
  }
});

test("only approved additions may use explicit illustrations and cannot impersonate product photographs", () => {
  const data = getCatalog();
  for (const p of data.products.filter(p => isAddition(p.id))) {
    assert.equal(p.image.classification, "proxy");
    assert.match(p.image.source, /illustration/i);
    assert.equal(p.image.originalUrl, undefined);
    assert.equal(p.image.sourceUrl, undefined);
    assert.ok(!p.evidenceIds.includes(`PHOTO-${p.id}`));
  }
  const invalid = structuredClone(data.products.find(p => p.id === "BAG-025")!);
  invalid.image.classification = "snapshot";
  assert.throws(() => attachSourcePhotos([invalid]), /MISSING_SOURCE_PHOTO/);
  invalid.id = "BAG-999";
  invalid.image.classification = "proxy";
  assert.throws(() => attachSourcePhotos([invalid]), /MISSING_SOURCE_PHOTO/);
});
