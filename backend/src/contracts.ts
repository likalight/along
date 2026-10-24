/** Public integration contract v1. Money is integer minor units with explicit currency; null means UNKNOWN. */
export type Money = number;
export type Currency = "SGD" | "USD";
export type Evidence = {
  id: string;
  subjectType: "product" | "seller";
  subjectId: string;
  source: string;
  sourceType: "fixture" | "merchant" | "review";
  classification: "proxy" | "snapshot" | "real";
  capturedAt: string | null;
  claim: string;
  rating: { value: number | null; count: number | null } | null;
  sourceUrl?: string | null;
};
export type Product = {
  id: string;
  category: string;
  name: string;
  variant: string;
  brand?: string;
  description?: string;
  buyerSignals?: {
    averageRating: number | null;
    ratingCount: number | null;
    writtenReviewCount: number | null;
    purchaseCount: number | null;
    purchasePeriod: string | null;
    reviewSummary: string | null;
  };
  videos?: {
    id: string;
    url: string;
    creator: string;
    platform: string;
    publishedAt: string | null;
    topic: string;
    classification: "proxy" | "snapshot" | "real";
  }[];
  specifications: Record<string, string | number | boolean | null>;
  strengths: string[];
  limitations: string[];
  evidenceIds: string[];
  media: {
    url: string;
    alt: string;
    classification: "proxy" | "snapshot" | "real";
  }[];
};
export type Offer = {
  id: string;
  productId: string;
  sellerId: string;
  sellerName: string;
  currency: Currency;
  unitPrice: Money;
  shipping: Money | null;
  otherFees: Money | null;
  available: boolean;
  stock: number;
  deliveryDays: number | null;
  deliveryConditions: string;
  returnConditions: string;
  conditions: string[];
  uncertainties: string[];
  evidenceIds: string[];
  classification: "proxy" | "snapshot" | "real";
};
export type Constraints = {
  currency?: Currency;
  budgetMinor?: number;
  deliveryWithinDays?: number;
  category?: string;
  requiredSpecifications?: Record<string, string | number | boolean>;
};
export type ShoppingView = {
  stage: "solution-types" | "priorities" | "shortlist" | "evidence" | "offers";
  focusProductId: string | null;
  cards: {
    productId: string;
    role:
      | "best-value"
      | "best-quality"
      | "lowest-cost-suitable"
      | "close-match"
      | "discovery";
    rank: 1 | 2 | 3 | null;
    reason: string;
    compromise: string;
    evidenceIds: string[];
  }[];
  evidenceIds: string[];
  activeVideoId: string | null;
};
export type Selection = { offerId: string; quantity: number };
export type Proposal = {
  expectedRevision: number;
  turnId: string;
  needs?: string[];
  constraints?: Constraints;
  preferences?: string[];
  excludedProductIds?: string[];
  shortlist?: string[];
  selection?: Selection | null;
  evidenceIds?: string[];
  destination?: string;
  view?: ShoppingView;
};
export type Conflict = {
  code: string;
  message: string;
  offerId?: string;
  field?: string;
};
export type Quote = {
  destination: string;
  product: Product;
  offer: Offer;
  quantity: number;
  currency: Currency;
  subtotal: number;
  shipping: number | null;
  otherFees: number | null;
  total: number | null;
  eligible: boolean;
  conflicts: Conflict[];
};
export type Turn = {
  id: string;
  startedAt: string;
  status: "active" | "cancelled";
  approvalWindow: { summaryId: string; nonce: string } | null;
};
export type Summary = {
  id: string;
  revision: number;
  responseTurnId: string;
  quote: Quote;
  spokenText: string;
  textHash: string;
  displayed: boolean;
  playback: "pending" | "playing" | "complete" | "interrupted";
  approvalNonce: string | null;
};
export type Receipt = {
  id: string;
  simulated: true;
  label: "SIMULATED — no payment or real order";
  summaryId: string;
  summaryRevision: number;
  createdAt: string;
  quote: Quote;
};
export type Session = {
  id: string;
  revision: number;
  epoch: number;
  scenarioId: string | null;
  createdAt: string;
  expiresAt: string;
  destination: string;
  view: ShoppingView | null;
  needs: string[];
  constraints: Constraints;
  preferences: string[];
  excludedProductIds: string[];
  shortlist: string[];
  selection: Selection | null;
  evidenceIds: string[];
  turn: Turn | null;
  summary: Summary | null;
  receipt: Receipt | null;
  lastOutcome: string | null;
};
export type VoiceObservation = {
  expectedRevision: number;
  turnId: string;
  summaryId: string;
  approvalNonce: string;
  transcript: string;
  final: boolean;
  confidence: number;
  source: "shopper" | "assistant" | "background";
  echoDetected: boolean;
};
export type Scenario = {
  id: string;
  title: string;
  openingRequest: string;
  constraints: Constraints;
  anchorProductId: string;
  plannedChange: string;
  expectedOutcome: string;
};
export type SessionEvent = { type: "session.snapshot"; session: Session };

export type CatalogData = {
  version: string;
  currency: Currency;
  notice: string;
  products: Product[];
  offers: Offer[];
  evidence: Evidence[];
};
export type CatalogProfile = {
  catalog: CatalogData;
  scenarios: Scenario[];
  preparedImages: {
    id: string;
    url: string;
    classification: string;
    description: string;
    correctionExample: string;
  }[];
  destination: string;
};
