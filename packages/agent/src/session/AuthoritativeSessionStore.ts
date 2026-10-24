import { SessionStore } from "@concierge/backend/store";
import { alongProfile as agreedProfile } from "@concierge/backend/along-catalog";
import { quoteOffer } from "@concierge/backend/quotes";
import { acceptApproval, summaryView } from "@concierge/backend/integration";
import type { Constraints, Proposal } from "@concierge/backend/contracts";
import {
  SessionSnapshotSchema,
  type SessionSnapshot,
  type AgentProposal,
  type InputEvent,
  type PurchaseSummary,
  type Attachment,
} from "@coupang/contract";
import {
  FixtureSessionStore,
  type ApplyResult,
} from "./FixtureSessionStore.js";
import { getProduct, PREPARED_ATTACHMENTS } from "../fixtures/catalog.js";
const priorities = {
  best_value: "best-value",
  best_supported_quality: "best-quality",
  lowest_cost_suitable: "lowest-cost-suitable",
} as const;
/** Narrative agent scenario IDs → canonical backend scenario seeds. */
export const BACKEND_SCENARIO_IDS = {
  cafe_dictation: "cafe-dictation",
  bag_inspiration: "work-gym",
  warm_bedding: "warm-room",
} as const;
type Meta = Pick<
  SessionSnapshot,
  "scenarioId" | "scenarioStage" | "imageInferences"
