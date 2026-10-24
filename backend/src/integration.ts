/** Issue #2 public contract projection and action adapter. Legacy client remains available for internal tools. */
import type {
  CatalogData,
  Session,
  Product,
  Offer,
  Evidence,
  Proposal,
  Quote,
} from "./contracts.ts";
import { SessionStore, type InterpretedCheckoutApproval } from "./store.ts";
import { object, keys, requireThat, strings } from "./validation.ts";
export const productView = (p: Product) => p.canonical ? structuredClone(p.canonical) : ({
  ...p,
  model: p.name,
  title: p.name,
  variantId: p.variantId ?? p.variant,
  image: p.media[0]
    ? {
        ...p.media[0],
        source:
          p.media[0].classification === "proxy"
            ? "Synthetic category illustration"
            : "Catalog source",
      }
    : null,
  specs: p.specifications,
});
export const offerView = (o: Offer) => o.canonical ? structuredClone(o.canonical) : ({
  ...o,
  variantId: o.variantId ?? null,
  unitPriceMinor: o.unitPrice,
  shippingMinor: o.shipping,
  otherFeesMinor: o.otherFees,
  setupCostMinor: o.setupCost ?? (o.setupCost === null ? null : 0),
  availability: o.available ? "in_stock" : "unavailable",
  destination: o.destination ?? null,
  returnTerms: o.returnConditions,
});
export const evidenceView = (e: Evidence) => e.canonical ? structuredClone(e.canonical) : ({
  ...e,
  checkedOn: e.capturedAt,
  rating: e.rating?.value ?? null,
  ratingCount: e.rating?.count ?? null,
  writtenReviewCount: null,
  purchaseCount: null,
  purchaseCountPeriod: null,
  reviewScope: e.source,
  excerpt: null,
});
export function quoteView(q: Quote) {
  return {
    ...q,
    product: productView(q.product),
    offer: offerView(q.offer),
    productId: q.product.id,
    variantId: q.product.variantId ?? q.product.variant,
    offerId: q.offer.id,
    sellerId: q.offer.sellerId,
    quantity: q.quantity,
    currency: q.currency,
    lineItemsMinor: {
      items: q.subtotal,
      shipping: q.shipping,
      otherFees: q.otherFees,
      requiredSetup: q.setupCost,
      tax: q.tax ?? null,
    },
    totalMinor: q.total,
    destination: q.destination,
    deliveryWindow: q.offer.canonical?.deliveryWindow ?? q.offer.deliveryWindow ?? {
      latestOffsetDays: q.offer.deliveryDays,
    },
    conditions: [q.offer.returnConditions, ...q.offer.conditions],
    uncertainties: q.offer.uncertainties,
  };
}
export function summaryView(m: NonNullable<Session["summary"]>) {
  return {
    ...m,
    ...quoteView(m.quote),
    status: m.approvalNonce
      ? "awaiting_approval"
      : m.playback === "interrupted"
        ? "interrupted"
        : "presenting",
  };
}
export function sessionView(s: Session) {
  return {
    ...s,
    sessionId: s.id,
    hardConstraints: s.constraints,
    exclusions: s.excludedProductIds,
    shortlistIds: s.shortlist,
    displayOrder: s.displayOrder,
    focusedProductId: s.view?.focusProductId ?? null,
    selectedOfferId: s.selection?.offerId ?? null,
    cards: s.view?.cards ?? [],
    view: s.stage,
    summaryId: s.summary?.id ?? null,
    summary: s.summary ? summaryView(s.summary) : null,
    approvalStatus: s.receipt
      ? "complete"
      : s.summary?.approvalNonce
        ? "awaiting_approval"
        : s.summary
          ? "presenting"
          : "not_prepared",
    receipt: s.receipt
      ? {
          ...s.receipt,
          sessionId: s.id,
          acceptedOrder: {
            ...quoteView(s.receipt.quote),
            summaryId: s.receipt.summaryId,
            summaryRevision: s.receipt.summaryRevision,
          },
        }
      : null,
  };
}
export function catalogView(c: CatalogData) {
  const { canonical, ...legacy } = c;
  return {
    ...legacy,
    ...canonical,
    products: c.products.map(productView),
    offers: c.offers.map(offerView),
    evidence: c.evidence.map(evidenceView),
  };
}
export function integrationResponse(body: any): any {
  if (body?.products && body?.offers && body?.evidence)
    return catalogView(body);
  if (Array.isArray(body?.eligible) && Array.isArray(body?.ineligible))
    return { ...body, eligible: body.eligible.map(quoteView), ineligible: body.ineligible.map(quoteView) };
  if (body?.session) {
    const session = sessionView(body.session);
    return {
      ...body,
      session,
      ...(body.receipt ? { receipt: session.receipt } : {}),
    };
  }
  if (body?.error?.details?.session)
    return {
      ...body,
      error: {
        ...body.error,
        details: {
          ...body.error.details,
          session: sessionView(body.error.details.session),
        },
      },
    };
  return body;
}
export function acceptAction(store: SessionStore, id: string, raw: unknown) {
  object(raw);
  keys(raw, [
    "sessionId",
    "epoch",
    "eventId",
    "turnId",
    "baseRevision",
    "action",
    "payload",
    "evidenceIds",
  ]);
  requireThat(
    raw.sessionId === id,
    "WRONG_SESSION",
    "Action session mismatch.",
    409,
  );
  object(raw.payload);
  const evidenceIds = raw.evidenceIds ?? [];
  requireThat(
    strings(evidenceIds, 100) && evidenceIds.every(id => store.profile.catalog.evidence.some(e => e.id === id)),
    "UNKNOWN_EVIDENCE",
    "Use a bounded unique list of known evidence IDs.",
  );
  const payload = raw.payload;
  return store.once(id, raw.epoch as number, raw.eventId as string, raw, () => {
    const current = store.get(id);
    requireThat(
      raw.baseRevision === current.revision,
      "STALE_REVISION",
      "Reevaluate using the latest snapshot.",
      409,
      { session: current },
    );
    requireThat(
      current.turn &&
        raw.turnId === current.turn.id &&
        current.turn.status === "active",
      "STALE_TURN",
      "Turn is no longer active.",
      409,
      { session: current },
    );
    const p: Proposal = {
      expectedRevision: raw.baseRevision as number,
      turnId: raw.turnId as string,
      ...(raw.evidenceIds ? { evidenceIds: raw.evidenceIds as string[] } : {}),
    };
    switch (raw.action) {
      case "clarify":
        keys(payload, ["needs", "preferences"]);
        p.needs = payload.needs as string[];
        if (payload.preferences !== undefined) p.preferences = payload.preferences as string[];
        p.stage = "understanding";
        break;
      case "set_constraints":
        keys(payload, ["constraints", "destination", "preferences", "exclusions"]);
        p.constraints = payload.constraints as Proposal["constraints"];
        p.destination = payload.destination as string;
        if (payload.preferences !== undefined) p.preferences = payload.preferences as string[];
        if (payload.exclusions !== undefined) p.excludedProductIds = payload.exclusions as string[];
        break;
      case "set_priority":
        keys(payload, ["priority"]);
        p.priority = payload.priority as string;
        p.stage = "buying_priorities";
        break;
      case "shortlist":
        keys(payload, ["productIds", "displayOrder", "cards", "stage"]);
        p.shortlist = payload.productIds as string[];
        if (payload.displayOrder !== undefined) p.displayOrder = payload.displayOrder as string[];
        p.stage = (payload.stage as string) ?? "shortlist";
        if (payload.cards)
          p.view = {
            stage: "shortlist",
            focusProductId: null,
            cards: payload.cards as any,
            evidenceIds: [],
            activeVideoId: null,
          };
        break;
      case "focus": {
        keys(payload, ["productId"]);
        const s = store.get(id);
        p.view = {
          stage: "shortlist",
          focusProductId: payload.productId as string,
          cards: s.view?.cards ?? [],
          evidenceIds: s.evidenceIds,
          activeVideoId: null,
        };
        break;
      }
      case "compare":
        keys(payload, ["productIds"]);
        p.comparisonIds = payload.productIds as string[];
        p.stage = "comparison";
        break;
      case "show_evidence":
        keys(payload, ["evidenceIds"]);
        p.evidenceIds = payload.evidenceIds as string[];
        p.stage = "evidence";
        break;
      case "select_offer":
        keys(payload, ["offerId", "quantity"]);
        p.selection = {
          offerId: payload.offerId as string,
          quantity: payload.quantity as number,
        };
        p.stage = "offers";
        break;
      case "save":
        keys(payload, ["productIds", "rationale"]);
        return {
          session: store.saveChoice(
            id,
            p.expectedRevision,
            p.turnId,
            payload.productIds,
            payload.rationale,
          ),
        };
      case "restore":
        keys(payload, ["savedId"]);
        return {
          session: store.restoreChoice(
            id,
            p.expectedRevision,
            p.turnId,
            payload.savedId,
          ),
        };
      case "defer":
        keys(payload, []);
        return { session: store.cancel(id, p.turnId) };
      case "cancel":
        keys(payload, []);
        return { session: store.cancel(id, p.turnId) };
      case "prepare_summary":
        keys(payload, []);
        return { session: store.summarize(id, p.expectedRevision, p.turnId) };
      case "propose_approval":
        requireThat(
          false,
          "UNTRUSTED_APPROVAL",
          "Model proposals cannot approve a purchase. Use trusted input approval.",
        );
        break;
      default:
        requireThat(false, "UNKNOWN_ACTION", "Unknown action.");
    }
    return store.propose(id, p);
  });
}
export function acceptApproval(store: SessionStore, id: string, raw: unknown, interpretedApproval?: InterpretedCheckoutApproval) {
  object(raw);
  keys(raw, [
    "sessionId",
    "epoch",
    "eventId",
    "turnId",
    "baseRevision",
    "summaryId",
    "summaryRevision",
    "modality",
    "explicitIntent",
    "voiceEvidence",
  ]);
  requireThat(
    raw.sessionId === id,
    "WRONG_SESSION",
    "Approval session mismatch.",
    409,
  );
  requireThat(
    raw.modality === "voice" || raw.modality === "text",
    "INVALID_MODE",
    "Only deliberate shopper voice/text can approve.",
  );
  const payload = interpretedApproval ? { ...raw, interpretedApproval: {
    intent: interpretedApproval.intent, transcript: interpretedApproval.transcript,
    summaryId: interpretedApproval.summaryId, summaryRevision: interpretedApproval.summaryRevision,
    requiresApprovalQuestion: interpretedApproval.requiresApprovalQuestion,
  } } : raw;
  return store.once(id, raw.epoch as number, raw.eventId as string, payload, () => {
    const s = store.get(id);
    requireThat(
      s.turn?.input?.modality === raw.modality,
      "UNTRUSTED_APPROVAL",
      "Approval must match a fresh shopper input of the same modality.",
      409,
    );
    requireThat(
      s.summary &&
        s.summary.id === raw.summaryId &&
        s.summary.revision === raw.summaryRevision,
      "STALE_SUMMARY",
      "Summary identity or revision changed.",
      409,
    );
    requireThat(
      raw.explicitIntent === "confirm_simulated_purchase",
      "AMBIGUOUS_APPROVAL",
      "Explicit simulated purchase intent required.",
    );
    let observation: any = {};
    if (raw.modality === "voice") {
      object(raw.voiceEvidence);
      keys(raw.voiceEvidence, [
        "transcript",
        "final",
        "confidence",
        "source",
        "echoDetected",
      ]);
      observation = raw.voiceEvidence;
      requireThat(
        raw.voiceEvidence.transcript === s.turn?.input?.text,
        "UNTRUSTED_APPROVAL",
        "Voice evidence must match the accepted shopper transcript.",
        409,
      );
    } else observation = { transcript: s.turn?.input?.text };
    return store.approve(
      id,
      {
        ...observation,
        expectedRevision: raw.baseRevision,
        turnId: raw.turnId,
        summaryId: raw.summaryId,
        approvalNonce: s.turn?.approvalWindow?.nonce,
      },
      raw.modality === "text",
      interpretedApproval,
    );
  });
}
