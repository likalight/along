import test from "node:test";
import assert from "node:assert/strict";
import { getCatalog, microphoneArchive, quoteOffer } from "../src/index.ts";

test("NT-USB Mini offers support documented USB-C and USB-A computer paths", () => {
  const data = getCatalog();
  for (const hostConnection of ["usb-c", "usb-a"])
    for (const offerId of ["MIC-022-A", "MIC-022-B"])
      assert.equal(quoteOffer(data, offerId, { hostConnection }).eligible, true, `${offerId}/${hostConnection}`);
});

test("NT-USB Mini dual-host fixture has explicit cable hardware and retains its authored setup cost", () => {
  const data = getCatalog();
  for (const offerId of ["MIC-022-A", "MIC-022-B"]) {
    const offer = data.offers.find(candidate => candidate.id === offerId)!;
    assert.deepEqual(offer.setupHardware.map(hardware => hardware.id), ["usb-a-and-c-data-cable-kit"]);
    assert.match(offer.setupHardware[0].description, /USB-A.*USB-C.*USB-C.*USB-C/);
    assert.equal(offer.otherFeesMinor, 500);
    assert.equal(offer.totalMinor, offer.unitPriceMinor + offer.shippingMinor + 500);
    offer.setupHardware = [];
    for (const hostConnection of ["usb-c", "usb-a"])
      assert.ok(quoteOffer(data, offerId, { hostConnection }).conflicts.includes("MISSING_SETUP_HARDWARE"));
  }
});

test("documented NT-USB Mini paths do not bypass unknown or unsupported host checks", () => {
  const data = getCatalog();
  assert.ok(quoteOffer(data, "MIC-022-A").conflicts.includes("HOST_CONNECTION_REQUIRED"));
  for (const hostConnection of ["usb", "bluetooth", "headphone-only", "lightning"])
    assert.ok(quoteOffer(data, "MIC-022-A", { hostConnection }).conflicts.includes("INCOMPATIBLE_HARDWARE"));
  assert.ok(quoteOffer(data, "MIC-003-A", { hostConnection: "usb-c" }).conflicts.includes("INCOMPATIBLE_HARDWARE"));
});

test("manufacturer compatibility evidence supplements rather than rewrites the original archive", () => {
  const data = getCatalog();
  const product = data.products.find(candidate => candidate.id === "MIC-022")!;
  const original = microphoneArchive.records.find(candidate => candidate.id === "MIC-022")!;
  assert.equal(original.checkedOn, "2026-10-24");
  assert.equal(original.technical.connection, "USB-C");
  assert.equal(product.specs.connection, original.technical.connection);
  const evidence = data.evidence.find(candidate => candidate.id === "COMPAT-MFR-MIC-022")!;
  assert.equal(evidence.sourceType, "manufacturer");
  assert.equal(evidence.classification, "snapshot");
  assert.equal(evidence.checkedOn, "2026-10-25");
  assert.match(evidence.sourceUrl!, /^https:\/\/rode\.com\//);
  assert.match(evidence.claim, /USB-C.*USB-A/);
  assert.match(evidence.claim, /SC17.*USB-C.*USB-C/);
  assert.ok(product.evidenceIds.includes(evidence.id));
  assert.ok(product.sourceUrls.includes(evidence.sourceUrl!));
  assert.equal(data.evidence.find(candidate => candidate.id === "COMPAT-MIC-022")!.classification, "proxy");
});
