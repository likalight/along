import type { CanvasData, Presentation } from "../canvas/contracts";
import type {
  DiscoveryReference,
  DiscoveryAssessment,
} from "@coupang/contract";
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
/** References an utterance independently observed by the server voice bridge. */
export type VoiceEvidence = {
  callId: string;
  itemId: string;
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
  /** Fixture shell tracks display ack separately from status. */
  displayed?: boolean;
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
  status: "presenting" | "eligible" | "invalidated" | "confirmed";
};
export type NarrationSegment = { text: string; productId: string | null };
export type Session = {
  discoveryReference?: DiscoveryReference;
  discoveryAssessment?: DiscoveryAssessment;
  conversationMode?: "text" | "voice";
  narrationSegments?: NarrationSegment[];
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
  approvalStatus:
    "not_prepared" | "presenting" | "eligible" | "approved" | "blocked";
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
  summaryRevision?: number;
  videoId?: string;
  eventId?: string;
  type:
    | "summary.displayed"
    | "audio.started"
    | "audio.completed"
    | "audio.interrupted"
    | "turn.cancelled"
    | "video.started"
    | "video.stopped";
};
export type TurnActivity = {
  turnId: string;
  phase: "working" | "speaking" | "done" | "error";
  label: string;
  heading: string;
};
export interface SessionTransport {
  activity?(
    identity: Identity,
    signal?: AbortSignal,
  ): Promise<{ activity: TurnActivity | null }>;
  connect(sessionId?: string): Promise<Session>;
  discovery?(
    identity: Identity,
    handoffId: string,
  ): Promise<{ snapshot: Session; turnId: string }>;
  send(
    input: Input,
    signal: AbortSignal,
    voiceEvidence?: VoiceEvidence,
  ): Promise<Accepted>;
  cancel(identity: Identity): Promise<Session>;
  mode(identity: Identity, mode: "text" | "voice"): Promise<Session>;
  presented?(identity: Identity, summary: Summary): Promise<Session>;
  lifecycle(event: Lifecycle): Promise<Session>;
}
export const summaryText = (s: Summary) =>
  s.spokenText ??
  `Your order: ${s.quantity} of product ${s.productId}, variant ${s.variantId}, from ${s.sellerId}. Items USD ${(s.lineItemsMinor.items / 100).toFixed(2)}, shipping USD ${(s.lineItemsMinor.shipping / 100).toFixed(2)}, other fees USD ${(s.lineItemsMinor.otherFees / 100).toFixed(2)}. Total USD ${(s.totalMinor / 100).toFixed(2)}. Destination ${s.destination}. Delivery ${s.deliveryWindow}. Conditions: ${s.conditions.join(". ")}. Before you buy: ${s.uncertainties.join(". ")}. Would you like me to place this order? You can also change it or cancel.`;
