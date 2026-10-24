import {
  type AgentProposal,
  type Attachment,
  type InputEvent,
  type PurchaseSummary,
  type SessionSnapshot,
  type SpeakableResult,
  type DiscoveryReference,
  type DiscoveryImportIdentity,
} from "@coupang/contract";
import type { DiscoveryImportResult } from "../discovery/reference.js";
import {
  completeTotalMinor,
  EVIDENCE,
  getOffer,
  getProduct,
  KNOWN_LINKS,
  OFFERS,
  PREPARED_ATTACHMENTS,
  PRODUCTS,
} from "../fixtures/catalog.js";

export interface ApplyResult {
  ok: boolean;
  reason?: string;
  snapshot: SessionSnapshot;
  speakable: SpeakableResult;
  displayEventId: string;
}

function emptySnapshot(sessionId: string, scenarioId: SessionSnapshot["scenarioId"]): SessionSnapshot {
  return {
    sessionId,
    epoch: 1,
    revision: 0,
    needs: [],
    hardConstraints: {},
    preferences: {},
    exclusions: [],
    shortlistIds: [],
    shortlistEntries: [],
    displayOrder: [],
    focusedProductId: null,
    comparisonIds: [],
    savedItems: [],
    history: [],
    selectedOfferId: null,
    view: "opening",
    evidenceIds: [],
    attachmentIds: [],
    summaryId: null,
    approvalStatus: "not_prepared",
    buyingPriority: null,
    scenarioId,
    scenarioStage: "opening",
    imageInferences: [],
  };
}

/** Authoritative fixture session store — stands in for B2/B3/B4 until live APIs exist. */
export class FixtureSessionStore {
  private sessions = new Map<string, SessionSnapshot>();
  private attachments = new Map<string, Attachment>();
  private summaries = new Map<string, PurchaseSummary>();
  private seenEventIds = new Set<string>();
  private receipts = new Map<string, { id: string; summaryId: string }>();

  importDiscovery(_sessionId: string, _reference: DiscoveryReference, _identity: DiscoveryImportIdentity): DiscoveryImportResult {
    throw new Error("Discovery handoff requires the authoritative session store.");
  }
  clearDiscovery(sessionId: string): SessionSnapshot | undefined { return this.get(sessionId); }

  create(opts?: {
    sessionId?: string;
    scenarioId?: SessionSnapshot["scenarioId"];
    preparedAttachmentId?: string;
  }): SessionSnapshot {
    const sessionId = opts?.sessionId ?? `demo-${crypto.randomUUID().slice(0, 8)}`;
    const snap = emptySnapshot(sessionId, opts?.scenarioId ?? null);
    if (opts?.preparedAttachmentId) {
      const att = PREPARED_ATTACHMENTS.find((a) => a.id === opts.preparedAttachmentId);
      if (att) {
        this.attachments.set(att.id, att);
        snap.attachmentIds = [att.id];
      }
    }
    this.sessions.set(sessionId, snap);
    return structuredClone(snap);
  }

  get(sessionId: string): SessionSnapshot | undefined {
    const s = this.sessions.get(sessionId);
    return s ? structuredClone(s) : undefined;
  }

  getAttachment(id: string): Attachment | undefined {
    return this.attachments.get(id);
  }

  listProducts(category?: string) {
    return PRODUCTS.filter((p) => !category || p.category === category);
  }

  listEvidence(ids: string[]) {
    return EVIDENCE.filter((e) => ids.includes(e.id));
  }

  resolveLink(url: string) {
    return KNOWN_LINKS[url] ?? { status: "unavailable" as const, note: "Unknown link" };
  }

  registerUploadedImage(sessionId: string, attachment: Attachment): Attachment {
    const snap = this.sessions.get(sessionId);
    if (!snap) throw new Error("session not found");
    this.attachments.set(attachment.id, attachment);
    snap.attachmentIds = [...new Set([...snap.attachmentIds, attachment.id])];
    this.sessions.set(sessionId, snap);
    return attachment;
  }

