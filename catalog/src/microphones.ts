import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { emptyMetrics } from "./types.ts";
import type { Evidence, Product } from "./types.ts";

export const activeAudioIds = ["MIC-001", "MIC-003", "MIC-009", "MIC-015", "MIC-020", "MIC-022", "MIC-025", "MIC-037", "MIC-038", "MIC-040", "MIC-044", "MIC-047"] as const;
type Row = Record<string, string>;

/** Decimal string -> cents, without binary floating point rounding. Reject ambiguous values. */
export function decimalToMinor(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error("INVALID_DECIMAL_MONEY");
  const [major, fraction = ""] = value.split(".");
  const result = BigInt(major) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("UNSAFE_MONEY");
  return Number(result);
}
function numberOrNull(value: string): number | null {
  if (value === "null") return null;
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error("INVALID_SOURCE_NUMBER");
  return Number(value);
}
function url(value: string): string | null {
  if (value === "null") return null;
  const found = value.match(/\]\((https:\/\/[^)]+)\)/)?.[1];
  if (!found) throw new Error("INVALID_SOURCE_URL");
  return found;
}
export function importMicrophones(source: string) {
  const lines = source.split(/\r?\n/);
  const tables: Row[][] = [];
  const cells = (line: string) => line.split("|").slice(1, -1).map(s => s.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("| id |")) continue;
    const headers = cells(lines[i]);
    if (!/^\|\s*---/.test(lines[i + 1] ?? "")) throw new Error("INVALID_TABLE_HEADER");
    const rows: Row[] = [];
    i += 2;
    while (i < lines.length && lines[i].startsWith("| MIC-")) {
      const values = cells(lines[i++]);
      if (values.length !== headers.length) throw new Error("SOURCE_COLUMN_MISMATCH");
      rows.push(Object.fromEntries(headers.map((header, n) => [header, values[n]])));
    }
    if (rows.length !== 50 || new Set(rows.map(r => r.id)).size !== 50) throw new Error("EXPECTED_50_UNIQUE_ROWS");
    tables.push(rows);
  }
  if (tables.length !== 3) throw new Error("EXPECTED_THREE_SOURCE_TABLES");
  const expected = Array.from({length: 50}, (_, i) => `MIC-${String(i + 1).padStart(3, "0")}`);
  if (tables.some(table => expected.some(id => !table.some(row => row.id === id)))) throw new Error("SOURCE_ID_MISMATCH");
  const notes = new Map(Array.from(source.matchAll(/^- \*\*(MIC-\d{3})[^\n]+?\*\* (.+)$/gm), m => [m[1], m[2].trim()]));
  if (notes.size !== 50) throw new Error("EXPECTED_50_VARIANT_NOTES");
  const records = tables[0].map(commercial => {
    const technical = tables[1].find(r => r.id === commercial.id)!;
    const reviews = tables[2].find(r => r.id === commercial.id)!;
    const count = numberOrNull(reviews.customer_review_count);
    const rating = numberOrNull(reviews.customer_rating_out_of_5);
    if (rating !== null && (rating < 0 || rating > 5)) throw new Error("INVALID_RATING");
    if (count !== null && !Number.isSafeInteger(count)) throw new Error("INVALID_REVIEW_COUNT");
    return {
      id: commercial.id, checkedOn: "2026-10-24", currency: "USD" as const,
      brand: commercial.brand, model: commercial["model / exact configuration"],
      referencePrice: { currency: "USD" as const, amountMinor: decimalToMinor(commercial.reference_price_usd),
        price_kind: commercial.price_kind, payableTotalMinor: null },
      availability: commercial.availability, review_scope: reviews.review_scope,
      productSource: url(commercial.product_source), reviewSource: url(reviews.review_source),
      referenceCustomerReviewCount: count,
      // Original table calls this review_count; rendered reviews are also individually rated.
      buyerMetrics: { ...emptyMetrics(), rating,
        writtenReviewCount: /Rendered customer reviews|Review count|review count/.test(reviews.review_scope) ? count : null,
        ratingCount: reviews.review_scope === "Rendered customer reviews" ? count : null,
        reviewScope: reviews.review_scope },
      technical: Object.fromEntries(Object.entries(technical).filter(([key]) =>
        !["id", "demo_cafe_fit", "demo_office_fit", "authored_assessment"].includes(key))),
      authoredFit: { demo_cafe_fit: numberOrNull(technical.demo_cafe_fit)!,
        demo_office_fit: numberOrNull(technical.demo_office_fit)!,
        assessment: technical.authored_assessment, measuredPerformance: false as const },
      feedbackParaphrase: reviews.inspected_customer_feedback === "Not captured." ? null : reviews.inspected_customer_feedback,
      variantNotes: notes.get(commercial.id)!,
      sourceRows: { commercial, technical, reviews }, executable: false,
    };
  });
  return { sourceSha256: createHash("sha256").update(source).digest("hex"),
    sourceFile: "sources/microphone-demo-data.md", independentlyReverified: false,
    notice: "Team-supplied research archive, not executable offers; USD only; no Singapore stock claim.",
    records };
}
export const microphoneArchive = importMicrophones(readFileSync(new URL("../sources/microphone-demo-data.md", import.meta.url), "utf8"));

