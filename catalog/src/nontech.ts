import { emptyMetrics } from "./types.ts";
import type { Evidence, Json, Metrics, Product } from "./types.ts";

// Snapshot facts are independent of the fictional variant, image, and offer records.
// Source pages were inspected on this date; no live stock or destination check occurred.
const checkedOn = "2026-10-24";
type Row = {
  id: string;
  brand: string;
  model: string;
  sourceUrl: string;
  referencePriceMinor: number;
  priceKind: string;
  specs: Record<string, Json>;
  limitations: string[];
  rating?: number;
  reviewCount?: number;
  reviewParaphrase?: string;
};

const bagRows: Row[] = [
  {
    id: "BAG-001", brand: "Osprey", model: "Daylite Large Tote Pack",
    sourceUrl: "https://www.osprey.com/daylitetm-large-tote-pack",
    referencePriceMinor: 11000, priceKind: "from_price",
    specs: {
      dimensions: { unit: "cm", height: 37.5, width: 50, depth: 19, axisOrder: "manufacturer H/W/D" },
      capacityLitres: 26, expandedCapacityLitres: null, weightGrams: 722,
      material: "Recycled 300D polyester", carryModes: ["tote", "backpack"],
      compartments: ["padded laptop sleeve", "bottom shoe or dirty-towel section", "luggage sleeve"],
      laptopFitInches: 16, separateShoeCompartment: true,
      waterResistance: "Manufacturer states DWR treatment; waterproofness unverified",
    },
    limitations: ["Laptop diagonal is nominal, not a guarantee for every device.", "Neutral demo color is not a verified retail SKU."],
  },
  {
    id: "BAG-002", brand: "Osprey", model: "Daylite Tote Pack 20L",
    sourceUrl: "https://www.osprey.com/daylite-tote-pack-daylttotpks21-779?color=Tumbleweed+Yellow%2FTunnel+Vision&size=O%2FS",
    referencePriceMinor: 9500, priceKind: "from_price",
    specs: {
      dimensions: { unit: "cm", height: 21, width: 38, depth: 43, axisOrder: "manufacturer H/W/D" },
      dimensionCaveat: "Unusual axis labels retained from the source; do not infer internal fit.",
      capacityLitres: 20, expandedCapacityLitres: null, weightGrams: 534,
      material: "Recycled 300D polyester", carryModes: ["tote", "backpack"],
      compartments: ["padded laptop or reservoir sleeve", "bottle pockets", "internal mesh pocket", "luggage pass-through"],
      laptopFitInches: 14, separateShoeCompartment: null,
      waterResistance: "Manufacturer states DWR treatment; waterproofness unverified",
      sourceColor: "Tumbleweed Yellow/Tunnel Vision",
    },
    limitations: ["Separate shoe storage is unknown.", "Source dimensions have unusual axis order.", "Demo color differs from the linked retail variant."],
  },
  {
    id: "BAG-003", brand: "Osprey", model: "Daylite Messenger",
    sourceUrl: "https://www.osprey.com/daylitetm-messenger",
    referencePriceMinor: 8000, priceKind: "from_price",
    specs: {
      dimensions: { unit: "in", height: 16.93, width: 11.81, depth: 6.69, axisOrder: "manufacturer H/W/D" },
      capacityLitres: 12, expandedCapacityLitres: null, weightGrams: null,
      material: "Recycled 300D polyester", carryModes: ["shoulder", "hand carry"],
      compartments: ["laptop sleeve", "bottle pocket", "side zip pocket", "key clip", "buckle flap"],
      laptopFitInches: 14, separateShoeCompartment: null,
      waterResistance: "Manufacturer states DWR treatment; waterproofness unverified",
    },
    limitations: ["Empty weight and separate shoe storage were not captured.", "Neutral demo color is not a verified retail SKU."],
  },
  {
    id: "BAG-004", brand: "Osprey", model: "Daylite Duffel 30",
    sourceUrl: "https://www.osprey.com/daylitetm-duffel-30",
    referencePriceMinor: 8500, priceKind: "from_price",
    specs: {
      dimensions: { unit: "cm", height: 50, width: 33, depth: 24, axisOrder: "manufacturer H/W/D" },
      capacityLitres: 30, expandedCapacityLitres: null, weightGrams: 550,
      material: "Recycled 300D polyester ripstop", carryModes: ["backpack", "shoulder", "hand carry"],
      compartments: ["wide main opening", "end zip pocket", "side zip pocket", "padded bottom"],
      laptopFitInches: null, separateShoeCompartment: null,
      waterResistance: "Manufacturer states DWR treatment; waterproofness unverified",
    },
    limitations: ["Dedicated laptop protection and shoe separation are unverified.", "Neutral demo color is not a verified retail SKU."],
  },
  {
    id: "BAG-005", brand: "Osprey", model: "Daylite Expandable Travel Pack 26+6",
    sourceUrl: "https://www.osprey.com/daylitetm-expandable-travel-pack-26-6",
    referencePriceMinor: 11000, priceKind: "from_price",
    specs: {
      dimensions: { unit: "cm", height: 43, width: 33, depth: 16, axisOrder: "manufacturer H/W/D, unexpanded" },
      capacityLitres: 26, expandedCapacityLitres: 32, weightGrams: 840,
      material: "Recycled 300D polyester ripstop", carryModes: ["backpack", "hand carry"],
      compartments: ["tech sleeve", "bottle pockets", "luggage pass-through", "internal tie-down"],
      laptopFitInches: null, separateShoeCompartment: null,
      waterResistance: "Manufacturer states DWR treatment; waterproofness unverified",
    },
    limitations: ["Airline acceptance depends on the actual airline and packed dimensions.", "Exact laptop compatibility is unknown.", "Neutral demo color is not a verified retail SKU."],
  },
  {
    id: "BAG-006", brand: "Osprey", model: "Daylite Plus Driftshade Backpack",
    sourceUrl: "https://www.osprey.com/daylitetm-plus-driftshade-backpack",
    referencePriceMinor: 8500, priceKind: "from_price",
    specs: {
      dimensions: { unit: "cm", height: 48, width: 28, depth: 24, axisOrder: "manufacturer H/W/D" },
      capacityLitres: 20, expandedCapacityLitres: null, weightGrams: 610,
      material: "Recycled 600D heathered polyester", carryModes: ["backpack"],
      compartments: ["padded laptop or reservoir sleeve", "bottle pockets", "front pockets", "compression straps", "hipbelt"],
      laptopFitInches: 14, separateShoeCompartment: null,
      waterResistance: "Manufacturer states DWR treatment; waterproofness unverified",
    },
    limitations: ["Dedicated shoe separation was not established.", "Neutral demo color is not a verified retail SKU."],
  },
];

