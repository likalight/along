import type { CanvasData, Presentation } from "../canvas/contracts";
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
export type VoiceStatus =
  | "ready"
  | "listening"
  | "thinking"
  | "speaking"
  | "paused"
  | "reconnecting"
  | "error";
export type Identity = {
  sessionId: string;
  epoch: number;
  turnId: string;
  revision: number;
};
export type Input = Omit<Identity, "revision"> & {
  eventId: string;
  baseRevision: number;
  modality: "voice" | "text" | "image" | "link";
  text?: string;
  attachmentId?: string;
  visibleRevision: number;
  visibleProductIds: string[];
};
export type Attachment = {
  id: string;
  kind: "image" | "link";
  name: string;
  url: string;
  classification: "proxy";
  status: "ready";
};
export type StageCard = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  command: string;
  kind: "solution" | "product" | "offer";
  price?: string;
};
export type Summary = {
  spokenText?: string;
  textHash?: string;
  responseTurnId?: string;
  id: string;
  revision: number;
  productId: string;
  variantId: string;
  offerId: string;
  sellerId: string;
  quantity: number;
  currency: "USD";
  lineItemsMinor: { items: number; shipping: number; otherFees: number };
  totalMinor: number;
  destination: string;
  deliveryWindow: string;
  conditions: string[];
  uncertainties: string[];
  presentationMode: "voice" | "text";
  status: "presenting" | "eligible" | "invalidated";
};
export type Session = {
  canvas?: Presentation;
  catalog?: CanvasData;
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
  history: { role: "user" | "assistant"; text: string }[];
  selectedOfferId: string | null;
  view: View;
  evidenceIds: string[];
  attachmentIds: string[];
  summaryId: string | null;
  approvalStatus: "not_prepared" | "presenting" | "eligible" | "approved";
  heading: string;
  message: string;
  cards: StageCard[];
  summary: Summary | null;
  receipt: { id: string; simulated: true; acceptedOrder: Summary } | null;
  category: "audio" | "bags" | "bedsheets" | null;
};
export type Accepted = Identity & {
  eventId: string;
  type: "session.updated";
  snapshot: Session;
};
export type Lifecycle = Identity & {
  playbackId: string;
  summaryId?: string;
  type:
    | "audio.started"
    | "audio.completed"
    | "audio.interrupted"
    | "turn.cancelled";
};
export interface SessionTransport {
  connect(sessionId?: string): Promise<Session>;
  send(input: Input, signal: AbortSignal): Promise<Accepted>;
  cancel(identity: Identity): Promise<Session>;
  mode(identity: Identity, mode: "text" | "voice"): Promise<Session>;
  presented?(identity: Identity, summary: Summary): Promise<Session>;
  lifecycle(event: Lifecycle): Promise<Session>;
}
export const summaryText = (s: Summary) =>
  s.spokenText ??
  `Simulated order. Product ${s.productId}, variant ${s.variantId}. Seller ${s.sellerId}. Quantity ${s.quantity}. Items USD ${(s.lineItemsMinor.items / 100).toFixed(2)}, shipping USD ${(s.lineItemsMinor.shipping / 100).toFixed(2)}, other fees USD ${(s.lineItemsMinor.otherFees / 100).toFixed(2)}. Total USD ${(s.totalMinor / 100).toFixed(2)}. Destination ${s.destination}. Delivery ${s.deliveryWindow}. Conditions: ${s.conditions.join(". ")}. Uncertainties: ${s.uncertainties.join(". ")}. Say or type “Confirm this simulated purchase” to approve this exact summary.`;
