import { z } from "zod";

/** Contract v1 — shared shopping session types (#2). */

export const ModalitySchema = z.enum(["voice", "text", "image", "link"]);
export type Modality = z.infer<typeof ModalitySchema>;

export const ApprovalModalitySchema = z.enum(["voice", "text"]);
export type ApprovalModality = z.infer<typeof ApprovalModalitySchema>;

export const ViewSchema = z.enum([
  "opening",
  "understanding",
  "solution_types",
  "buying_priorities",
  "shortlist",
  "comparison",
  "evidence",
  "saved_choice",
  "offers",
  "summary",
  "receipt",
  "recovery",
]);
export type View = z.infer<typeof ViewSchema>;

export const ProposalActionSchema = z.enum([
  "clarify",
  "set_constraints",
  "set_priority",
  "shortlist",
  "focus",
  "compare",
  "show_evidence",
  "save",
  "restore",
  "select_offer",
  "prepare_summary",
  "propose_approval",
  "defer",
  "cancel",
]);
export type ProposalAction = z.infer<typeof ProposalActionSchema>;

export const BuyingPrioritySchema = z.enum([
  "best_value",
  "best_supported_quality",
  "lowest_cost_suitable",
]);
export type BuyingPriority = z.infer<typeof BuyingPrioritySchema>;

export const ShortlistRankSchema = z.enum(["gold", "silver", "bronze"]);
export type ShortlistRank = z.infer<typeof ShortlistRankSchema>;

export const ClassificationSchema = z.enum(["observed", "snapshot", "proxy"]);
export type Classification = z.infer<typeof ClassificationSchema>;

export const ImageRefSchema = z.object({
  url: z.string(),
  alt: z.string(),
  source: z.string().optional(),
  classification: ClassificationSchema.optional(),
});

export const ProductSchema = z.object({
  id: z.string(),
  category: z.enum(["audio", "bags", "bedding"]),
  brand: z.string(),
  model: z.string(),
  variantId: z.string(),
  title: z.string(),
  image: ImageRefSchema,
  specs: z.record(z.unknown()).default({}),
  limitations: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  solutionType: z
    .enum(["headset", "clip_on", "directional_desktop"])
    .optional(),
  /** Authored fit heuristic 0–100; not measured accuracy. */
  authoredFitScore: z.number().min(0).max(100).optional(),
});
export type Product = z.infer<typeof ProductSchema>;

export const OfferSchema = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string(),
  sellerId: z.string(),
  currency: z.literal("USD"),
  unitPriceMinor: z.number().int().nullable(),
  shippingMinor: z.number().int().nullable(),
  otherFeesMinor: z.number().int().nullable(),
  availability: z.enum(["in_stock", "unavailable", "unknown"]),
  destination: z.string(),
  deliveryWindow: z
    .object({
      latestOffsetDays: z.number().int().nullable(),
    })
    .optional(),
  returnTerms: z.string().optional(),
  conditions: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  classification: ClassificationSchema,
});
export type Offer = z.infer<typeof OfferSchema>;

export const MediaRefSchema = z.object({
  id: z.string(),
  url: z.string(),
  creator: z.string().optional(),
  platform: z.string().optional(),
  date: z.string().optional(),
  topic: z.string().optional(),
  playable: z.boolean().default(true),
});