const ikeaCare = "Machine wash normal at max 60 C; tumble medium; no bleach; iron high; no dry cleaning. Maximum stated shrinkage 4%.";
const ikeaDimensions = {
  fittedWidthInches: 60, fittedLengthInches: 80,
  flatWidthInches: 90, flatLengthInches: 104,
  pillowcaseWidthInches: 20, pillowcaseLengthInches: 30,
  includedPieces: { fitted: 1, flat: 1, pillowcases: 2 },
  sizeMarket: "US Queen", care: ikeaCare,
};
const beddingRows: Row[] = [
  {
    id: "BED-001", brand: "IKEA", model: "DVALA sheet set",
    sourceUrl: "https://www.ikea.com/us/en/p/dvala-sheet-set-white-70577531/",
    referencePriceMinor: 2999, priceKind: "observed_page",
    specs: {
      ...ikeaDimensions, articleNumber: "705.775.31", color: "white",
      material: "cotton", compositionLabel: "100% cotton", composition: [{ fiber: "cotton", percent: 100 }],
      weave: null, threadCount: 152, maxMattressDepthInches: 10,
      depthCaveat: "Source also states 25 cm; 10-inch field is the product measurement-table value.",
    },
    limitations: ["Do not infer compatibility from the Queen label alone.", "Listed maximum mattress depth excludes deeper mattresses."],
    rating: 3.6, reviewCount: 247,
    reviewParaphrase: "Some reviewers praise value and post-wash softness; others report roughness or a loose fit.",
  },
  {
    id: "BED-002", brand: "IKEA", model: "NATTJASMIN sheet set",
    sourceUrl: "https://www.ikea.com/us/en/p/nattjasmin-sheet-set-white-00601153/",
    referencePriceMinor: 5999, priceKind: "observed_page",
    specs: {
      ...ikeaDimensions, articleNumber: "006.011.53", color: "white",
      material: "cotton/lyocell", compositionLabel: "60% cotton, 40% lyocell",
      composition: [{ fiber: "cotton", percent: 60 }, { fiber: "lyocell", percent: 40 }],
      weave: "sateen", threadCount: 310, maxMattressDepthInches: 15,
    },
    limitations: ["Reported mattress-fit experiences vary.", "Fabric composition does not guarantee cooling."],
    rating: 4.3, reviewCount: 47,
    reviewParaphrase: "Some reviewers praise smoothness; others describe inconsistent fitted-sheet fit.",
  },
  {
    id: "BED-003", brand: "IKEA", model: "ULLVIDE sheet set",
    sourceUrl: "https://www.ikea.com/us/en/p/ullvide-sheet-set-white-90577511/",
    referencePriceMinor: 4999, priceKind: "observed_page",
    specs: {
      ...ikeaDimensions, articleNumber: "905.775.11", color: "white",
      material: "cotton/lyocell", compositionLabel: "85% cotton, 15% lyocell",
      composition: [{ fiber: "cotton", percent: 85 }, { fiber: "lyocell", percent: 15 }],
      weave: "percale", threadCount: 200, maxMattressDepthInches: 14.625,
      depthCaveat: "Conservative descriptive limit 14 5/8 inches; measurement table rounds to 15.",
    },
    limitations: ["Conservative depth limit is retained where source fields disagree.", "No cooling guarantee."],
    rating: 4, reviewCount: 41,
    reviewParaphrase: "Inspected comments praise colors and smooth feel; no recurring complaint was established in the captured excerpt.",
  },
  {
    id: "BED-004", brand: "IKEA", model: "SOLFIBBLA sheet set",
    sourceUrl: "https://www.ikea.com/us/en/p/solfibbla-sheet-set-white-green-stripe-60615835/",
    referencePriceMinor: 3999, priceKind: "observed_page",
    specs: {
      ...ikeaDimensions, articleNumber: "606.158.35", color: "white green/stripe",
      material: "cotton", compositionLabel: "100% cotton", composition: [{ fiber: "cotton", percent: 100 }],
      weave: null, pattern: "yarn-dyed stripes", threadCount: 118, maxMattressDepthInches: 10,
    },
    limitations: ["Product page reports 56 reviews; a category snapshot reported 58.", "Listed depth excludes deeper mattresses."],
    rating: 3.7, reviewCount: 56,
    reviewParaphrase: "Comfort feedback is mixed; individual complaints mention roughness, shrinkage, or damage on arrival.",
  },
  {
    id: "BED-005", brand: "Brooklinen", model: "Classic Percale Core Sheet Set",
    sourceUrl: "https://www.brooklinen.com/products/classic-core-sheet-set",
    referencePriceMinor: 19900, priceKind: "demo_estimate",
    specs: {
      sizeMarket: "US Queen", material: "long-staple cotton", compositionLabel: "100% cotton",
      composition: [{ fiber: "cotton", percent: 100 }], weave: "percale", threadCount: 270,
      fittedWidthInches: 60, fittedLengthInches: 80, maxMattressDepthInches: 16,
      preferredMattressDepthInches: { minimum: 12, maximum: 16 },
      flatWidthInches: 92, flatLengthInches: 104, pillowcaseWidthInches: 20, pillowcaseLengthInches: 27,
      includedPieces: null, care: null, color: null,
    },
    limitations: ["Exact retail package count, care, color, and selected-variant price were not captured.", "Demo package assumptions are separate from sourced specifications."],
  },
  {
    id: "BED-006", brand: "Brooklinen", model: "Washed European Linen Core Sheet Set",
    sourceUrl: "https://www.brooklinen.com/products/washed-linen-core-sheet-set",
    referencePriceMinor: 37900, priceKind: "demo_estimate",
    specs: {
      sizeMarket: "US Queen", material: "European flax linen", compositionLabel: "100% linen",
      composition: [{ fiber: "linen", percent: 100 }], weave: null, threadCount: null, fabricWeightGsm: 155,
      fittedWidthInches: 60, fittedLengthInches: 80, maxMattressDepthInches: null, pocketDepthInches: 15,
      flatWidthInches: 92, flatLengthInches: 104, pillowcaseWidthInches: 20, pillowcaseLengthInches: 27,
      includedPieces: null, care: null, color: null,
    },
    limitations: ["Size-guide pocket height is not an explicit mattress-fit guarantee.", "Exact retail package count, care, color, and selected-variant price were not captured."],
  },
];

