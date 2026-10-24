import { readFileSync } from "node:fs";
import { emptyMetrics } from "./types.ts";
import type { Evidence, Json, Product } from "./types.ts";
const checkedOn = "2026-10-25";
type BagRow = { id: string; brand: string; model: string; sourceUrl: string; imageUrl: string; priceMinor: number | null; priceKind: string; color: string | null; capacity: number | null; dimensions: Json; weightGrams: number | null; laptopFitInches: number | null; material: string | null; features: string[] };
type BedRow = { id: string; brand: string; model: string; sourceUrl: string; imageUrl: string; priceMinor: number | null; priceKind: string; color?: string | null; articleNumber: string; material?: string | null; compositionLabel: string; care: string; measurements: Record<string, string>; includedSummary: string | null; description: string; aggregate: { ratingValue: string; reviewCount: string } | null };
const bags = JSON.parse(readFileSync(new URL("../sources/real-bags-2026-10-25.json", import.meta.url), "utf8")) as BagRow[];
const beds = JSON.parse(readFileSync(new URL("../sources/real-bedding-2026-10-25.json", import.meta.url), "utf8")) as BedRow[];
const numeric = (s?: string): number | null => { const value = s?.match(/^\d+(?:\.\d+)?/)?.[0]; return value === undefined ? null : Number(value); };
function sourcedCarryModes(row: BagRow): string[] | null {
  const features = row.features.join(" ");
  const modes: string[] = [];
  if (/backpack(?:-style)?|backpack straps/i.test(features) || /Backpack/.test(row.model)) modes.push("backpack");
  if (/over-the-shoulder|shoulder strap included|adjustable shoulder strap/i.test(features)) modes.push("shoulder");
  if (/grab handle/i.test(features)) modes.push("hand carry");
  if (/worn on belt/i.test(features)) modes.push("belt");
  if (/Waist/.test(row.model)) modes.push("waist");
  if (/Wheeled/.test(row.model)) modes.push("wheeled");
  if (/Crossbody/.test(row.model)) modes.push("crossbody");
  return modes.length ? modes : null;
}
function modelStyle(row: BagRow): string | null {
  if (/Wheeled Duffel/.test(row.model)) return "wheeled duffel";
  if (/Duffel/.test(row.model)) return "duffel";
  if (/Tote/.test(row.model)) return "tote pack";
  if (/Sling/.test(row.model)) return "sling";
  if (/Crossbody/.test(row.model)) return "crossbody";
  if (/Waist/.test(row.model)) return "waist pack";
  if (/Roll Top/.test(row.model)) return "rolltop pack";
  if (/Backpack/.test(row.model)) return "backpack";
  if (/Travel Pack/.test(row.model)) return "travel pack";
  return null;
}
function base(row: BagRow | BedRow, category: Product["category"], specs: Record<string, Json>, limitations: string[]): Product {
  return { id: row.id, category, brand: row.brand, model: row.model, variantId: `${row.id}-DEMO`, title: `${row.brand} ${row.model}`,
    provenance: { kind: "source_snapshot", notice: "Real manufacturer product and photograph captured 2026-10-25. Seller offers and demo reviews are separate simulated fixtures; destination stock is unverified." },
    image: { url: `/catalog/images/products/${row.id}.webp`, alt: `${row.brand} ${row.model}, manufacturer product photograph; pictured color or configuration may vary`, source: "Manufacturer product photograph from the linked official source", classification: "snapshot", sourceUrl: row.sourceUrl, originalUrl: row.imageUrl, checkedOn },
    specs: { ...specs, specificationClassification: "snapshot" }, limitations,
    evidenceIds: [`SEED-${row.id}`, ...("aggregate" in row && row.aggregate ? [`REV-${row.id}`] : [])], checkedOn, sourceUrls: [row.sourceUrl],
    referencePrice: { currency: "USD", amountMinor: row.priceMinor, price_kind: row.priceKind, payableTotalMinor: null }, sourceAvailability: "unknown",
    buyerMetrics: "aggregate" in row && row.aggregate ? { ...emptyMetrics(), rating: Number(row.aggregate.ratingValue), writtenReviewCount: Number(row.aggregate.reviewCount),
      reviewScope: "Manufacturer product-family aggregate; other sizes and colors may be included. Rating-vote count not separately exposed." } : emptyMetrics(), authoredFit: null,
    video: { status: "missing", reason: "No permission-verified playable product video was curated." } };
}
export const seededNonTechProducts: Product[] = [
  ...bags.map(row => base(row, "everyday-bags", {
    color: row.color, dimensions: row.dimensions, capacityLitres: row.capacity, expandedCapacityLitres: null, weightGrams: row.weightGrams,
    material: row.material, compartments: row.features, laptopFitInches: row.laptopFitInches, separateShoeCompartment: null,
    carryModes: sourcedCarryModes(row), style: modelStyle(row),
    carryModesScope: "Only carry modes explicitly named in captured features or the model name are listed; absent modes remain unverified.",
    waterResistance: row.material?.includes("DWR") ? "Manufacturer lists DWR treatment; no waterproofness guarantee." : "Unknown", care: null,
    sourceColorScope: "Manufacturer hero photo; exact selected color SKU was not established.",
  }, ["Reference price is a model starting price; final color/size price and destination stock require confirmation.", "Laptop fit is nominal; internal dimensions and separate shoe storage remain unverified.", "Airline allowance depends on carrier and packed dimensions.", ...(row.model.includes("Jr.") ? ["Child-sized backpack; not an adult laptop bag."] : [])])),
  ...beds.map(row => {
    const m = row.measurements, family = row.model.split(" ")[0];
    const size = /Full\/Double$/.test(row.model) ? "US Full/Double" : /King$/.test(row.model) ? "US King" : /Twin$/.test(row.model) ? "US Twin" : "US Queen";
    const rawWidth = numeric(m["Fitted sheet width"]), rawLength = numeric(m["Fitted sheet length"]);
    // Some Twin pages transpose the measurement labels; the included-pieces text explicitly gives 38x74.
    const twinTranspose = size === "US Twin" && rawWidth !== null && rawLength !== null && rawWidth > rawLength && /fitted sheet 38x74/.test(row.includedSummary ?? "");
    const compositionLabel = row.compositionLabel.replace(/\s+%/g, "%");
    const composition = [...compositionLabel.matchAll(/(\d+(?:\.\d+)?)%\s+([^,;]+)/g)].map(match => ({ fiber: match[2].trim(), percent: Number(match[1]) }));
    const pillowcaseQuantity = numeric(m["Pillowcase quantity"]);
    const depth = family === "ULLVIDE" ? 14.625 : numeric(m["Max. mattress thickness"]);
    return base(row, "bedsheet-sets", {
      articleNumber: row.articleNumber, sizeMarket: size, color: row.color ?? null, material: row.material ?? null, compositionLabel, composition,
      weave: family === "NATTJASMIN" ? "sateen" : family === "ULLVIDE" ? "percale" : null, threadCount: numeric(m["Thread count"]),
      fittedWidthInches: twinTranspose ? rawLength : rawWidth, fittedLengthInches: twinTranspose ? rawWidth : rawLength,
      maxMattressDepthInches: depth, flatWidthInches: numeric(m["Sheet width"]), flatLengthInches: numeric(m["Sheet length"]),
      pillowcaseWidthInches: Math.min(numeric(m["Pillowcase width"]) ?? 0, numeric(m["Pillowcase length"]) ?? 0) || null,
      pillowcaseLengthInches: Math.max(numeric(m["Pillowcase width"]) ?? 0, numeric(m["Pillowcase length"]) ?? 0) || null,
      includedPieces: row.includedSummary && pillowcaseQuantity !== null ? { fitted: 1, flat: 1, pillowcases: pillowcaseQuantity } : null,
      care: row.care || null, sourceMeasurements: m, sourcePackageSummary: row.includedSummary,
      measurementCaveat: twinTranspose ? "Source measurement width/length are transposed; included-pieces text explicitly establishes fitted sheet 38x74 inches." : "Manufacturer dimensions retained; do not substitute nominal US mattress dimensions.",
      depthCaveat: family === "ULLVIDE" ? "Conservative 14 5/8-inch descriptive limit retained; measurement table rounds to 15 inches." : null,
    }, ["Use exact listed width, length and depth rather than assuming a size label guarantees fit.", "Source aggregate reviews may include other colors and sizes.", "Material does not establish a cooling guarantee.", ...(row.includedSummary ? [] : ["Exact package-piece count was not captured; ask before purchase."])]);
  }),
];
export const seededNonTechEvidence: Evidence[] = seededNonTechProducts.flatMap(p => [
  { ...emptyMetrics(), id: `SEED-${p.id}`, subjectType: "product" as const, subjectId: p.id, sourceUrl: p.sourceUrls[0], sourceType: "manufacturer" as const, checkedOn, classification: "snapshot" as const,
    claim: "Real manufacturer product identity, reference price, public specifications and source photograph captured from the linked official page; missing fields remain unknown. Offers and demo reviews are separate fixtures." },
  ...(p.buyerMetrics.rating === null ? [] : [{ ...p.buyerMetrics, id: `REV-${p.id}`, subjectType: "product" as const, subjectId: p.id, sourceUrl: p.sourceUrls[0], sourceType: "review" as const, checkedOn, classification: "snapshot" as const,
    claim: "Product-family aggregate from the manufacturer's structured product data. Individual customer review text is not reproduced; exact-size/color scope and separate rating-vote count are unverified." }]),
]);
