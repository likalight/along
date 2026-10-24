/** Normalizes the catalog team's single source; no new product facts or prices. */
import { agreedData } from "./agreed-data.generated.ts";
export { agreedData };
import type { CatalogProfile, Product, Offer, Evidence } from "./contracts.ts";
import { validateCatalog } from "./catalog.ts";

const d = agreedData;
const category = (v: string) =>
  ({ "everyday-bags": "bags", "bedsheet-sets": "bedding" })[v] ?? v;
const products: Product[] = d.products.map((p: any) => {
  const s = p.specs;
  const specs: Product["specifications"] = Object.fromEntries(
    Object.entries(s).map(([k, v]) => [
      k,
      typeof v === "object" && v !== null ? JSON.stringify(v) : v,
    ]),
  ) as any;
  if (p.category === "everyday-bags")
    Object.assign(specs, {
      laptopMaxInches: s.laptopFitInches,
      capacityLitres: s.capacityLitres,
    });
  if (p.category === "bedsheet-sets")
    Object.assign(specs, {
      widthInches: s.fittedWidthInches,
      lengthInches: s.fittedLengthInches,
      includedPieces: s.includedPieces
        ? JSON.stringify(s.includedPieces)
        : null,
      cotton100Percent: s.compositionLabel === "100% cotton",
    });
  return {
    id: p.id,
    category: category(p.category),
    brand: p.brand,
    name: p.title,
    variant: p.variantId,
    variantId: p.variantId,
    description: p.model,
    specifications: specs,
    strengths: p.authoredFit ? [p.authoredFit.assessment] : [],
    limitations: p.limitations,
    evidenceIds: p.evidenceIds,
    media: [p.image],
    videos: [],
    compatibility: {
      kind:
        p.category === "audio-accessories"
          ? "audio"
          : p.category === "everyday-bags"
            ? "bag"
            : "bedding",
      requiresKnownHost: p.category === "audio-accessories",
      hostConnections: s.compatibilityFixture?.supportedHostConnections,
    },
    buyerSignals: {
      averageRating: p.buyerMetrics.rating,
      ratingCount: p.buyerMetrics.ratingCount,
      writtenReviewCount: p.buyerMetrics.writtenReviewCount,
      purchaseCount: p.buyerMetrics.purchaseCount,
      purchasePeriod: p.buyerMetrics.purchaseCountPeriod,
      reviewSummary: p.buyerMetrics.reviewScope,
    },
  };
});
const offers: Offer[] = d.offers.map((o: any) => {
  const days = Math.round(
    (Date.parse(o.deliveryWindow.latest.slice(0, 10)) -
      Date.parse(d.scenarioNow.slice(0, 10))) /
      86400000,
  );
  return {
    id: o.id,
    productId: o.productId,
    variantId: o.variantId,
    sellerId: o.sellerId,
    sellerName: d.sellers.find((s: any) => s.id === o.sellerId).name,
    currency: o.currency,
    unitPrice: o.unitPriceMinor,
    shipping: o.shippingMinor,
    otherFees: o.otherFeesMinor + o.taxMinor,
    setupCost: 0,
    setupConditions:
      "Required setup hardware is included in the other-fees line: " +
      JSON.stringify(o.setupHardware),
    available: o.availability === "in_stock",
    stock: o.availability === "in_stock" ? 1 : 0,
    destination: o.destination,
    deliveryDays: days,
    deliveryWindow: {
      latestOffsetDays: days,
      latestAt: o.deliveryWindow.latest,
      scenarioNow: d.scenarioNow,
      timeZone: d.timezone,
    },
    deliveryConditions: `Synthetic arrival ${o.deliveryWindow.latest}; order cutoff ${o.orderCutoff}; fixed demo clock ${d.scenarioNow}.`,
    returnConditions: o.returnTerms,
    conditions: o.conditions,
    uncertainties: ["No live stock, shipping or tax verification."],
    evidenceIds: o.evidenceIds,
    classification: o.classification,
  };
});
const evidence: Evidence[] = d.evidence.map((e: any) => ({
  id: e.id,
  subjectType: e.subjectType,
  subjectId: e.subjectId,
  source: e.reviewScope ?? e.sourceType,
  sourceUrl: e.sourceUrl,
  sourceType: ["fixture", "merchant", "review"].includes(e.sourceType)
    ? e.sourceType
    : "merchant",
  classification: e.classification === "observed" ? "real" : e.classification,
  capturedAt: e.checkedOn,
  claim: e.claim,
  rating: e.rating === null ? null : { value: e.rating, count: e.ratingCount },
}));
export const agreedProfile: CatalogProfile = {
  catalog: {
    version: d.version,
    currency: "USD",
    notice:
      "Canonical team catalog. Source snapshots are separate from synthetic one-item USD seller offers. Fixed demo clock; no real order or Singapore inventory claim.",
    products,
    offers,
    evidence,
  },
  destination: d.destination,
  clock: { now: d.scenarioNow, timeZone: d.timezone },
  knownLinks: Object.fromEntries(
    d.knownLinks.map((x: any) => [x.url, x.productId]),
  ),
  preparedImages: d.imageFixtures.map((x: any) => ({
    id: x.id,
    url: x.image.url,
    classification: x.image.classification,
    description: x.description,
    correctionExample: x.correctionExample,
  })),
  scenarios: d.scenarios.map((s: any) => ({
    id: s.id,
    title: s.title,
    openingRequest: s.opening,
    anchorProductId: s.anchorProductId,
    constraints: {
      category: category(s.constraints.category),
      currency: "USD",
    },
    plannedChange: s.changes.map((x: any) => x.utterance).join(" "),
    expectedOutcome:
      "Apply stated constraints without importing scenario assumptions into shopper consent.",
  })),
};
validateCatalog(agreedProfile.catalog);