export const EvidenceSchema = z.object({
  id: z.string(),
  subjectType: z.enum(["product", "seller"]),
  subjectId: z.string(),
  sourceUrl: z.string().optional(),
  sourceType: z.string(),
  checkedOn: z.string().optional(),
  classification: ClassificationSchema,
  claim: z.string(),
  excerpt: z.string().optional(),
  rating: z.number().nullable().optional(),
  ratingCount: z.number().int().nullable().optional(),
  writtenReviewCount: z.number().int().nullable().optional(),
  purchaseCount: z.number().int().nullable().optional(),
  purchaseCountPeriod: z.string().nullable().optional(),
  reviewScope: z.string().nullable().optional(),
  media: MediaRefSchema.optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SavedItemSchema = z.object({
  productId: z.string(),
  offerId: z.string().optional(),
  rationale: z.string(),
  savedAtRevision: z.number().int(),
  eligible: z.boolean().default(true),
});
export type SavedItem = z.infer<typeof SavedItemSchema>;

export const ShortlistEntrySchema = z.object({
  productId: z.string(),
  rank: ShortlistRankSchema.optional(),
  fitReason: z.string(),
  compromise: z.string(),
});
export type ShortlistEntry = z.infer<typeof ShortlistEntrySchema>;

export const AttachmentSchema = z.object({
  id: z.string(),
  kind: z.enum(["uploaded_image", "prepared_image", "link"]),
  url: z.string().optional(),
  preparedKey: z.string().optional(),
  linkKey: z.string().optional(),
  status: z.enum(["ready", "resolving", "unavailable", "invalid"]),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const PurchaseSummarySchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  productId: z.string(),
  variantId: z.string(),
  offerId: z.string(),
  sellerId: z.string(),
  quantity: z.number().int().positive(),
  currency: z.literal("USD"),
  lineItemsMinor: z.object({
    items: z.number().int(),
    shipping: z.number().int(),
    otherFees: z.number().int(),
  }),
  totalMinor: z.number().int(),
  destination: z.string(),
  deliveryWindow: z
    .object({ latestOffsetDays: z.number().int().nullable() })
    .optional(),
  conditions: z.array(z.string()).default([]),
  uncertainties: z.array(z.string()).default([]),
  presentationMode: ApprovalModalitySchema,
  status: z.enum([
    "presenting",
    "eligible",
    "interrupted",
    "approved",
    "invalidated",
  ]),
});
export type PurchaseSummary = z.infer<typeof PurchaseSummarySchema>;

export const SessionSnapshotSchema = z.object({
  sessionId: z.string(),
  epoch: z.number().int(),
  revision: z.number().int(),
  needs: z.array(z.string()).default([]),
  hardConstraints: z.record(z.unknown()).default({}),
  preferences: z.record(z.unknown()).default({}),
  exclusions: z.array(z.string()).default([]),
  shortlistIds: z.array(z.string()).default([]),
  shortlistEntries: z.array(ShortlistEntrySchema).default([]),
  displayOrder: z.array(z.string()).default([]),
  focusedProductId: z.string().nullable().default(null),
  comparisonIds: z.array(z.string()).default([]),
  savedItems: z.array(SavedItemSchema).default([]),
  history: z.array(z.string()).default([]),
  selectedOfferId: z.string().nullable().default(null),
  view: ViewSchema,
  evidenceIds: z.array(z.string()).default([]),
  attachmentIds: z.array(z.string()).default([]),
  summaryId: z.string().nullable().default(null),
  approvalStatus: z.enum([
    "not_prepared",
    "presenting",
    "eligible",
    "blocked",
    "approved",
  ]),
  buyingPriority: BuyingPrioritySchema.nullable().default(null),
  scenarioId: z
    .enum(["cafe_dictation", "bag_inspiration", "warm_bedding"])
    .nullable()
    .default(null),
  scenarioStage: z
    .enum([
      "opening",
      "understand",
      "solution_types",
      "buying_priorities",
      "within_priority",
      "evidence",
      "offers",
      "summary",
      "done",
    ])
    .default("opening"),
  imageInferences: z
    .array(
      z.object({
        attachmentId: z.string(),
        inferredNeeds: z.array(z.string()),
        confidence: z.enum(["low", "medium", "high"]),
        unknownFields: z.array(z.string()),
        source: z.literal("image_inference"),
      }),
    )
    .default([]),
});
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

export const InputEventSchema = z.object({
  sessionId: z.string(),
  epoch: z.number().int(),
  eventId: z.string(),
  turnId: z.string(),
  baseRevision: z.number().int(),
  modality: ModalitySchema,
  text: z.string().optional(),
  attachmentId: z.string().optional(),
  visibleRevision: z.number().int(),
  visibleProductIds: z.array(z.string()).default([]),
});
export type InputEvent = z.infer<typeof InputEventSchema>;

export const AgentProposalSchema = z.object({
  sessionId: z.string(),
  epoch: z.number().int(),
  turnId: z.string(),
  baseRevision: z.number().int(),
  eventId: z.string(),
  action: ProposalActionSchema,
  payload: z.record(z.unknown()).default({}),
  evidenceIds: z.array(z.string()).default([]),
});
export type AgentProposal = z.infer<typeof AgentProposalSchema>;

export const AcceptedDisplayEventSchema = z.object({
  sessionId: z.string(),
  epoch: z.number().int(),
  eventId: z.string(),
  turnId: z.string(),
  revision: z.number().int(),
  type: z.literal("session.updated"),
  snapshot: SessionSnapshotSchema,
});
export type AcceptedDisplayEvent = z.infer<typeof AcceptedDisplayEventSchema>;

export const LifecycleEventSchema = z.object({
  sessionId: z.string(),
  epoch: z.number().int(),
  turnId: z.string(),
  revision: z.number().int(),
  playbackId: z.string().optional(),
  summaryId: z.string().optional(),
  type: z.enum([
    "audio.started",
    "audio.completed",
    "audio.interrupted",
    "turn.cancelled",
    "video.started",
    "video.stopped",
  ]),
});
export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;

export const ApprovalEventSchema = z.object({
  eventId: z.string(),
  sessionId: z.string(),
  epoch: z.number().int(),
  turnId: z.string(),
  summaryId: z.string(),
  summaryRevision: z.number().int(),
  modality: ApprovalModalitySchema,
  explicitIntent: z.literal("confirm_simulated_purchase"),
});
export type ApprovalEvent = z.infer<typeof ApprovalEventSchema>;

export const ReceiptSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  summaryId: z.string(),
  summaryRevision: z.number().int(),
  simulated: z.literal(true),
  acceptedOrder: z.record(z.unknown()),
  createdAt: z.string(),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

export const SpeakableResultSchema = z.object({
  turnId: z.string(),
  revision: z.number().int(),
  content: z.string(),
  channel: z.enum(["commentary", "thinking", "instructions"]).default("commentary"),
});
export type SpeakableResult = z.infer<typeof SpeakableResultSchema>;
