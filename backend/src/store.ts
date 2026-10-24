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
  InputEnvelope,
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
  private attachments = new Map<
    string,
    { sessionId: string; epoch: number; contentType: string; bytes: Buffer }
  >();
  private processed = new Map<
    string,
    { fingerprint: string; result: unknown }
  >();
  private clearSessionData(id: string) {
    for (const [key, asset] of this.attachments)
      if (asset.sessionId === id) this.attachments.delete(key);
    for (const key of this.processed.keys())
      if (key.startsWith(id + ":")) this.processed.delete(key);
  }
  private records = new Map<
    string,
    { state: Session; tokenHash: string; usedTurnIds: Set<string> }
  >();
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
      presentationMode: "voice",
      stage: "opening",
      comparisonIds: [],
      savedItems: [],
      history: [],
      attachmentIds: [],
      priority: null,
      mediaOwner: null,
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
    this.records.set(id, {
      state,
      tokenHash: hash(accessToken),
      usedTurnIds: new Set(),
    });
    return { session: clone(state), accessToken };
  }
  private record(id: string) {
    const r = this.records.get(id);
    requireThat(r, "SESSION_NOT_FOUND", "Session not found or expired.", 404);
    if (Date.parse(r.state.expiresAt) <= Date.now()) {
      this.records.delete(id);
      this.clearSessionData(id);
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
      { currentRevision: s.revision, session: clone(s) },
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
  beginTurn(id: string, expected: number, input?: InputEnvelope) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    if (s.summary && !(s.summary.approvalNonce && s.summary.displayed))
      this.invalidate(s);
    if (input) {
      s.history.push({
        turnId: input.turnId,
        eventId: input.eventId,
        modality: input.modality,
        text: input.text ?? null,
        productIds: [...input.visibleProductIds],
        createdAt: new Date().toISOString(),
      });
      s.history = s.history.slice(-100);
      if (input.modality === "text" && s.presentationMode !== "text") {
        this.invalidate(s);
        s.presentationMode = "text";
      }
      if (input.modality === "voice" && s.presentationMode !== "voice") {
        this.invalidate(s);
        s.presentationMode = "voice";
      }
    }
    s.mediaOwner = null;
    if (input) this.record(id).usedTurnIds.add(input.turnId);
    s.turn = {
      id: input?.turnId ?? randomUUID(),
      ...(input ? { input: clone(input) } : {}),
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
    this.clearSessionData(id);
    this.record(id).usedTurnIds.clear();
    Object.assign(s, {
      epoch: s.epoch + 1,
      destination: this.profile.destination,
      view: null,
      presentationMode: "voice",
      stage: "opening",
      comparisonIds: [],
      savedItems: [],
      history: [],
      attachmentIds: [],
      priority: null,
      mediaOwner: null,
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
        knownEvidence(card.evidenceIds) &&
          (card.evidenceIds as string[]).every((id) =>
            this.profile.catalog.evidence.some(
              (e) =>
                e.id === id &&
                e.subjectType === "product" &&
                e.subjectId === card.productId,
            ),
          ),
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
      "stage",
      "comparisonIds",
      "priority",
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
    if (raw.constraints !== undefined) {
      validateConstraints(raw.constraints);
      const incoming = raw.constraints as Session["constraints"];
      raw = {
        ...raw,
        constraints: {
          ...s.constraints,
          ...incoming,
          requiredSpecifications: {
            ...s.constraints.requiredSpecifications,
            ...incoming.requiredSpecifications,
          },
          compatibility: {
            ...s.constraints.compatibility,
            ...incoming.compatibility,
          },
        },
      };
    }
    object(raw);
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
    if (raw.stage !== undefined)
      requireThat(
        [
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
        ].includes(raw.stage as string),
        "INVALID_VIEW",
        "Unknown stage.",
      );
    if (raw.priority !== undefined)
      requireThat(
        raw.priority === null ||
          ["best-value", "best-quality", "lowest-cost-suitable"].includes(
            raw.priority as string,
          ),
        "INVALID_PRIORITY",
        "Unknown buying priority.",
      );
    if (raw.comparisonIds !== undefined)
      requireThat(
        strings(raw.comparisonIds, 4) &&
          raw.comparisonIds.every((pid) =>
            this.profile.catalog.products.some((p) => p.id === pid),
          ),
        "UNKNOWN_PRODUCT",
        "Compare up to four known products.",
      );
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
      "stage",
      "comparisonIds",
      "priority",
    ] as const)
      if (p[key] !== undefined) Object.assign(s, { [key]: clone(p[key]) });
    if (p.shortlist && !p.view) s.view = null;
    if (p.view && !p.stage)
      s.stage =
        p.view.stage === "priorities"
          ? "buying_priorities"
          : p.view.stage === "solution-types"
            ? "solution_types"
            : p.view.stage;
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
    const spokenText = `This is a simulated purchase only. ${q.quantity} of ${q.product.name}, variant ${q.product.variant}, sold by ${q.offer.sellerName}. Items ${money(q.subtotal, q.currency)}, shipping ${money(q.shipping!, q.currency)}, other fees ${money(q.otherFees!, q.currency)}, required setup ${money(q.setupCost!, q.currency)}; total ${money(q.total!, q.currency)}. Destination: ${q.destination}. Delivery: ${q.offer.deliveryConditions} Setup: ${q.offer.setupConditions ?? "No additional setup cost in this fixture."} Returns: ${q.offer.returnConditions} Conditions: ${q.offer.conditions.join(" ")} Material uncertainties: ${q.offer.uncertainties.length ? q.offer.uncertainties.join("; ") : "none recorded in this proxy fixture"}. All offer details are synthetic demo data. To approve, ${s.presentationMode === "text" ? "type" : "say"} “Confirm this simulated purchase.” You can also change it or cancel.`;
    s.stage = "summary";
    s.summary = {
      id: randomUUID(),
      presentationMode: s.presentationMode,
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
    if (raw.event !== "displayed")
      requireThat(
        m.presentationMode === "voice",
        "WRONG_PRESENTATION_MODE",
        "Audio events cannot enable text approval.",
      );
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
    if (
      m.displayed &&
      (m.presentationMode === "text" || m.playback === "complete") &&
      m.playback !== "interrupted" &&
      !m.approvalNonce
    )
      m.approvalNonce = token();
    return this.commit(s);
  }
  approve(id: string, raw: unknown, typed = false) {
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
        m.presentationMode === (typed ? "text" : "voice") &&
        (typed || m.playback === "complete") &&
        m.approvalNonce &&
        window?.summaryId === m.id &&
        safeEqual(window.nonce, m.approvalNonce) &&
        raw.approvalNonce === m.approvalNonce,
      "APPROVAL_NOT_READY",
      "A fresh shopper turn must follow the current complete spoken and displayed summary.",
      409,
    );
    const o = raw as unknown as VoiceObservation;
    if (typed)
      requireThat(
        s.turn?.input?.modality === "text" &&
          s.turn.input.text === o.transcript,
        "UNTRUSTED_APPROVAL",
        "Typed approval must exactly match a fresh shopper text input, not an agent proposal.",
      );
    requireThat(
      typed ||
        (o.final === true &&
          typeof o.confidence === "number" &&
          o.confidence >= 0.9 &&
          o.confidence <= 1 &&
          o.source === "shopper" &&
          o.echoDetected === false),
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
    s.stage = "receipt";
    s.lastOutcome = "simulated_purchase_complete";
    const result = this.commit(s);
    return { session: result, receipt: result.receipt };
  }

  /** Dedupe operations by session epoch and caller event identity. Failed calls are not cached. */
  once<T>(
    id: string,
    epoch: number,
    eventId: string,
    payload: unknown,
    operation: () => T,
  ): T {
    const s = this.get(id);
    requireThat(
      epoch === s.epoch,
      "STALE_EPOCH",
      "Reset invalidated this event.",
      409,
    );
    requireThat(
      typeof eventId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(eventId),
      "INVALID_EVENT_ID",
      "Use a bounded unique event ID.",
    );
    const key = id + ":" + epoch + ":" + eventId,
      fingerprint = hash(JSON.stringify(payload)),
      previous = this.processed.get(key);
    if (previous) {
      requireThat(
        previous.fingerprint === fingerprint,
        "EVENT_CONFLICT",
        "Event ID reused with a different payload.",
        409,
      );
      return clone(previous.result) as T;
    }
    requireThat(
      [...this.processed.keys()].filter((k) => k.startsWith(id + ":")).length <
        2000,
      "EVENT_CAPACITY",
      "Reset the demo after 2000 events.",
      429,
    );
    const result = operation();
    this.processed.set(key, { fingerprint, result: clone(result) });
    return result;
  }
  input(id: string, raw: unknown) {
    object(raw);
    keys(raw, [
      "sessionId",
      "epoch",
      "eventId",
      "turnId",
      "baseRevision",
      "modality",
      "text",
      "attachmentId",
      "url",
      "visibleRevision",
      "visibleProductIds",
      "source",
    ]);
    requireThat(
      raw.sessionId === id,
      "WRONG_SESSION",
      "Input session mismatch.",
      409,
    );
    const x = raw as unknown as InputEnvelope;
    return this.once(id, x.epoch, x.eventId, x, () => {
      const s = this.get(id);
      this.revision(s, x.baseRevision);
      requireThat(
        ["voice", "text", "image", "link"].includes(x.modality),
        "INVALID_MODALITY",
        "Unsupported shopper input.",
      );
      requireThat(
        typeof x.turnId === "string" &&
          /^[A-Za-z0-9_-]{1,100}$/.test(x.turnId) &&
          x.turnId !== s.turn?.id &&
          !this.record(id).usedTurnIds.has(x.turnId),
        "INVALID_TURN",
        "Use a fresh turn ID.",
      );
      requireThat(
        x.source === undefined || x.source === "shopper",
        "UNTRUSTED_INPUT",
        "Assistant/video audio is not shopper input.",
      );
      requireThat(
        x.visibleRevision === s.revision &&
          strings(x.visibleProductIds, 50) &&
          JSON.stringify(x.visibleProductIds) === JSON.stringify(s.shortlist),
        "STALE_DISPLAY",
        "Clarify positional references against the latest accepted display.",
        409,
        { session: s },
      );
      requireThat(
        x.text === undefined ||
          (typeof x.text === "string" &&
            x.text.length > 0 &&
            x.text.length <= 4000),
        "INVALID_INPUT",
        "Input text must be bounded.",
      );
      if (x.modality === "text")
        requireThat(!!x.text, "INVALID_INPUT", "Text input requires text.");
      if (x.modality === "image")
        requireThat(
          !!x.attachmentId && s.attachmentIds.includes(x.attachmentId),
          "UNKNOWN_ATTACHMENT",
          "Upload a session image first.",
        );
      if (x.modality === "link")
        requireThat(
          !!x.url && !!this.profile.knownLinks?.[x.url],
          "UNSUPPORTED_LINK",
          "Only curated product links are supported. No URL was fetched.",
        );
      return this.beginTurn(id, x.baseRevision, x);
    });
  }
  addAttachment(
    id: string,
    expected: number,
    contentType: string,
    bytes: Buffer,
  ) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    requireThat(
      bytes.length > 12 && bytes.length <= 2 * 1024 * 1024,
      "INVALID_IMAGE_SIZE",
      "Images must be at most 2 MiB.",
    );
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const webp =
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP";
    requireThat(
      (contentType === "image/png" && png) ||
        (contentType === "image/jpeg" && jpeg) ||
        (contentType === "image/webp" && webp),
      "INVALID_IMAGE_TYPE",
      "Only PNG/JPEG/WebP with matching signatures. SVG and arbitrary documents are rejected.",
    );
    requireThat(
      s.attachmentIds.length < 5,
      "ATTACHMENT_LIMIT",
      "At most five session images.",
    );
    const attachmentId = randomUUID();
    this.attachments.set(attachmentId, {
      sessionId: id,
      epoch: s.epoch,
      contentType,
      bytes,
    });
    s.attachmentIds.push(attachmentId);
    return {
      session: this.commit(s),
      attachment: { id: attachmentId, contentType, size: bytes.length },
    };
  }
  attachment(id: string, attachmentId: string) {
    const s = this.get(id),
      a = this.attachments.get(attachmentId);
    requireThat(
      a && a.sessionId === id && a.epoch === s.epoch,
      "UNKNOWN_ATTACHMENT",
      "Image no longer belongs to this session.",
      404,
    );
    return a;
  }
  switchMode(id: string, expected: number, mode: unknown) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    requireThat(
      mode === "voice" || mode === "text",
      "INVALID_MODE",
      "Choose voice or text.",
    );
    if (s.presentationMode === mode) return s;
    this.invalidate(s);
    s.presentationMode = mode;
    if (s.turn) s.turn.status = "cancelled";
    s.mediaOwner = null;
    return this.commit(s);
  }
  media(id: string, expected: number, kind: unknown, videoId?: unknown) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    requireThat(
      ["video.started", "video.stopped"].includes(kind as string),
      "INVALID_MEDIA",
      "Unknown video event.",
    );
    if (kind === "video.started") {
      requireThat(
        this.profile.catalog.products.some((p) =>
          p.videos?.some((v) => v.id === videoId),
        ),
        "UNKNOWN_VIDEO",
        "Video must be curated.",
      );
      this.invalidate(s);
      if (s.turn) s.turn.status = "cancelled";
      s.mediaOwner = "video";
    } else s.mediaOwner = null;
    return this.commit(s);
  }
  saveChoice(
    id: string,
    expected: number,
    turnId: string,
    productIds: unknown,
    rationale: unknown,
  ) {
    const s = this.get(id);
    this.revision(s, expected);
    this.active(s, turnId);
    this.mutable(s);
    requireThat(
      strings(productIds, 8) &&
        productIds.length > 0 &&
        productIds.every((pid) =>
          this.profile.catalog.products.some((p) => p.id === pid),
        ),
      "UNKNOWN_PRODUCT",
      "Save known products only.",
    );
    requireThat(
      typeof rationale === "string" &&
        rationale.length > 0 &&
        rationale.length <= 1000,
      "INVALID_RATIONALE",
      "Provide a bounded decision reason.",
    );
    requireThat(
      s.savedItems.length < 20,
      "SAVE_LIMIT",
      "At most 20 saved choices.",
    );
    s.savedItems.push({
      id: randomUUID(),
      productIds,
      rationale,
      selection: clone(s.selection),
      constraints: clone(s.constraints),
      savedAt: new Date().toISOString(),
    });
    s.stage = "saved_choice";
    this.invalidate(s);
    return this.commit(s);
  }
  restoreChoice(
    id: string,
    expected: number,
    turnId: string,
    savedId: unknown,
  ) {
    const s = this.get(id);
    this.revision(s, expected);
    this.active(s, turnId);
    const choice = s.savedItems.find((x) => x.id === savedId);
    requireThat(choice, "UNKNOWN_SAVED_CHOICE", "Saved choice not found.");
    return this.propose(id, {
      expectedRevision: expected,
      turnId,
      shortlist: choice.productIds,
      selection: null,
      stage: "shortlist",
    });
  }
  sweep() {
    for (const [id, r] of this.records)
      if (Date.parse(r.state.expiresAt) <= Date.now()) {
        this.records.delete(id);
        this.clearSessionData(id);
        this.events.emit(id, { type: "session.expired" });
      }
  }
}