  apply(proposal: AgentProposal): ApplyResult {
    const snap = this.sessions.get(proposal.sessionId);
    if (!snap) {
      return this.reject(proposal, emptySnapshot(proposal.sessionId, null), "session_not_found");
    }
    if (this.seenEventIds.has(proposal.eventId)) {
      return {
        ok: true,
        snapshot: structuredClone(snap),
        speakable: {
          turnId: proposal.turnId,
          revision: snap.revision,
          content: "Already applied that update.",
          channel: "thinking",
        },
        displayEventId: `state-${snap.revision}`,
      };
    }
    if (proposal.epoch !== snap.epoch) {
      return this.reject(proposal, snap, "epoch_mismatch");
    }
    if (proposal.baseRevision !== snap.revision) {
      return this.reject(proposal, snap, "stale_base_revision");
    }

    const next = structuredClone(snap);
    let speak = "";

    switch (proposal.action) {
      case "clarify": {
        const q = String(proposal.payload["question"] ?? "Could you tell me a bit more?");
        next.view = proposal.payload["stage"] === "solution_types"
          ? "solution_types"
          : proposal.payload["stage"] === "buying_priorities"
            ? "buying_priorities" : "understanding";
        if (next.view === "solution_types") next.preferences.audioDirectionPending = true;
        next.scenarioStage = "understand";
        speak = q;
        break;
      }
      case "set_constraints": {
        const hard = (proposal.payload["hardConstraints"] ?? {}) as Record<string, unknown>;
        const prefs = (proposal.payload["preferences"] ?? {}) as Record<string, unknown>;
        const needs = (proposal.payload["needs"] ?? []) as string[];
        const exclusions = (proposal.payload["exclusions"] ?? []) as string[];
        next.hardConstraints = { ...next.hardConstraints, ...hard };
        next.preferences = { ...next.preferences, ...prefs };
        if (Object.hasOwn(prefs, "solutionType")) next.preferences.audioDirectionPending = false;
        if (needs.length) next.needs = [...new Set([...next.needs, ...needs])];
        if (exclusions.length) {
          next.exclusions = [...new Set([...next.exclusions, ...exclusions])];
          next.shortlistIds = next.shortlistIds.filter((id) => !exclusions.includes(id));
          next.shortlistEntries = next.shortlistEntries.filter(
            (e) => !exclusions.includes(e.productId),
          );
          next.displayOrder = next.displayOrder.filter((id) => !exclusions.includes(id));
        }
        next.view = "understanding";
        next.scenarioStage = "understand";
        speak = "I've updated what matters for this search.";
        this.markSavedEligibility(next);
        break;
      }
      case "set_priority": {
        const priority = proposal.payload["priority"] as SessionSnapshot["buyingPriority"];
        if (
          priority !== "best_value" &&
          priority !== "best_supported_quality" &&
          priority !== "lowest_cost_suitable"
        ) {
          return this.reject(proposal, snap, "invalid_priority");
        }
        if (
          priority === "best_supported_quality" &&
          next.hardConstraints["budgetMinor"] != null &&
          proposal.payload["removeHardBudget"] !== true
        ) {
          // Quality-first must not silently exceed hard budget
          speak =
            "Quality-first still respects your hard budget unless you explicitly remove that limit.";
        }
        next.buyingPriority = priority;
        next.view = "buying_priorities";
        next.scenarioStage = "buying_priorities";
        speak =
          speak ||
          `Prioritizing ${priority.replaceAll("_", " ")} while keeping your other needs.`;
        break;
      }
      case "shortlist": {
        const entries = (proposal.payload["entries"] ?? []) as SessionSnapshot["shortlistEntries"];
        const valid = entries.filter((e) => {
          const prod = getProduct(e.productId);
          return prod && !next.exclusions.includes(e.productId) && prod.id !== "MIC-047";
        });
        if (valid.length === 0) {
          speak =
            "I haven’t found an option that fits everything yet. Would you like to adjust the budget or try something else?";
          next.view = "understanding";
        } else {
          next.shortlistEntries = valid.slice(0, 3);
          next.shortlistIds = next.shortlistEntries.map((e) => e.productId);
          next.displayOrder = [...next.shortlistIds];
          next.view = "shortlist";
          next.scenarioStage = "within_priority";
          speak = `Here are ${next.shortlistEntries.length} options with why they fit and one compromise each.`;
        }
        break;
      }
      case "focus": {
        const id = String(proposal.payload["productId"] ?? "");
        if (!getProduct(id) || !next.displayOrder.includes(id)) {
          return this.reject(proposal, snap, "unknown_or_not_visible_product");
        }
        next.focusedProductId = id;
        speak = `Focusing on ${getProduct(id)!.title}.`;
        break;
      }
      case "compare": {
        const ids = (proposal.payload["productIds"] ?? []) as string[];
        const visible = ids.filter((id) => next.displayOrder.includes(id) && getProduct(id));
        if (visible.length < 2) {
          return this.reject(proposal, snap, "need_two_visible_products");
        }
        next.comparisonIds = visible;
        next.displayOrder = visible;
        next.view = "comparison";
        speak = `Comparing ${visible.map((id) => getProduct(id)!.title).join(" and ")}.`;
        break;
      }
      case "show_evidence": {
        const evidenceIds = (proposal.payload["evidenceIds"] ?? []) as string[];
        const known = evidenceIds.filter((id) => EVIDENCE.some((e) => e.id === id));
        next.evidenceIds = known;
        next.view = "evidence";
        next.scenarioStage = "evidence";
        speak =
          known.length > 0
            ? "Here is the attributable evidence for this choice."
            : "That evidence is unavailable in the demo fixtures.";
        break;
      }
      case "save": {
        const productId = String(proposal.payload["productId"] ?? "");
        const rationale = String(proposal.payload["rationale"] ?? "Saved for later");
        if (!getProduct(productId)) return this.reject(proposal, snap, "unknown_product");
        next.savedItems = [
          ...next.savedItems.filter((s) => s.productId !== productId),
          {
            productId,
            offerId: next.selectedOfferId ?? undefined,
            rationale,
            savedAtRevision: next.revision + 1,
            eligible: !next.exclusions.includes(productId),
          },
        ];
        next.view = "saved_choice";
        next.approvalStatus = "not_prepared";
        speak = "Saved that choice and rationale for this session. This is not a purchase.";
        break;
      }
      case "restore": {
        const productId = String(proposal.payload["productId"] ?? "");
        const saved = next.savedItems.find((s) => s.productId === productId);
        if (!saved) return this.reject(proposal, snap, "not_saved");
        if (!next.displayOrder.includes(productId)) {
          next.displayOrder = [...next.displayOrder, productId];
        }
        next.focusedProductId = productId;
        speak = saved.eligible
          ? `Restored ${getProduct(productId)!.title}.`
          : `${getProduct(productId)!.title} is saved but currently ineligible under new hard constraints.`;
        break;
      }
      case "select_offer": {
        const offerId = String(proposal.payload["offerId"] ?? "");
        const offer = getOffer(offerId);
        if (!offer || offer.availability !== "in_stock") {
          return this.reject(proposal, snap, "invalid_offer");
        }
        const total = completeTotalMinor(offer);
        if (total == null) {
          return this.reject(proposal, snap, "incomplete_total");
        }
        next.selectedOfferId = offerId;
        next.focusedProductId = offer.productId;
        next.view = "offers";
        next.scenarioStage = "offers";
        next.approvalStatus = "not_prepared";
        speak = `Selected the ${offer.sellerId} offer at ${(total / 100).toFixed(2)} USD complete total among checked fixture offers.`;
        break;
      }
      case "prepare_summary": {
        const offerId = next.selectedOfferId;
        const offer = offerId ? getOffer(offerId) : undefined;
        if (!offer) return this.reject(proposal, snap, "no_selected_offer");
        const total = completeTotalMinor(offer);
        if (total == null) return this.reject(proposal, snap, "incomplete_total");
        const summaryId = `summary-${next.revision + 1}`;
        const summary: PurchaseSummary = {
          id: summaryId,
          revision: next.revision + 1,
          productId: offer.productId,
          variantId: offer.variantId,
          offerId: offer.id,
          sellerId: offer.sellerId,
          quantity: 1,
          currency: "USD",
          lineItemsMinor: {
            items: offer.unitPriceMinor!,
            shipping: offer.shippingMinor!,
            otherFees: offer.otherFeesMinor!,
          },
          totalMinor: total,
          destination: offer.destination,
          deliveryWindow: offer.deliveryWindow,
          conditions: offer.conditions,
          uncertainties: ["No live seller or delivery check"],
          presentationMode: "voice",
          status: "presenting",
        };
        this.summaries.set(summaryId, summary);
        next.summaryId = summaryId;
        next.view = "summary";
        next.scenarioStage = "summary";
        next.approvalStatus = "presenting";
        speak = `Summary: ${getProduct(offer.productId)!.title}, seller ${offer.sellerId}, total ${(total / 100).toFixed(2)} USD to ${offer.destination}. Please confirm this simulated purchase when ready.`;
        break;
      }
      case "propose_approval": {
        if (!next.summaryId) return this.reject(proposal, snap, "no_summary");
        const summary = this.summaries.get(next.summaryId);
        if (!summary || summary.status === "interrupted" || summary.status === "invalidated") {
          return this.reject(proposal, snap, "summary_not_eligible");
        }
        summary.status = "eligible";
        next.approvalStatus = "eligible";
        speak =
          "The current summary is ready for explicit confirmation by voice or deliberate typed confirm. Saving or 'looks good' is not enough.";
        break;
      }
      case "defer": {
        next.view = "saved_choice";
        next.approvalStatus = "not_prepared";
        speak = "No problem — we can stop here without purchasing.";
        break;
      }
      case "cancel": {
        if (next.summaryId) {
          const summary = this.summaries.get(next.summaryId);
          if (summary && summary.status === "presenting") summary.status = "interrupted";
        }
        next.approvalStatus =
          next.approvalStatus === "eligible" ? "blocked" : next.approvalStatus;
        speak = "Stopped. Your last valid selection is unchanged.";
        break;
      }
      default:
        return this.reject(proposal, snap, "unknown_action");
    }

    next.revision += 1;
    next.history = [...next.history, `${proposal.action}@${next.revision}`];
    this.seenEventIds.add(proposal.eventId);
    this.sessions.set(proposal.sessionId, next);

    return {
      ok: true,
      snapshot: structuredClone(next),
      speakable: {
        turnId: proposal.turnId,
        revision: next.revision,
        content: speak,
        channel: "commentary",
      },
      displayEventId: `state-${next.revision}`,
    };
  }