const rows = [...bagRows, ...beddingRows];
const metrics = (row: Row): Metrics => row.reviewCount === undefined ? emptyMetrics() : {
  rating: row.rating ?? null,
  ratingCount: null,
  // Preserve the source label 'Total reviews' without assuming a distinct rating-vote count.
  writtenReviewCount: row.reviewCount,
  purchaseCount: null,
  purchaseCountPeriod: null,
  reviewScope: "Product-family aggregate includes other colors; exact-size grouping unverified. Count labelled Total reviews; ratingCount not separately exposed.",
};

export const nonTechProducts: Product[] = rows.map((row) => {
  const isBag = row.id.startsWith("BAG-");
  const hasPackageAssumption = row.brand === "Brooklinen";
  return {
    id: row.id,
    category: isBag ? "everyday-bags" : "bedsheet-sets",
    brand: row.brand, model: row.model,
    variantId: `${row.id}-DEMO`,
    title: `${row.brand} ${row.model} — ${isBag ? "one size / neutral demo color" : hasPackageAssumption ? "US Queen / white demo package" : `US Queen / ${row.specs.color}`}`,
    image: {
      url: `/catalog/images/${isBag ? "bag" : "bedding"}.svg`,
      alt: `${isBag ? "Bag" : "Bedding"} illustration; not a photograph of ${row.model}`,
      source: "Authored demo illustration", classification: "proxy",
    },
    specs: {
      ...row.specs,
      specificationClassification: "snapshot",
      demoVariant: {
        classification: "proxy",
        color: isBag ? "neutral demo color; not a verified retail SKU" : hasPackageAssumption ? "white, assumed for demo" : row.specs.color ?? null,
        includedPieces: hasPackageAssumption ? { fitted: 1, flat: 1, pillowcases: 2 } : null,
        packageAssumption: hasPackageAssumption ? "Four-piece demo package only; retail package count remains unknown." : null,
      },
    },
    limitations: row.limitations,
    evidenceIds: [`SRC-${row.id}`, `DEMO-${row.id}`, ...(row.reviewCount === undefined ? [] : [`REV-${row.id}`])],
    checkedOn, sourceUrls: [row.sourceUrl],
    referencePrice: { currency: "USD", amountMinor: row.referencePriceMinor, price_kind: row.priceKind, payableTotalMinor: null },
    sourceAvailability: "unknown",
    buyerMetrics: metrics(row),
    authoredFit: null,
    video: { status: "missing", reason: "No product-specific playable video with verified reuse/embed permission was curated; show missing media." },
  };
});

