/** Contract-v1 projection. The shell owns transport, microphone, attachments and cancellation. */
export type View =
  | "opening"
  | "understanding"
  | "solution_types"
  | "buying_priorities"
  | "shortlist"
  | "comparison"
  | "evidence"
  | "saved_choice"
  | "offers"
  | "summary"
  | "receipt"
  | "recovery";
export type Category = "audio" | "bags" | "bedsheets";
export type Classification = "observed" | "snapshot" | "proxy";
export type Product = {
  id: string;
  category: Category;
  brand: string;
  model: string;
  variantId: string;
  title: string;
  image: {
    url: string;
    alt: string;
    source: string;
    classification: Classification;
  };
  specs: Record<string, string>;
  limitations: string[];
  evidenceIds: string[];
  solution?: "headset" | "clip" | "desktop";
  referencePriceMinor: number | null;
  availability: "in_stock" | "unknown" | "unavailable";
  classification: Classification;
};
export type Evidence = {
  id: string;
  subjectType: "product" | "seller";
  subjectId: string;
  sourceUrl: string | null;
  sourceType: string;
  checkedOn: string;
  classification: Classification;
  claim: string;
  excerpt?: string;
  rating?: number | null;
  ratingCount?: number | null;
  writtenReviewCount?: number | null;
  purchaseCount?: number | null;
  purchaseCountPeriod?: string | null;
  reviewScope?: string;
  media?: {
    url: string | null;
    captionsUrl: string | null;
    title: string;
    creator: string;
    takeaway: string;
  };
};
export type Offer = {
  id: string;
  productId: string;
  variantId: string;
  sellerId: string;
  currency: string;
  unitPriceMinor: number | null;
  shippingMinor: number | null;
  otherFeesMinor: number | null;
  /** Zero means no additional setup cost; null means required hardware is not yet priced. */
  requiredSetupMinor: number | null;
  availability: "in_stock" | "unknown";
  destination: string;
  deliveryWindow: { latestOffsetDays: number | null };
  returnTerms: string;
  conditions: string[];
  evidenceIds: string[];
  classification: Classification;
};
export type Annotation = {
  role: string;
  fitReason: string;
  compromise: string;
  rank?: 1 | 2 | 3;
};
export type CanvasSession = {
  sessionId: string;
  epoch: number;
  revision: number;
  needs: string[];
  hardConstraints: Record<string, string>;
  preferences: string[];
  exclusions: string[];
  shortlistIds: string[];
  displayOrder: string[];
  focusedProductId: string | null;
  comparisonIds: string[];
  savedItems: { id: string; rationale: string }[];
  selectedOfferId: string | null;
  view: View;
  evidenceIds: string[];
  attachmentIds: string[];
  category: Category | null;
};
/** Presentation is supplied with the accepted snapshot, never inferred from client-side timers. */
export type Presentation = {
  heading: string;
  message: string;
  annotations: Record<string, Annotation>;
  solution?: Product["solution"];
  priority?: "value" | "quality" | "cost";
  reference?: { url: string; alt: string; classification: Classification };
};
export type Snapshot = CanvasSession & { canvas: Presentation };
export type AcceptedEvent = {
  sessionId: string;
  epoch: number;
  eventId: string;
  turnId: string;
  revision: number;
  type: "session.updated";
  snapshot: Snapshot;
};
export type ShopperIntent = {
  text: string;
  modality: "voice" | "text";
  visibleRevision: number;
  visibleProductIds: string[];
};
export type MediaEvent = {
  sessionId: string;
  epoch: number;
  turnId: string;
  revision: number;
  playbackId: string;
  type: "video.started" | "video.stopped";
  reason?: "ended" | "stopped" | "failed" | "navigation";
  takeaway?: string;
};
export type CanvasData = {
  products: Product[];
  evidence: Evidence[];
  offers: Offer[];
};

export function acceptEvent(
  current: Snapshot,
  event: AcceptedEvent,
  expectedTurnId?: string,
): Snapshot {
  if (expectedTurnId && event.turnId !== expectedTurnId) return current;
  if (
    event.type !== "session.updated" ||
    event.sessionId !== current.sessionId ||
    event.snapshot.sessionId !== current.sessionId
  )
    return current;
  if (
    event.epoch !== event.snapshot.epoch ||
    event.revision !== event.snapshot.revision
  )
    return current;
  // Epoch changes require an explicit connect/reset by the shell, never an unsolicited event.
  if (event.epoch !== current.epoch || event.revision <= current.revision)
    return current;
  if (
    new Set(event.snapshot.displayOrder).size !==
    event.snapshot.displayOrder.length
  )
    return current;
  return event.snapshot;
}
export const deliveredTotal = (offer: Offer): number | null => {
  const parts = [
    offer.unitPriceMinor,
    offer.shippingMinor,
    offer.otherFeesMinor,
    offer.requiredSetupMinor,
  ];
  if (
    !parts.every(
      (part): part is number =>
        part !== null && Number.isSafeInteger(part) && part >= 0,
    )
  )
    return null;
  const total = (parts as number[]).reduce((a, b) => a + b, 0);
  return Number.isSafeInteger(total) ? total : null;
};
export const money = (minor: number | null, currency = "USD") =>
  minor === null ? "Not available" : `${currency} ${(minor / 100).toFixed(2)}`;
export const deliveryDate = (days: number | null) =>
  days === null
    ? "Delivery not available"
    : new Intl.DateTimeFormat("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Singapore",
      }).format(new Date(Date.UTC(2026, 9, 24 + days)));