// Explicit compatibility fixtures describe a supported path, not every possible hardware combination.
const compatibility: Record<string, { supportedHostConnections: string[]; requiredHardwareIds: string[] }> = {
  "MIC-001": { supportedHostConnections: ["usb-c"], requiredHardwareIds: [] },
  "MIC-003": { supportedHostConnections: ["usb-a"], requiredHardwareIds: [] },
  "MIC-009": { supportedHostConnections: ["usb-a"], requiredHardwareIds: [] },
  "MIC-015": { supportedHostConnections: ["usb-c"], requiredHardwareIds: [] },
  "MIC-020": { supportedHostConnections: ["usb-a"], requiredHardwareIds: ["usb-a-to-c-data-cable"] },
  "MIC-022": { supportedHostConnections: ["usb-a"], requiredHardwareIds: ["usb-a-to-c-data-cable"] },
  "MIC-025": { supportedHostConnections: ["usb-a"], requiredHardwareIds: [] },
  "MIC-037": { supportedHostConnections: ["usb-c"], requiredHardwareIds: ["usb-c-trs-mic-interface"] },
  "MIC-038": { supportedHostConnections: ["usb-c"], requiredHardwareIds: [] },
  "MIC-040": { supportedHostConnections: ["usb-c"], requiredHardwareIds: ["usb-c-data-cable"] },
  "MIC-044": { supportedHostConnections: ["usb-c"], requiredHardwareIds: ["usb-c-data-cable", "desktop-mic-stand"] },
  "MIC-047": { supportedHostConnections: ["usb-c"], requiredHardwareIds: ["usb-c-trs-mic-interface", "desktop-mic-stand"] },
};
export function buildAudio() {
  const products: Product[] = [], evidence: Evidence[] = [];
  for (const id of activeAudioIds) {
    const r = microphoneArchive.records.find(row => row.id === id)!;
    const specId = `SRC-${id}`, fitId = `FIT-${id}`, compatibilityId = `COMPAT-${id}`;
    const base = { ...emptyMetrics(), subjectType: "product" as const, subjectId: id, checkedOn: r.checkedOn };
    evidence.push({ ...base, id: specId, sourceUrl: r.productSource, sourceType: "merchant", classification: "snapshot",
      claim: `Imported source specifications and variant notes: ${r.variantNotes}` });
    evidence.push({ ...base, id: fitId, sourceUrl: null, sourceType: "authored", classification: "proxy", claim: r.authoredFit.assessment });
    evidence.push({ ...base, id: compatibilityId, sourceUrl: null, sourceType: "fixture", classification: "proxy",
      claim: "Bounded demo audio path; includes the declared setup hardware. Not a measured compatibility or dictation benchmark." });
    const evidenceIds = [specId, fitId, compatibilityId];
    if (r.reviewSource) {
      const reviewId = `REV-${id}`;
      evidenceIds.push(reviewId);
      evidence.push({ ...base, ...r.buyerMetrics, id: reviewId, sourceUrl: r.reviewSource,
        sourceType: "review", classification: "snapshot",
        claim: r.feedbackParaphrase ?? "Source aggregate/count captured; individual review text not captured." });
    }
    products.push({ id, category: "audio-accessories", brand: r.brand, model: r.model,
      variantId: `${id}-DEMO`, title: `${r.brand} ${r.model}`, checkedOn: r.checkedOn,
      image: { url: "/catalog/images/audio.svg", alt: "Generic demo audio illustration, not a photograph of this model",
        source: "Authored demo illustration", classification: "proxy" },
      specs: { ...r.technical, sourceVariant: r.model, compatibilityFixture: compatibility[id] },
      limitations: ["No measured café-dictation performance evidence.", r.technical.additional_hardware,
        "Compatibility paths are bounded demo fixtures; other paths are unknown."],
      evidenceIds, sourceUrls: [r.productSource!, ...(r.reviewSource ? [r.reviewSource] : [])],
      referencePrice: r.referencePrice, sourceAvailability: r.availability, buyerMetrics: r.buyerMetrics,
      authoredFit: r.authoredFit,
      video: { status: "missing", reason: "No permission-verified playable product video/excerpt was curated for this fixture." } });
  }
  return { products, evidence };
}
