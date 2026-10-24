/** Public integration contract v1. Money is integer SGD cents; null means UNKNOWN. */
export type Money = number;
export type Evidence = {
  id: string;
  subjectType: "product" | "seller";
  subjectId: string;
  source: string;
  sourceType: "fixture" | "merchant" | "review";
  classification: "proxy" | "snapshot" | "real";
  capturedAt: string | null;
  claim: string;
  rating: { value: number; count: number } | null;
};
export type Product = {
  id: string;
  category: string;
  name: string;
  variant: string;
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
  currency: "SGD";
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
  budgetMinor?: number;
  deliveryWithinDays?: number;
  category?: string;
  requiredSpecifications?: Record<string, string | number | boolean>;
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
};
export type Conflict = {
  code: string;
  message: string;
  offerId?: string;
  field?: string;
};
export type Quote = {
  product: Product;
  offer: Offer;
  quantity: number;
  currency: "SGD";
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