export const nonTechEvidence: Evidence[] = rows.flatMap((row) => {
  const evidence: Evidence[] = [
    {
      ...emptyMetrics(), id: `SRC-${row.id}`, subjectType: "product", subjectId: row.id,
      sourceUrl: row.sourceUrl, sourceType: row.brand === "IKEA" ? "merchant" : "manufacturer",
      checkedOn, classification: "snapshot",
      claim: "Product specifications transcribed into specs; unknown fields remain null. Reference prices are not payable offers and stock is unverified.",
    },
    {
      ...emptyMetrics(), id: `DEMO-${row.id}`, subjectType: "product", subjectId: row.id,
      sourceUrl: null, sourceType: "fixture", checkedOn, classification: "proxy",
      claim: row.id.startsWith("BAG-")
        ? "Neutral demo color and generic illustration are authored fixtures, not a verified retail color SKU or photograph."
        : row.brand === "Brooklinen"
          ? "White and four-piece package are demo assumptions only; retail package contents and selected-variant price remain unverified."
          : "Simulation uses the sourced Queen size, color, and package contents with an authored illustration and separate fictional seller offers.",
    },
  ];
  if (row.reviewCount !== undefined) evidence.push({
    ...metrics(row), id: `REV-${row.id}`, subjectType: "product", subjectId: row.id,
    sourceUrl: row.sourceUrl, sourceType: "review", checkedOn, classification: "snapshot",
    claim: `Paraphrase of inspected feedback, not a quotation: ${row.reviewParaphrase}`,
  });
  return evidence;
});