>;
export type VoiceConfirmEvidence = {
  transcript: string;
  final: boolean;
  confidence: number;
  source: "shopper";
  echoDetected: boolean;
};
export type PresentationAck = {
  summaryId: string;
  turnId: string;
  textHash: string;
  event: string;
  epoch?: number;
  eventId?: string;
  expectedRevision?: number;
  summaryRevision?: number;
  playbackId?: string;
};
/** Production-facing adapter. Only the backend may accept state or issue receipts. */
export class AuthoritativeSessionStore extends FixtureSessionStore {
  readonly core = new SessionStore(undefined, agreedProfile);
  private metadata = new Map<string, Meta>();
  private tokens = new Map<string, string>();
  override create(
    opts?: Parameters<FixtureSessionStore["create"]>[0],
  ): SessionSnapshot {
    // Narrative scenario IDs are session metadata only — never seed budget/host/bed
    // constraints as assumed consent (INTEGRATION.md). Shopper conversation owns those.
    const { session, accessToken } = this.core.create();
    this.tokens.set(session.id, accessToken);
    this.metadata.set(session.id, {
      scenarioId: opts?.scenarioId ?? null,
      scenarioStage: "opening",
      imageInferences: [],
    });
    // Record mapped backend scenario id for rehearsal scripts without applying its constraints.
    if (opts?.scenarioId) {
      const mapped = BACKEND_SCENARIO_IDS[opts.scenarioId];
      if (mapped) this.core.get(session.id).scenarioId = mapped;
    }
    if (opts?.preparedAttachmentId)
      this.core.usePreparedImage(
        session.id,
        session.revision,
        opts.preparedAttachmentId,
      );
    return this.get(session.id)!;
  }
  accessToken(id: string) {
    return this.tokens.get(id);
  }
  authenticate(id: string, token: string) {
    this.core.authenticate(id, token);
  }
  override get(id: string): SessionSnapshot | undefined {
    let s;
    try {
      s = this.core.get(id);
    } catch {
      return undefined;
    }
    const meta = this.metadata.get(id)!;
    const prefs = Object.fromEntries(
      s.preferences.map((x) => {
        try {
          return JSON.parse(x);
        } catch {
          return [x, true];
        }
      }),
    );
    const summary = s.summary;
    return SessionSnapshotSchema.parse({
      sessionId: s.id,
      epoch: s.epoch,
      revision: s.revision,
      needs: s.needs,
      hardConstraints: {
        ...s.constraints,
        maxDeliveryDays: s.constraints.deliveryWithinDays,
      },
      preferences: prefs,
      exclusions: s.excludedProductIds,
      shortlistIds: s.shortlist,
      displayOrder: s.displayOrder,
      shortlistEntries: (s.view?.cards ?? []).map((c) => ({
        productId: c.productId,
        rank: c.rank
          ? (["gold", "silver", "bronze"] as const)[c.rank - 1]
          : undefined,
        fitReason: c.reason,
        compromise: c.compromise,
      })),
      focusedProductId: s.view?.focusProductId ?? null,
      comparisonIds: s.comparisonIds,
      savedItems: s.savedItems.flatMap((x) =>
        x.productIds.map((pid) => ({
          productId: pid,
          offerId: x.selection?.offerId,
          rationale: x.rationale,
          savedAtRevision: s.revision,
          eligible: this.quotes(id, pid).some((q) => q.eligible),
        })),
      ),
      history: s.history.map((h) => h.text ?? h.modality),
      selectedOfferId: s.selection?.offerId ?? null,
      view: s.receipt ? "receipt" : s.stage,
      evidenceIds: s.evidenceIds,
      attachmentIds: s.attachmentIds,
      summaryId: summary?.id ?? null,
      approvalStatus: s.receipt
        ? "approved"
        : summary?.playback === "interrupted"
          ? "blocked"
          : summary?.approvalNonce
            ? "eligible"
            : summary
              ? "presenting"
              : "not_prepared",
      buyingPriority:
        Object.entries(priorities).find(([, v]) => v === s.priority)?.[0] ??
        null,
      ...meta,
    });
  }
  quotes(id: string, productId?: string) {
    const s = this.core.get(id);
    return agreedProfile.catalog.offers
      .filter((o) => !productId || o.productId === productId)
      .map((o) =>
        quoteOffer(
          o.id,
          1,
          s.constraints,
          s.excludedProductIds,
          agreedProfile.catalog,
          s.destination,
        ),
      );
  }
  override ingestInput(input: InputEvent) {
    this.core.input(input.sessionId, {
      ...input,
      ...(input.modality === "link" ? { url: input.text?.trim() } : {}),
    });
  }
  override apply(a: AgentProposal): ApplyResult {
    let content = "";
    try {
      this.core.once(a.sessionId, a.epoch, a.eventId, a, () => {
        const s = this.core.get(a.sessionId),
          p = a.payload;
        if (s.revision !== a.baseRevision)
          throw new Error("stale_base_revision");
        const proposal: Proposal = {
          expectedRevision: a.baseRevision,
          turnId: a.turnId,
        };
        switch (a.action) {
          case "clarify":
            proposal.stage = ["solution_types", "buying_priorities"].includes(
              String(p.stage),
            )
              ? String(p.stage)
              : "understanding";
            content = String(p.question ?? "What matters most?");
            break;
          case "set_constraints": {
            const hard = (p.hardConstraints ?? {}) as Record<string, any>;
            const constraints: Constraints = { currency: "USD" };
            if (hard.budgetMinor !== undefined)
              constraints.budgetMinor = hard.budgetMinor;
            if (hard.maxDeliveryDays !== undefined)
              constraints.deliveryWithinDays = hard.maxDeliveryDays;
            if (hard.deliveryWithinDays !== undefined)
              constraints.deliveryWithinDays = hard.deliveryWithinDays;
            if (hard.category) {
              const mapped =
                hard.category === "audio"
                  ? "audio-accessories"
                  : hard.category === "bags"
                    ? "everyday-bags"
                    : hard.category === "bedding"
                      ? "bedsheet-sets"
                      : hard.category;
              constraints.category = mapped;
            }
            if (hard.compatibility)
              constraints.compatibility = hard.compatibility;
            if (hard.requiredSpecifications)
              constraints.requiredSpecifications = hard.requiredSpecifications;
            const unsupported = Object.keys(hard).filter(
              (k) =>
                ![
                  "budgetMinor",
                  "maxDeliveryDays",
                  "deliveryWithinDays",
                  "category",
                  "currency",
                  "compatibility",
                  "requiredSpecifications",
                ].includes(k),
            );
            if (unsupported.length)
              throw new Error(
                "Unsupported hard constraint: " +
                  unsupported.join(", ") +
                  ". Clarify before continuing.",
              );
            proposal.constraints = constraints;
            const prefs = {
              ...this.get(a.sessionId)!.preferences,
              ...((p.preferences as object) ?? {}),
            };
            proposal.preferences = Object.entries(prefs).map((x) =>
              JSON.stringify(x),
            );
            proposal.needs = [
              ...new Set([...s.needs, ...((p.needs as string[]) ?? [])]),
            ];
            proposal.excludedProductIds = [
              ...new Set([
                ...s.excludedProductIds,
                ...((p.exclusions as string[]) ?? []),
              ]),
            ];
            content =
              "Updated your requirements; existing hard limits remain in force.";
            break;
          }
          case "set_priority":
            proposal.priority =
              priorities[p.priority as keyof typeof priorities];
            if (!proposal.priority) throw new Error("invalid_priority");
            content = "Updated priority while keeping hard constraints.";
            proposal.stage = "buying_priorities";
            break;
          case "shortlist": {
            const entries = (p.entries ??
              []) as SessionSnapshot["shortlistEntries"];
            const related = [
              ...((p.closeMatches as string[]) ?? []),
              ...((p.relatedDiscoveries as string[]) ?? []),
            ];
            // Discovery may show related tiles that are not yet checkout-eligible.
            // Hard category/incompatibility still drops a product; soft/unknown stays.
            // HOST_CONNECTION_REQUIRED is soft until the shopper confirms host hardware
            // (café demo would otherwise land empty after "best value").
            const soft = (code: string) =>
              /UNKNOWN|DELIVERY|OVER_BUDGET|SHOE_COMPARTMENT|LAPTOP_FIT|SPECIFICATION_CONFLICT|HOST_CONNECTION_REQUIRED/i.test(
                code,
              );
            const discovery = entries.filter((e) => {
              const quotes = this.quotes(a.sessionId, e.productId);
              if (!quotes.length) return related.includes(e.productId);
              return quotes.some((q) =>
                q.conflicts.every(
                  (c) =>
                    soft(c.code) ||
                    [
                      "HOST_UNKNOWN",
                      "BED_DIMENSIONS_UNKNOWN",
                      "MATTRESS_DEPTH_UNKNOWN",
                    ].includes(c.code),
                ),
              );
            });
            const eligible = discovery.filter((e) =>
              this.quotes(a.sessionId, e.productId).some((q) => q.eligible),
            );
            const shown = (
              eligible.length >= 3 ? eligible : discovery
            ).slice(0, 5);
            proposal.shortlist = shown.map((e) => e.productId);
            proposal.view = {
              stage: "shortlist",
              focusProductId: null,
              cards: shown.map((e, i) => ({
                productId: e.productId,
                role: (s.priority ?? "best-value") as "best-value",
                rank: (i + 1) as 1 | 2 | 3,
                reason: e.fitReason,
                compromise: e.compromise,
                evidenceIds: getProduct(e.productId)?.evidenceIds ?? [],
              })),
              evidenceIds: [],
              activeVideoId: null,
            };
            proposal.stage = shown.length ? "shortlist" : "understanding";
            content = shown.length
              ? eligible.length
                ? `Here are ${shown.length} candidates. Gold/silver/bronze are contextual ranks for this shortlist — not awards.`
                : `Here are ${shown.length} discoveries. Some still need a compatibility check before checkout.`
              : "No checked offer meets the known hard constraints. Which requirement may change?";
            break;
          }
          case "focus":
            if (!s.shortlist.includes(String(p.productId)))
              throw new Error("not_visible");
            proposal.view = {
              stage: "shortlist",
              focusProductId: String(p.productId),
              cards: s.view?.cards ?? [],
              evidenceIds: s.evidenceIds,
              activeVideoId: null,
            };
            content = `Focusing on ${getProduct(String(p.productId))?.title}.`;
            break;
          case "compare":
            proposal.comparisonIds = p.productIds as string[];
            if (!proposal.comparisonIds.every((x) => s.shortlist.includes(x)))
              throw new Error("not_visible");
            proposal.stage = "comparison";
            content =
              "Comparing the selected visible products; their display order is unchanged.";
            break;
          case "show_evidence":
            proposal.evidenceIds = p.evidenceIds as string[];
            proposal.stage = "evidence";
            content =
              "Showing attributable product evidence separately from synthetic seller terms.";
            break;
          case "select_offer":
            proposal.selection = { offerId: String(p.offerId), quantity: 1 };
            proposal.stage = "offers";
            content =
              "Offer selected after checking the complete total and your constraints.";
            break;
          case "save":
            this.core.saveChoice(
              a.sessionId,
              a.baseRevision,
              a.turnId,
              [p.productId],
              p.rationale ?? "Saved for later",
            );
            content = "Saved for later. No purchase.";
            return;
          case "restore": {
            const saved = s.savedItems.find((x) =>
              x.productIds.includes(String(p.productId)),
            );
            if (!saved) throw new Error("not_saved");
            this.core.restoreChoice(
              a.sessionId,
              a.baseRevision,
              a.turnId,
              saved.id,
            );
            content =
              "Restored the saved choice under your current constraints.";
            return;
          }
          case "cancel":
          case "defer":
            this.core.cancel(a.sessionId, a.turnId);
            content = "Stopped. No purchase was made.";
            return;
          case "prepare_summary": {
            const next = this.core.summarize(
              a.sessionId,
              a.baseRevision,
              a.turnId,
            );
            content = next.summary!.spokenText;
            return;
          }
          case "propose_approval":
            throw new Error(
              "Model proposals cannot authorize a purchase. Display the exact summary, then use a new explicit shopper confirmation.",
            );
        }
        this.core.propose(a.sessionId, proposal);
      });
      const snapshot = this.get(a.sessionId)!;
      return {
        ok: true,
        snapshot,
        speakable: {
          turnId: a.turnId,
          revision: snapshot.revision,
          content,
          channel: "commentary",
        },
        displayEventId: `state-${snapshot.revision}`,
      };
    } catch (e) {
      const snapshot = this.get(a.sessionId)!;
      const reason = e instanceof Error ? e.message : "Rejected";
      return {
        ok: false,
        reason,
        snapshot,
        speakable: {
          turnId: a.turnId,
          revision: snapshot.revision,
          content: reason,
          channel: "commentary",
        },
        displayEventId: `state-${snapshot.revision}`,
      };
    }
  }
  override patch(id: string, patch: Partial<SessionSnapshot>) {
    const m = this.metadata.get(id);
    if (!m) return;
    for (const key of [
      "scenarioId",
      "scenarioStage",
      "imageInferences",
    ] as const)
      if (patch[key] !== undefined) (m as any)[key] = patch[key];
    return this.get(id);
  }
  override interruptSummary(id: string) {
    const s = this.core.get(id);
    if (s.summary && s.turn?.status === "active")
      this.core.cancel(id, s.turn.id);
    return this.get(id);
  }
  override reset(id: string) {
    const s = this.core.get(id);
    this.core.reset(id, s.revision);
    return this.get(id)!;
  }
  override getSummary(summaryId: string): PurchaseSummary | undefined {
    for (const id of this.metadata.keys()) {
      let s;
      try {
        s = this.core.get(id);
      } catch {
        continue;
      }
      if (s.summary?.id === summaryId) {
        const view = summaryView(s.summary);
        return {
          id: view.id,
          revision: view.revision,
          productId: view.productId,
          variantId: view.variantId,
          offerId: view.offerId,
          sellerId: view.sellerId,
          quantity: view.quantity,
          destination: view.destination,
          conditions: view.conditions,
          uncertainties: view.uncertainties,
          presentationMode: view.presentationMode,
          deliveryWindow: {
            latestOffsetDays: s.summary.quote.offer.deliveryDays,
          },
          currency: "USD",
          status: s.receipt
            ? "approved"
            : s.summary.approvalNonce
              ? "eligible"
              : s.summary.playback === "interrupted"
                ? "interrupted"
                : "presenting",
          lineItemsMinor: {
            items: view.lineItemsMinor.items,
            shipping: view.lineItemsMinor.shipping!,
            otherFees:
              view.lineItemsMinor.otherFees! +
              (view.lineItemsMinor.requiredSetup ?? 0) +
              (view.lineItemsMinor.tax ?? 0),
          },
          totalMinor: view.totalMinor!,
        };
      }
    }
  }
  summaryDetails(id: string) {
    const s = this.core.get(id);
    return s.summary
      ? {
          ...this.getSummary(s.summary.id),
          spokenText: s.summary.spokenText,
          textHash: s.summary.textHash,
          responseTurnId: s.summary.responseTurnId,
          playback: s.summary.playback,
          displayed: s.summary.displayed,
        }
      : null;
  }
  /**
   * Presentation ack with the same identity guards as the HTTP lifecycle bridge.
   * Always includes epoch/eventId/revision so races cannot loosely promote eligibility.
   */
  acknowledge(id: string, raw: PresentationAck) {
    const s = this.core.get(id);
    this.core.presentation(id, {
      summaryId: raw.summaryId,
      turnId: raw.turnId,
      textHash: raw.textHash,
      event: raw.event,
      epoch: raw.epoch ?? s.epoch,
      eventId: raw.eventId ?? `present-${raw.event}-${crypto.randomUUID()}`,
      expectedRevision: raw.expectedRevision ?? s.revision,
      summaryRevision: raw.summaryRevision ?? s.summary?.revision,
      ...(raw.playbackId ? { playbackId: raw.playbackId } : {}),
    });
    return this.get(id)!;
  }
  /** Trusted audio/video lifecycle → backend store (not a loose presentation shortcut). */
  lifecycle(
    id: string,
    raw: {
      sessionId: string;
      epoch: number;
      eventId: string;
      turnId: string;
      revision: number;
      type: string;
      playbackId: string;
      summaryId?: string;
      summaryRevision?: number;
      videoId?: string;
    },
  ) {
    this.core.lifecycle(id, raw);
    return this.get(id)!;
  }
  confirmText(input: InputEvent) {
    const s = this.core.get(input.sessionId);
    if (input.modality !== "text" || !s.summary)
      throw new Error("Current text summary required");
    const result = acceptApproval(this.core, input.sessionId, {
      sessionId: input.sessionId,
      epoch: input.epoch,
      eventId: `confirm-${input.eventId}`,
      turnId: input.turnId,
      baseRevision: s.revision,
      summaryId: s.summary.id,
      summaryRevision: s.summary.revision,
      modality: "text",
      explicitIntent: "confirm_simulated_purchase",
    });
    return result;
  }
  /**
   * Voice purchase confirmation. Requires a prior ingestInput of the same voice turn
   * plus trusted final/non-echo shopper evidence. Model tools cannot call this.
   */
  confirmVoice(input: InputEvent, evidence: VoiceConfirmEvidence) {
    const s = this.core.get(input.sessionId);
    if (input.modality !== "voice" || !s.summary)
      throw new Error("Current voice summary required");
    if (
      !evidence.final ||
      evidence.source !== "shopper" ||
      evidence.echoDetected ||
      evidence.confidence < 0.9
    ) {
      throw new Error(
        "Voice confirmation requires a trusted final shopper utterance (confidence ≥ 0.9, non-echo).",
      );
    }
    return acceptApproval(this.core, input.sessionId, {
      sessionId: input.sessionId,
      epoch: input.epoch,
      eventId: `confirm-${input.eventId}`,
      turnId: input.turnId,
      baseRevision: s.revision,
      summaryId: s.summary.id,
      summaryRevision: s.summary.revision,
      modality: "voice",
      explicitIntent: "confirm_simulated_purchase",
      voiceEvidence: evidence,
    });
  }
  override tryApprove(
    _input: Parameters<FixtureSessionStore["tryApprove"]>[0],
  ) {
    return {
      ok: false,
      reason:
        "Use trusted input and exact presentation acknowledgments; fixture flags cannot approve.",
    };
  }
  override registerUploadedImage(_id: string, _a: Attachment): Attachment {
    throw new Error(
      "Upload validated bytes through backend attachments endpoint. A URL is not an upload.",
    );
  }
  override getAttachment(id: string) {
    return PREPARED_ATTACHMENTS.find((a) => a.id === id);
  }
}
