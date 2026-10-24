import type { CatalogProfile, ShoppingView } from "./contracts.ts";
import {
  randomUUID,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { EventEmitter } from "node:events";
import { nonTechProfile, quoteOffer, eligibleOffers } from "./catalog.ts";
import {
  requireThat,
  object,
  keys,
  integer,
  strings,
  validateConstraints,
  ApiError,
} from "./validation.ts";
import type {
  Session,
  Proposal,
  VoiceObservation,
  Summary,
} from "./contracts.ts";

const clone = <T>(x: T): T => structuredClone(x);
const token = () => randomBytes(32).toString("hex");
export const hash = (x: string) => createHash("sha256").update(x).digest("hex");
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
const money = (n: number, currency: string) =>
  `${currency} ${(n / 100).toFixed(2)}`;
export class SessionStore {
  private records = new Map<string, { state: Session; tokenHash: string }>();
  readonly events = new EventEmitter();
  readonly ttlMs: number;
  readonly profile: CatalogProfile;
  constructor(
    ttlMs = 2 * 60 * 60 * 1000,
    profile: CatalogProfile = nonTechProfile,
  ) {
    this.profile = profile;
    this.ttlMs = ttlMs;
    this.events.setMaxListeners(100);
  }
  create(scenarioId?: string) {
    this.sweep();
    requireThat(
      this.records.size < 200,
      "CAPACITY",
      "Demo session capacity reached.",
      503,
    );
    const scenario = scenarioId
      ? this.profile.scenarios.find((s) => s.id === scenarioId)
      : null;
    requireThat(
      !scenarioId || scenario,
      "UNKNOWN_SCENARIO",
      "Unknown scenario.",
    );
    const now = new Date(),
      id = randomUUID(),
      accessToken = token();
    const state: Session = {
      id,
      revision: 0,
      epoch: 0,
      scenarioId: scenario?.id ?? null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
      destination: this.profile.destination,
      view: null,
      needs: [],
      constraints: clone({
        currency: this.profile.catalog.currency,
        ...scenario?.constraints,
      }),
      preferences: [],
      excludedProductIds: [],
      shortlist: [],
      selection: null,
      evidenceIds: [],
      turn: null,
      summary: null,
      receipt: null,
      lastOutcome: null,
    };
    this.records.set(id, { state, tokenHash: hash(accessToken) });
    return { session: clone(state), accessToken };
  }
  private record(id: string) {
    const r = this.records.get(id);
    requireThat(r, "SESSION_NOT_FOUND", "Session not found or expired.", 404);
    if (Date.parse(r.state.expiresAt) <= Date.now()) {
      this.records.delete(id);
      this.events.emit(id, { type: "session.expired" });
      throw new ApiError(
        410,
        "SESSION_EXPIRED",
        "Session expired; create a new session.",
      );
    }
    return r;
  }
  authenticate(id: string, accessToken: string) {
    requireThat(
      safeEqual(this.record(id).tokenHash, hash(accessToken)),
      "UNAUTHORIZED",
      "Invalid session token.",
      401,
    );
  }
  get(id: string) {
    return clone(this.record(id).state);
  }
  private commit(next: Session) {
    const r = this.record(next.id);
    next.revision = r.state.revision + 1;
    r.state = clone(next);
    this.events.emit(next.id, {
      type: "session.snapshot",
      session: clone(next),
    });
    return clone(next);
  }
  private revision(s: Session, expected: unknown) {
    requireThat(
      integer(expected) && expected === s.revision,
      "STALE_REVISION",
      "Read the latest snapshot before retrying.",
      409,
      { currentRevision: s.revision },
    );
  }
  private mutable(s: Session) {
    requireThat(
      !s.receipt,
      "ORDER_COMPLETE",
      "This simulated order is complete; reset to start again.",
      409,
    );
  }
  private active(s: Session, id: unknown) {
    requireThat(
      s.turn?.id === id && s.turn?.status === "active",
      "STALE_TURN",
      "Turn is cancelled, superseded, or unknown.",
      409,
    );
  }
  private invalidate(s: Session) {
    s.summary = null;
    s.lastOutcome = null;
  }
  beginTurn(id: string, expected: number) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    if (s.summary && s.summary.playback !== "complete") this.invalidate(s);
    s.turn = {
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      status: "active",
      approvalWindow: s.summary?.approvalNonce
        ? { summaryId: s.summary.id, nonce: s.summary.approvalNonce }
        : null,
    };
    return this.commit(s);
  }
  cancel(id: string, turnId: string) {
    const s = this.get(id);
    this.active(s, turnId);
    this.mutable(s);
    s.turn!.status = "cancelled";
    this.invalidate(s);
    s.lastOutcome = "cancelled";
    return this.commit(s);
  }
  reset(id: string, expected: number) {
    const s = this.get(id);
    this.revision(s, expected);
    const scenario = this.profile.scenarios.find((x) => x.id === s.scenarioId);
    Object.assign(s, {
      epoch: s.epoch + 1,
      destination: this.profile.destination,
      view: null,
      needs: [],
      constraints: clone({
        currency: this.profile.catalog.currency,
        ...scenario?.constraints,
      }),
      preferences: [],
      excludedProductIds: [],
      shortlist: [],
      selection: null,
      evidenceIds: [],
      turn: null,
      summary: null,
      receipt: null,
      lastOutcome: null,
    });
    return this.commit(s);
  }
  private validateView(value: unknown) {
    object(value);
    keys(value, [
      "stage",
      "focusProductId",
      "cards",
      "evidenceIds",
      "activeVideoId",
    ]);
    requireThat(
      [
        "solution-types",
        "priorities",
        "shortlist",
        "evidence",
        "offers",
      ].includes(value.stage as string),
      "INVALID_VIEW",
      "Unknown shopping stage.",
    );
    requireThat(
      value.focusProductId === null ||
        this.profile.catalog.products.some(
          (p) => p.id === value.focusProductId,
        ),
      "UNKNOWN_PRODUCT",
      "Unknown focused product.",
    );
    requireThat(
      Array.isArray(value.cards) && value.cards.length <= 8,
      "INVALID_VIEW",
      "At most eight product cards.",
    );
    const knownEvidence = (ids: unknown) =>
      strings(ids, 30) &&
      ids.every((id) => this.profile.catalog.evidence.some((e) => e.id === id));
    requireThat(
      knownEvidence(value.evidenceIds),
      "UNKNOWN_EVIDENCE",
      "Unknown panel evidence.",
    );
    requireThat(
      value.activeVideoId === null ||
        this.profile.catalog.products.some((p) =>
          p.videos?.some((v) => v.id === value.activeVideoId),
        ),
      "UNKNOWN_VIDEO",
      "Video must come from curated catalog evidence.",
    );
    for (const card of value.cards) {
      object(card);
      keys(card, [
        "productId",
        "role",
        "rank",
        "reason",
        "compromise",
        "evidenceIds",
      ]);
      requireThat(
        this.profile.catalog.products.some((p) => p.id === card.productId),
        "UNKNOWN_PRODUCT",
        "Unknown card product.",
      );
      requireThat(
        [
          "best-value",
          "best-quality",
          "lowest-cost-suitable",
          "close-match",
          "discovery",
        ].includes(card.role as string),
        "INVALID_VIEW",
        "Unknown buying role.",
      );
      requireThat(
        card.rank === null || [1, 2, 3].includes(card.rank as number),
        "INVALID_VIEW",
        "Rank must be 1, 2, 3 or null.",
      );
      for (const field of ["reason", "compromise"])
        requireThat(
          typeof card[field] === "string" &&
            (card[field] as string).length > 0 &&
            (card[field] as string).length <= 1000,
          "INVALID_VIEW",
          "Cards need bounded reasons and compromises.",
        );
      requireThat(
        knownEvidence(card.evidenceIds) && (card.evidenceIds as string[]).every(id =>
          this.profile.catalog.evidence.some(e => e.id === id && e.subjectType === "product" && e.subjectId === card.productId)),
        "UNKNOWN_EVIDENCE",
        "Card evidence must belong to that product; seller evidence belongs in the offers panel.",
      );
    }
    requireThat(
      new Set(value.cards.map((c) => c.productId)).size === value.cards.length,
      "INVALID_VIEW",
      "Duplicate product card.",
    );
  }
  propose(id: string, raw: unknown) {
    object(raw);
    keys(raw, [
      "expectedRevision",
      "turnId",
      "needs",
      "constraints",
      "preferences",
      "excludedProductIds",
      "shortlist",
      "selection",
      "evidenceIds",
      "destination",
      "view",
    ]);
    const s = this.get(id);
    this.revision(s, raw.expectedRevision);
    this.active(s, raw.turnId);
    this.mutable(s);
    for (const key of [
      "needs",
      "preferences",
      "excludedProductIds",
      "shortlist",
      "evidenceIds",
    ] as const)
      if (raw[key] !== undefined)
        requireThat(
          strings(raw[key], 50),
          "INVALID_PROPOSAL",
          `${key} must be a bounded unique string array.`,
        );
    if (raw.constraints !== undefined) validateConstraints(raw.constraints);
    if (raw.selection !== undefined && raw.selection !== null) {
      object(raw.selection);
      keys(raw.selection, ["offerId", "quantity"]);
      requireThat(
        typeof raw.selection.offerId === "string" &&
          integer(raw.selection.quantity, 1, 99),
        "INVALID_SELECTION",
        "Selection needs an offer ID and integer quantity 1–99.",
      );
    }
    if (raw.destination !== undefined)
      requireThat(
        typeof raw.destination === "string" &&
          raw.destination.trim().length > 0 &&
          raw.destination.length <= 200,
        "INVALID_DESTINATION",
        "Provide a short demo destination.",
      );
    if (raw.view !== undefined) this.validateView(raw.view);
    const p = raw as unknown as Proposal;
    for (const key of ["excludedProductIds", "shortlist"] as const)
      for (const productId of p[key] ?? [])
        requireThat(
          this.profile.catalog.products.some((x) => x.id === productId),
          "UNKNOWN_PRODUCT",
          `Unknown product: ${productId}`,
        );
    for (const evidenceId of p.evidenceIds ?? [])
      requireThat(
        this.profile.catalog.evidence.some((x) => x.id === evidenceId),
        "UNKNOWN_EVIDENCE",
        `Unknown evidence: ${evidenceId}`,
      );
    if (p.selection)
      requireThat(
        this.profile.catalog.offers.some((x) => x.id === p.selection!.offerId),
        "UNKNOWN_OFFER",
        "Unknown seller offer.",
      );
    const before = JSON.stringify({
      destination: s.destination,
      constraints: s.constraints,
      excluded: s.excludedProductIds,
      selection: s.selection,
    });
    for (const key of [
      "needs",
      "constraints",
      "preferences",
      "excludedProductIds",
      "shortlist",
      "selection",
      "evidenceIds",
      "destination",
      "view",
    ] as const)
      if (p[key] !== undefined) Object.assign(s, { [key]: clone(p[key]) });
    if (p.view?.cards.length) {
      const visibleIds = p.view.cards.map((c) => c.productId);
      requireThat(
        !p.shortlist ||
          JSON.stringify(p.shortlist) === JSON.stringify(visibleIds),
        "VIEW_ORDER_CONFLICT",
        "Shortlist must follow the visible product card order.",
      );
      s.shortlist = visibleIds;
    }
    requireThat(
      s.shortlist.every((x) => !s.excludedProductIds.includes(x)),
      "EXCLUDED_SHORTLIST",
      "Shortlist contains an excluded product.",
    );
    if (s.selection) {
      const q = quoteOffer(
        s.selection.offerId,
        s.selection.quantity,
        s.constraints,
        s.excludedProductIds,
        this.profile.catalog,
        s.destination,
      );
      // A changed constraint may invalidate an existing choice; retain the constraint, clear the choice.
      if (!q.eligible) {
        if (p.selection)
          throw new ApiError(
            422,
            "SELECTION_CONFLICT",
            "Selected offer violates constraints or has incomplete pricing.",
            q.conflicts,
          );
        s.selection = null;
      }
    }
    if (
      before !==
      JSON.stringify({
        destination: s.destination,
        constraints: s.constraints,
        excluded: s.excludedProductIds,
        selection: s.selection,
      })
    )
      this.invalidate(s);
    const accepted = this.commit(s);
    return {
      session: accepted,
      offers: eligibleOffers(
        s.constraints,
        s.selection?.quantity ?? 1,
        s.excludedProductIds,
        this.profile.catalog,
        s.destination,
      ),
    };
  }
  summarize(id: string, expected: number, turnId: string) {
    const s = this.get(id);
    this.revision(s, expected);
    this.active(s, turnId);
    this.mutable(s);
    requireThat(s.selection, "NO_SELECTION", "Select an eligible offer first.");
    const q = quoteOffer(
      s.selection.offerId,
      s.selection.quantity,
      s.constraints,
      s.excludedProductIds,
      this.profile.catalog,
      s.destination,
    );
    requireThat(
      q.eligible && q.total !== null,
      "SUMMARY_BLOCKED",
      "Cannot summarize an ineligible purchase.",
      422,
      q.conflicts,
    );
    const spokenText = `This is a simulated purchase only. ${q.quantity} of ${q.product.name}, variant ${q.product.variant}, sold by ${q.offer.sellerName}. Items ${money(q.subtotal, q.currency)}, shipping ${money(q.shipping!, q.currency)}, other fees ${money(q.otherFees!, q.currency)}; total ${money(q.total!, q.currency)}. Destination: ${q.destination}. Delivery: ${q.offer.deliveryConditions} Returns: ${q.offer.returnConditions} Conditions: ${q.offer.conditions.join(" ")} Material uncertainties: ${q.offer.uncertainties.length ? q.offer.uncertainties.join("; ") : "none recorded in this proxy fixture"}. All offer details are synthetic demo data. To approve, say “Confirm this simulated purchase.” You can also change it or cancel.`;
    s.summary = {
      id: randomUUID(),
      revision: s.revision + 1,
      responseTurnId: turnId,
      quote: q,
      spokenText,
      textHash: hash(spokenText),
      displayed: false,
      playback: "pending",
      approvalNonce: null,
    };
    return this.commit(s);
  }
  presentation(id: string, raw: unknown) {
    object(raw);
    keys(raw, ["summaryId", "turnId", "textHash", "event"]);
    const s = this.get(id);
    this.mutable(s);
    const m = s.summary;
    requireThat(
      m &&
        m.id === raw.summaryId &&
        m.textHash === raw.textHash &&
        m.responseTurnId === raw.turnId,
      "STALE_SUMMARY",
      "Presentation does not match the current exact summary.",
      409,
    );
    this.active(s, raw.turnId);
    requireThat(
      [
        "displayed",
        "playback_started",
        "playback_completed",
        "playback_interrupted",
      ].includes(raw.event as string),
      "INVALID_EVENT",
      "Unknown presentation event.",
    );
    if (raw.event === "displayed") m.displayed = true;
    if (raw.event === "playback_started") {
      requireThat(
        m.playback === "pending",
        "INVALID_PLAYBACK",
        "Playback must start from pending.",
        409,
      );
      m.playback = "playing";
    }
    if (raw.event === "playback_completed") {
      requireThat(
        m.playback === "playing",
        "INVALID_PLAYBACK",
        "Playback must be started and uninterrupted.",
        409,
      );
      m.playback = "complete";
    }
    if (raw.event === "playback_interrupted") {
      m.playback = "interrupted";
      m.approvalNonce = null;
      s.lastOutcome = "summary_interrupted";
    }
    if (m.displayed && m.playback === "complete" && !m.approvalNonce)
      m.approvalNonce = token();
    return this.commit(s);
  }
  approve(id: string, raw: unknown) {
    object(raw);
    keys(raw, [
      "expectedRevision",
      "turnId",
      "summaryId",
      "approvalNonce",
      "transcript",
      "final",
      "confidence",
      "source",
      "echoDetected",
    ]);
    const s = this.get(id);
    // Retries of the same already accepted approval produce the same receipt even after revision advanced.
    if (s.receipt) {
      requireThat(
        s.receipt.summaryId === raw.summaryId &&
          s.turn?.id === raw.turnId &&
          s.turn?.approvalWindow?.nonce === raw.approvalNonce,
        "ORDER_COMPLETE",
        "A different order is already complete.",
        409,
      );
      return { session: s, receipt: s.receipt };
    }
    this.revision(s, raw.expectedRevision);
    this.active(s, raw.turnId);
    const m = s.summary,
      window = s.turn!.approvalWindow;
    requireThat(
      m &&
        m.id === raw.summaryId &&
        m.displayed &&
        m.playback === "complete" &&
        m.approvalNonce &&
        window?.summaryId === m.id &&
        safeEqual(window.nonce, m.approvalNonce) &&
        raw.approvalNonce === m.approvalNonce,
      "APPROVAL_NOT_READY",
      "A fresh shopper turn must follow the current complete spoken and displayed summary.",
      409,
    );
    const o = raw as unknown as VoiceObservation;
    requireThat(
      o.final === true &&
        typeof o.confidence === "number" &&
        o.confidence >= 0.9 &&
        o.confidence <= 1 &&
        o.source === "shopper" &&
        o.echoDetected === false,
      "UNTRUSTED_APPROVAL",
      "Approval must be final, confident shopper speech without echo.",
    );
    requireThat(
      typeof o.transcript === "string" && o.transcript.length <= 200,
      "INVALID_APPROVAL",
      "Invalid approval transcript.",
    );
    const normalized = o.transcript
      .toLowerCase()
      .replace(/[.,!?“”"']/g, "")
      .trim()
      .replace(/\s+/g, " ");
    const accepted = [
      "confirm this simulated purchase",
      "yes confirm this simulated purchase",
      "confirm purchase",
      "yes confirm purchase",
      "yes buy it",
    ];
    requireThat(
      accepted.includes(normalized),
      "AMBIGUOUS_APPROVAL",
      "Ask for explicit purchase confirmation; ambiguous assent is not approval.",
    );
    const q = quoteOffer(
      m.quote.offer.id,
      m.quote.quantity,
      s.constraints,
      s.excludedProductIds,
      this.profile.catalog,
      s.destination,
    );
    requireThat(
      q.eligible && JSON.stringify(q) === JSON.stringify(m.quote),
      "STALE_QUOTE",
      "Offer changed; speak and display a fresh summary.",
      409,
    );
    s.receipt = {
      id: `SIM-${randomUUID()}`,
      simulated: true,
      label: "SIMULATED — no payment or real order",
      summaryId: m.id,
      summaryRevision: m.revision,
      createdAt: new Date().toISOString(),
      quote: clone(q),
    };
    s.lastOutcome = "simulated_purchase_complete";
    const result = this.commit(s);
    return { session: result, receipt: result.receipt };
  }
  sweep() {
    for (const [id, r] of this.records)
      if (Date.parse(r.state.expiresAt) <= Date.now()) {
        this.records.delete(id);
        this.events.emit(id, { type: "session.expired" });
      }
  }
}
