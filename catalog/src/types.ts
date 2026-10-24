export type Json = null | string | number | boolean | Json[] | { [key: string]: Json };
export type Classification = "observed" | "snapshot" | "proxy";
export type Metrics = {
  rating: number | null; ratingCount: number | null; writtenReviewCount: number | null;
  purchaseCount: number | null; purchaseCountPeriod: string | null; reviewScope: string | null;
};
export type Evidence = Metrics & {
  id: string; subjectType: "product" | "seller"; subjectId: string;
  sourceUrl: string | null; sourceType: "manufacturer" | "merchant" | "review" | "authored" | "fixture";
  checkedOn: string; classification: Classification; claim: string; excerpt?: string;
  media?: { kind: "video"; url: string; creator: string; publishedOn: string | null; topic: string; permission: string };
};
export type Image = { url: string; alt: string; source: string; classification: Classification; sourceUrl?: string; originalUrl?: string; checkedOn?: string };
export type DemoReview = {
  id: string; author: string; rating: number; title: string; body: string;
  usedFor: string; postedOn: string; verifiedPurchase: false;
};
export type DemoReviews = {
  classification: "proxy"; disclosure: string; rating: number; ratingCount: number;
  writtenReviewCount: number; entries: DemoReview[];
};
export type Product = {
  demoReviews?: DemoReviews;
  provenance?: { kind: "source_snapshot" | "synthetic"; notice: string };
  id: string; category: "audio-accessories" | "everyday-bags" | "bedsheet-sets"; brand: string; model: string;
  variantId: string; title: string; image: Image; specs: Record<string, Json>;
  limitations: string[]; evidenceIds: string[]; checkedOn: string;
  sourceUrls: string[];
  referencePrice: { currency: "USD"; amountMinor: number | null; price_kind: string; payableTotalMinor: null };
  sourceAvailability: string; buyerMetrics: Metrics;
  authoredFit: { demo_cafe_fit: number; demo_office_fit: number; assessment: string; measuredPerformance: false } | null;
  video: { status: "missing"; reason: string } | { status: "available"; evidenceId: string };
};
export type Seller = { id: string; name: string; classification: "proxy"; evidenceIds: string[] };
export type Offer = {
  id: string; productId: string; variantId: string; sellerId: string; currency: "USD";
  unitPriceMinor: number; shippingMinor: number; otherFeesMinor: number; taxMinor: number; totalMinor: number;
  availability: "in_stock" | "out_of_stock" | "unavailable"; destination: string;
  deliveryWindow: { earliest: string; latest: string; timezone: string };
  orderCutoff: string; returnTerms: string; conditions: string[]; evidenceIds: string[]; classification: "proxy";
  setupHardware: { id: string; description: string; priceMinor: number; included: boolean }[];
};
export type Constraints = {
  category?: Product["category"]; currency?: string; budgetMinor?: number; deadline?: string;
  productId?: string; variantId?: string; candidateProductIds?: string[];
  laptopInches?: number; separateShoeCompartment?: boolean; minimumCapacityL?: number;
  bedWidthIn?: number; bedLengthIn?: number; mattressDepthIn?: number; composition?: string;
  hostConnection?: string; availableHardwareIds?: string[];
};
export type Scenario = {
  id: string; title: string; opening: string; now: string; timezone: string; destination: string;
  anchorProductId: string; constraints: Constraints;
  changes: { utterance: string; constraints: Constraints; expectedOfferIds: string[] }[];
};
export type ImageFixture = { id: string; image: Image; productIds: string[]; description: string; correctionExample: string };
export type Catalog = {
  version: string; currency: "USD"; checkedOn: string; scenarioNow: string; timezone: string; destination: string;
  products: Product[]; sellers: Seller[]; offers: Offer[]; evidence: Evidence[];
  scenarios: Scenario[]; knownLinks: { url: string; productId: string }[]; imageFixtures: ImageFixture[];
};
export const emptyMetrics = (): Metrics => ({
  rating: null, ratingCount: null, writtenReviewCount: null, purchaseCount: null, purchaseCountPeriod: null, reviewScope: null,
});