  /** Mark summary audio interrupted — invalidates voice approval eligibility. */
  interruptSummary(sessionId: string): SessionSnapshot | undefined {
    const snap = this.sessions.get(sessionId);
    if (!snap?.summaryId) return snap ? structuredClone(snap) : undefined;
    const summary = this.summaries.get(snap.summaryId);
    if (summary) summary.status = "interrupted";
    snap.approvalStatus = "blocked";
    this.sessions.set(sessionId, snap);
    return structuredClone(snap);
  }

  tryApprove(input: {
    sessionId: string;
    epoch: number;
    turnId: string;
    eventId: string;
    summaryId: string;
    summaryRevision: number;
    modality: "voice" | "text";
    explicitIntent: "confirm_simulated_purchase";
    summaryFullyPresented: boolean;
  }): { ok: boolean; reason?: string; receiptId?: string } {
    const snap = this.sessions.get(input.sessionId);
    if (!snap) return { ok: false, reason: "session_not_found" };
    if (snap.epoch !== input.epoch) return { ok: false, reason: "epoch_mismatch" };
    const summary = this.summaries.get(input.summaryId);
    if (!summary) return { ok: false, reason: "no_summary" };
    if (summary.revision !== input.summaryRevision) {
      return { ok: false, reason: "summary_revision_mismatch" };
    }
    if (!input.summaryFullyPresented) return { ok: false, reason: "incomplete_presentation" };
    if (summary.status !== "eligible" && summary.status !== "approved") {
      return { ok: false, reason: "not_eligible" };
    }
    const existing = this.receipts.get(input.summaryId);
    if (existing) return { ok: true, receiptId: existing.id };
    const id = `demo-receipt-${input.summaryId}`;
    this.receipts.set(input.summaryId, { id, summaryId: input.summaryId });
    summary.status = "approved";
    snap.approvalStatus = "approved";
    snap.view = "receipt";
    snap.revision += 1;
    this.sessions.set(input.sessionId, snap);
    return { ok: true, receiptId: id };
  }

  reset(sessionId: string): SessionSnapshot {
    const prev = this.sessions.get(sessionId);
    const scenarioId = prev?.scenarioId ?? null;
    const next = emptySnapshot(sessionId, scenarioId);
    next.epoch = (prev?.epoch ?? 0) + 1;
    this.sessions.set(sessionId, next);
    return structuredClone(next);
  }

  patch(
    sessionId: string,
    patch: Partial<SessionSnapshot>,
  ): SessionSnapshot | undefined {
    const snap = this.sessions.get(sessionId);
    if (!snap) return undefined;
    const next = { ...snap, ...patch };
    this.sessions.set(sessionId, next);
    return structuredClone(next);
  }

  getSummary(summaryId: string): PurchaseSummary | undefined {
    const s = this.summaries.get(summaryId);
    return s ? structuredClone(s) : undefined;
  }

  ingestInput(_input: InputEvent): void {
    // Identity already on the event; store keeps revision authority on apply().
  }

  private markSavedEligibility(next: SessionSnapshot) {
    next.savedItems = next.savedItems.map((s) => ({
      ...s,
      eligible: !next.exclusions.includes(s.productId),
    }));
  }

  private reject(
    proposal: AgentProposal,
    snap: SessionSnapshot,
    reason: string,
  ): ApplyResult {
    return {
      ok: false,
      reason,
      snapshot: structuredClone(snap),
      speakable: {
        turnId: proposal.turnId,
        revision: snap.revision,
        content: `I couldn't apply that update (${reason}). Your current choices are unchanged.`,
        channel: "commentary",
      },
      displayEventId: `state-${snap.revision}`,
    };
  }
}

export function offersCheckedForLowestCost(productIds: string[]) {
  return OFFERS.filter(
    (o) => productIds.includes(o.productId) && o.availability === "in_stock",
  );
}
