import type { CatalogProfile, ShoppingView } from "./contracts.ts";
import {
  randomUUID,
  randomBytes,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { EventEmitter } from "node:events";
import { inflateSync } from "node:zlib";
import { quoteOffer, eligibleOffers } from "./catalog.ts";
import { alongProfile } from "./along-catalog.ts";
import { checkoutCopy } from "./checkout-copy.ts";
import { classifyCheckoutReply } from "./checkout-intent.ts";
export { classifyCheckoutReply, isLiveDemoConfirmation } from "./checkout-intent.ts";
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
const intentText = (text: string) => text.toLowerCase().replace(/[.,!?“”"']/g, "").trim().replace(/\s+/g, " ");
const stopIntents = new Set(["stop", "cancel", "cancel purchase", "cancel this purchase", "cancel this simulated purchase", "do not buy", "dont buy", "decline"]);
export type LiveDemoCompletion = {
  epoch: number;
  expectedRevision: number;
  summaryId: string;
  summaryRevision: number;
  responseTurnId: string;
  delegationId: string;
  transcript: string;
  affirmationSummaryId?: string;
};
/** A server-owned interpretation of the observed shopper reply, never request JSON. */
export type InterpretedCheckoutApproval = {
  intent: "approve_order";
  transcript: string;
  summaryId: string;
  summaryRevision: number;
  requiresApprovalQuestion: boolean;
};
function validateInterpretedApproval(interpretation: InterpretedCheckoutApproval,
  transcript: unknown, summaryId: unknown, summaryRevision: unknown) {
  object(interpretation);
  keys(interpretation, ["intent", "transcript", "summaryId", "summaryRevision", "requiresApprovalQuestion"]);
  requireThat(interpretation.intent === "approve_order" &&
    typeof interpretation.requiresApprovalQuestion === "boolean" &&
    typeof transcript === "string" && transcript.trim().length > 0 && transcript.length <= 4000,
    "INVALID_APPROVAL", "A valid server interpretation of the shopper reply is required.");
  requireThat(interpretation.transcript === transcript,
    "UNTRUSTED_APPROVAL", "The interpretation must match the exact shopper reply.");
  requireThat(interpretation.summaryId === summaryId && interpretation.summaryRevision === summaryRevision,
    "STALE_SUMMARY", "The interpretation must refer to this order review.", 409);
}
const boundedDimensions = (width: number, height: number) => width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 16_777_216;
const crcTable = Array.from({ length: 256 }, (_, initial) => {
  let value = initial;
  for (let i = 0; i < 8; i++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : value >>> 1;
  return value >>> 0;
});
/** Structural validation only: image interpretation remains outside the trusted state layer. */
function validImage(bytes: Buffer, contentType: string): boolean {
  try {
    if (contentType === "image/png") {
      if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
      let offset = 8, chunks = 0, header = false, ended = false;
      const compressed: Buffer[] = [];
      while (offset + 12 <= bytes.length) {
        const size = bytes.readUInt32BE(offset), kind = bytes.toString("ascii", offset + 4, offset + 8);
        if (size > bytes.length - offset - 12 || ++chunks > 10000) return false;
        const data = bytes.subarray(offset + 8, offset + 8 + size);
        let crc = 0xffffffff;
        for (const byte of bytes.subarray(offset + 4, offset + 8 + size)) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
        if (((crc ^ 0xffffffff) >>> 0) !== bytes.readUInt32BE(offset + 8 + size)) return false;
        if (!header) {
          if (kind !== "IHDR" || size !== 13 || !boundedDimensions(data.readUInt32BE(0), data.readUInt32BE(4))) return false;
          const depths: Record<number, number[]> = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
          if (!depths[data[9]!] ?.includes(data[8]!) || data[10] !== 0 || data[11] !== 0 || ![0, 1].includes(data[12]!)) return false;
          header = true;
        } else if (kind === "IHDR") return false;
        if (kind === "IDAT") compressed.push(data);
        offset += size + 12;
        if (kind === "IEND") { ended = size === 0; break; }
      }
      if (!ended || offset !== bytes.length || !compressed.length) return false;
      return inflateSync(Buffer.concat(compressed), { maxOutputLength: 64 * 1024 * 1024 }).length > 0;
    }
    if (contentType === "image/jpeg") {
      if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) return false;
      let offset = 2, dimensions = false;
      while (offset + 4 <= bytes.length) {
        if (bytes[offset++] !== 255) return false;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (!marker || marker === 216 || marker === 217) return false;
        const size = bytes.readUInt16BE(offset);
        if (size < 2 || offset + size > bytes.length) return false;
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          if (size < 8 || !boundedDimensions(bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3))) return false;
          dimensions = true;
        }
        if (marker === 0xda) return dimensions && size >= 6 && offset + size < bytes.length - 2;
        offset += size;
      }
      return false;
    }
    if (contentType === "image/webp") {
      if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP" || bytes.readUInt32LE(4) !== bytes.length - 8) return false;
      let offset = 12, frame = false;
      while (offset + 8 <= bytes.length) {
        const kind = bytes.toString("ascii", offset, offset + 4), size = bytes.readUInt32LE(offset + 4);
        if (size > bytes.length - offset - 8) return false;
        const data = bytes.subarray(offset + 8, offset + 8 + size);
        if (kind === "VP8 ") {
          if (size < 10 || (data[0]! & 1) !== 0 || !data.subarray(3, 6).equals(Buffer.from([0x9d, 1, 0x2a])) || !boundedDimensions(data.readUInt16LE(6) & 0x3fff, data.readUInt16LE(8) & 0x3fff)) return false;
          frame = true;
        }
        if (kind === "VP8L") {
          if (size < 5 || data[0] !== 0x2f) return false;
          const bits = data.readUInt32LE(1);
          if ((bits >>> 29) !== 0 || !boundedDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)) return false;
          frame = true;
        }
        offset += 8 + size + (size % 2);
      }
      return frame && offset === bytes.length;
    }
    return false;
  } catch { return false; }
}
export class SessionStore {
  // Set only by the authenticated Live server, never by input or model tools.
  // Its no-payment checkout review survives conversation while strict spoken
  // approval keeps the existing turn/playback requirements.
  private liveDemoCheckoutSessions = new Set<string>();
  private playback = new Map<string, { epoch: number; turnId: string; playbackId: string; summaryId: string | null; summaryRevision: number | null; kind: "assistant" | "video"; videoId?: string }>();
  private attachments = new Map<
    string,
    { sessionId: string; epoch: number; contentType: string; bytes: Buffer }
  >();
  private processed = new Map<
    string,
    { fingerprint: string; result: unknown }
  >();
  private clearSessionData(id: string) {
    this.liveDemoCheckoutSessions.delete(id);
    this.playback.delete(id);
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
    profile: CatalogProfile = alongProfile,
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
      displayOrder: [],
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
  /** Authenticated Live sideband opt-in; it grants no real purchase authority. */
  enableLiveDemoCheckout(id: string) {
    this.record(id);
    this.liveDemoCheckoutSessions.add(id);
  }
  initializeReviewedPreferences(id: string, preferences: { key: string; value: string }[]) {
    const s = this.get(id);
    requireThat(s.revision === 0 && !s.history.length && !s.turn && !s.receipt && !s.preferences.length,
      "CONTEXT_ALREADY_INITIALIZED", "Reviewed context can only initialize an unused session.");
    const allowed: Record<string, string[]> = {
      color: ["black", "navy", "olive", "khaki", "slate"],
      shape: ["backpack", "tote", "sling", "duffel"],
    };
    requireThat(Array.isArray(preferences) && preferences.length <= 2 &&
      new Set(preferences.map((p) => p?.key)).size === preferences.length &&
      preferences.every((p) => p && Object.hasOwn(allowed, p.key) && allowed[p.key]?.includes(p.value)),
      "INVALID_CONTEXT", "Unsupported reviewed context.");
    if (!preferences.length) return s;
    s.preferences = preferences.map((p) => JSON.stringify([p.key, p.value]));
    return this.commit(s);
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
      { session: clone(s) },
    );
  }
  private invalidate(s: Session) {
    s.summary = null;
    s.lastOutcome = null;
    if (s.turn) s.turn.approvalWindow = null;
    this.playback.delete(s.id);
    if (s.mediaOwner === "assistant") s.mediaOwner = null;
  }
  beginTurn(id: string, expected: number, input?: InputEnvelope) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    const keepLiveReview =
      this.liveDemoCheckoutSessions.has(id) &&
      s.summary?.displayed &&
      s.summary.presentationMode === "voice" &&
      s.summary.quote.offer.classification === "proxy" &&
      (!input || input.modality === "voice");
    if (s.summary && !(s.summary.approvalNonce && s.summary.displayed) && !keepLiveReview)
      this.invalidate(s);
    if (input) {
      if (input.modality === "image" || input.modality === "link") this.invalidate(s);
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
    this.playback.delete(id);
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
    if (input && (input.modality === "text" || input.modality === "voice") && input.text && stopIntents.has(intentText(input.text))) {
      this.invalidate(s);
      s.turn.status = "cancelled";
      s.lastOutcome = "cancelled";
    }
    return this.commit(s);
  }
  cancel(id: string, turnId: string) {
    const s = this.get(id);
    this.active(s, turnId);
    this.mutable(s);
    s.turn!.status = "cancelled";
    this.invalidate(s);
    s.mediaOwner = null;
    s.lastOutcome = "cancelled";
    return this.commit(s);
  }
  /** A deliberate reference handoff is context, never approval or a mode change. */
  importReference(id: string, raw: { epoch: number; baseRevision: number; eventId: string; text: string }) {
    object(raw);
    keys(raw, ["epoch", "baseRevision", "eventId", "text"]);
    requireThat(typeof raw.text === "string" && raw.text.length > 0 && raw.text.length <= 2000,
      "INVALID_REFERENCE", "Use a bounded, labelled reference description.");
    return this.once(id, raw.epoch, raw.eventId, raw, () => {
      const s = this.get(id);
      this.revision(s, raw.baseRevision);
      this.mutable(s);
      this.invalidate(s);
      const turnId = randomUUID();
      this.record(id).usedTurnIds.add(turnId);
      s.turn = { id: turnId, startedAt: new Date().toISOString(), status: "active", approvalWindow: null };
      s.history.push({ turnId, eventId: raw.eventId, modality: "link", text: raw.text,
        productIds: [...s.displayOrder], createdAt: new Date().toISOString() });
      s.history = s.history.slice(-100);
      s.mediaOwner = null;
      if (["summary", "recovery", "opening"].includes(s.stage))
        s.stage = s.shortlist.length ? "shortlist" : "understanding";
      s.lastOutcome = "discovery_reference_imported";
      return this.commit(s);
    });
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
      displayOrder: [],
      selection: null,
      evidenceIds: [],
      turn: null,
      summary: null,
      receipt: null,
      lastOutcome: null,
    });
    return this.commit(s);
  }
  end(id: string, expected: number) {
    const s = this.get(id);
    this.revision(s, expected);
    this.records.delete(id);
    this.clearSessionData(id);
    this.events.emit(id, { type: "session.ended" });
    return { sessionId: id, ended: true };
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
    const ranks = value.cards.map((c) => c.rank).filter((rank) => rank !== null);
    requireThat(new Set(ranks).size === ranks.length, "INVALID_VIEW", "Recommendation ranks must be unique; focus does not change ranks.");
  }
  propose(id: string, raw: unknown): { session: Session; offers: ReturnType<typeof eligibleOffers> };
  propose(id: string, raw: unknown, options: { includeOffers: false }): { session: Session };
  propose(id: string, raw: unknown, options?: { includeOffers: false }) {
    object(raw);
    keys(raw, [
      "expectedRevision",
      "turnId",
      "needs",
      "constraints",
      "preferences",
      "excludedProductIds",
      "shortlist",
      "displayOrder",
      "selection",
      "evidenceIds",
      "destination",
      "view",
      "stage",
      "comparisonIds",
      "priority",
    ]);
    // Validate on an isolated draft; rejected proposals must never alter live state.
    const s = clone(this.get(id));
    this.revision(s, raw.expectedRevision);
    this.active(s, raw.turnId);
    this.mutable(s);
    for (const key of [
      "needs",
      "preferences",
      "excludedProductIds",
      "shortlist",
      "displayOrder",
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
          ...(s.constraints.bagMaxDimensionsCm || incoming.bagMaxDimensionsCm ? {
            bagMaxDimensionsCm: {
              ...s.constraints.bagMaxDimensionsCm,
              ...incoming.bagMaxDimensionsCm,
            },
          } : {}),
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
      "displayOrder",
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
    if (p.shortlist && !p.displayOrder) s.displayOrder = [...p.shortlist];
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
          (p.shortlist.length === visibleIds.length && p.shortlist.every((pid) => visibleIds.includes(pid))),
        "VIEW_ORDER_CONFLICT",
        "Visible product cards must match the accepted shortlist.",
      );
      if (!p.shortlist && !s.shortlist.length) s.shortlist = visibleIds;
      requireThat(s.shortlist.length === visibleIds.length && s.shortlist.every((pid) => visibleIds.includes(pid)), "VIEW_ORDER_CONFLICT", "Focus and presentation cannot replace the accepted shortlist.");
      if (!p.displayOrder && !s.displayOrder.length) s.displayOrder = [...visibleIds];
    }
    requireThat(
      s.displayOrder.length === s.shortlist.length && s.displayOrder.every((pid) => s.shortlist.includes(pid)),
      "INVALID_DISPLAY_ORDER",
      "Display order must contain each shortlisted product exactly once.",
    );
    if (s.view?.cards.length)
      s.view.cards.sort((a, b) => s.displayOrder.indexOf(a.productId) - s.displayOrder.indexOf(b.productId));
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
    // Internal state adapters already quote the products they need. Keep the
    // public response unchanged, but avoid expanding every offer when unused.
    // All proposal and selected-offer checks above still run before commit.
    if (options?.includeOffers === false) return { session: accepted };
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
    const conditions = q.offer.conditions.map(checkoutCopy).filter(Boolean);
    const uncertainties = q.offer.uncertainties.map(checkoutCopy).filter(Boolean);
    const variant = /^[A-Z]+-\d+-DEMO$/i.test(q.product.variant) ? "" : `, variant ${checkoutCopy(q.product.variant)}`;
    const spokenText = `Here’s your order. ${q.quantity} of ${checkoutCopy(q.product.name)}${variant}, sold by ${checkoutCopy(q.offer.sellerName)}. Items ${money(q.subtotal, q.currency)}, shipping ${money(q.shipping!, q.currency)}, other fees ${money(q.otherFees!, q.currency)}${q.tax !== undefined ? `, tax ${money(q.tax!, q.currency)}` : ""}, required setup ${money(q.setupCost!, q.currency)}; total ${money(q.total!, q.currency)}. Destination: ${checkoutCopy(q.destination)}. Delivery: ${checkoutCopy(q.offer.deliveryConditions)} Setup: ${checkoutCopy(q.offer.setupConditions ?? "No additional setup cost.")} Returns: ${checkoutCopy(q.offer.returnConditions)} Conditions: ${conditions.length ? conditions.join(" ") : "No additional conditions listed."} Material uncertainties: ${uncertainties.length ? uncertainties.join("; ") : "none recorded"}. Would you like me to place this order? You can also change it or cancel.`;
    this.invalidate(s);
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
      playbackId: null,
      approvalNonce: null,
    };
    return this.commit(s);
  }
  presentation(id: string, raw: unknown) {
    object(raw);
    keys(raw, ["summaryId", "turnId", "textHash", "event", "epoch", "eventId", "expectedRevision", "summaryRevision", "playbackId"]);
    const envelope = raw;
    const guarded = ["epoch", "eventId", "expectedRevision", "summaryRevision"].some((key) => envelope[key] !== undefined);
    const apply = () => {
    const s = this.get(id);
    if (guarded) {
      this.revision(s, envelope.expectedRevision);
      requireThat(s.summary?.revision === envelope.summaryRevision, "STALE_SUMMARY", "Summary revision changed.", 409);
    }
    return this.present(s, envelope);
    };
    return guarded ? this.once(id, envelope.epoch as number, envelope.eventId as string, envelope, apply) : apply();
  }
  private present(s: Session, raw: Record<string, unknown>) {
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
      requireThat(raw.playbackId === undefined || (typeof raw.playbackId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(raw.playbackId)), "INVALID_PLAYBACK", "Use a bounded playback ID.");
      m.playbackId = raw.playbackId as string ?? randomUUID();
      m.playback = "playing";
      s.mediaOwner = "assistant";
    }
    if (raw.event === "playback_completed") {
      requireThat(
        m.playback === "playing",
        "INVALID_PLAYBACK",
        "Playback must be started and uninterrupted.",
        409,
      );
      requireThat(raw.playbackId === undefined || raw.playbackId === m.playbackId, "STALE_PLAYBACK", "Playback identity changed.", 409);
      m.playback = "complete";
      s.mediaOwner = null;
    }
    if (raw.event === "playback_interrupted") {
      requireThat(raw.playbackId === undefined || raw.playbackId === m.playbackId, "STALE_PLAYBACK", "Playback identity changed.", 409);
      m.playback = "interrupted";
      m.approvalNonce = null;
      if (s.turn) s.turn.approvalWindow = null;
      s.mediaOwner = null;
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
  /** Trusted bridge lifecycle events. Every accepted callback is bound to the current epoch, turn and revision. */
  lifecycle(id: string, raw: unknown) {
    object(raw);
    keys(raw, ["sessionId", "epoch", "eventId", "turnId", "revision", "type", "playbackId", "summaryId", "summaryRevision", "videoId"]);
    requireThat(raw.sessionId === id, "WRONG_SESSION", "Lifecycle session mismatch.", 409);
    const event = raw;
    return this.once(id, event.epoch as number, event.eventId as string, event, () => {
      const s = this.get(id);
      this.revision(s, event.revision);
      this.mutable(s);
      requireThat(["audio.started", "audio.completed", "audio.interrupted", "turn.cancelled", "video.started", "video.stopped"].includes(event.type as string), "INVALID_EVENT", "Unknown lifecycle event.");
      if (event.type === "turn.cancelled") {
        this.active(s, event.turnId);
        return this.cancel(id, event.turnId as string);
      }
      requireThat(typeof event.playbackId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(event.playbackId), "INVALID_PLAYBACK", "Use a bounded playback ID.");
      if (event.type === "video.started") {
        this.active(s, event.turnId);
        const accepted = this.media(id, s.revision, event.type, event.videoId);
        this.playback.set(id, { epoch: s.epoch, turnId: event.turnId as string, playbackId: event.playbackId, summaryId: null, summaryRevision: null, kind: "video", videoId: event.videoId as string });
        return accepted;
      }
      if (event.type === "video.stopped") {
        const running = this.playback.get(id);
        requireThat(running?.kind === "video" && running.epoch === s.epoch && running.turnId === event.turnId && running.playbackId === event.playbackId && running.videoId === event.videoId, "STALE_PLAYBACK", "Video playback identity changed.", 409);
        const accepted = this.media(id, s.revision, event.type, event.videoId);
        this.playback.delete(id);
        return accepted;
      }
      this.active(s, event.turnId);
      if (event.type === "audio.started") {
        requireThat(s.mediaOwner === null && !this.playback.has(id), "MEDIA_BUSY", "Another media stream owns playback.", 409);
        if (s.summary) {
          requireThat(s.summary.id === event.summaryId && s.summary.revision === event.summaryRevision, "STALE_SUMMARY", "Audio must identify the exact current summary.", 409);
          const accepted = this.present(s, { summaryId: event.summaryId, turnId: event.turnId, textHash: s.summary.textHash, event: "playback_started", playbackId: event.playbackId });
          this.playback.set(id, { epoch: s.epoch, turnId: event.turnId as string, playbackId: event.playbackId, summaryId: event.summaryId as string, summaryRevision: event.summaryRevision as number, kind: "assistant" });
          return accepted;
        }
        requireThat(event.summaryId === undefined && event.summaryRevision === undefined, "STALE_SUMMARY", "Summary no longer exists.", 409);
        this.playback.set(id, { epoch: s.epoch, turnId: event.turnId as string, playbackId: event.playbackId, summaryId: null, summaryRevision: null, kind: "assistant" });
        s.mediaOwner = "assistant";
        return this.commit(s);
      }
      const running = this.playback.get(id);
      requireThat(running?.kind === "assistant" && running.epoch === s.epoch && running.turnId === event.turnId && running.playbackId === event.playbackId, "STALE_PLAYBACK", "Audio playback identity changed.", 409);
      let accepted: Session;
      if (running.summaryId) {
        requireThat(running.summaryId === event.summaryId && running.summaryRevision === event.summaryRevision && s.summary?.revision === event.summaryRevision, "STALE_SUMMARY", "Audio summary revision changed.", 409);
        accepted = this.present(s, { summaryId: event.summaryId, turnId: event.turnId, textHash: s.summary!.textHash, event: event.type === "audio.completed" ? "playback_completed" : "playback_interrupted", playbackId: event.playbackId });
      } else {
        requireThat(!s.summary && event.summaryId === undefined && event.summaryRevision === undefined, "STALE_SUMMARY", "Non-summary audio cannot complete a purchase summary.", 409);
        s.mediaOwner = null;
        accepted = this.commit(s);
      }
      this.playback.delete(id);
      return accepted;
    });
  }
  /** Server-only no-payment rehearsal. Intentionally separate from approve():
   * Live delegation text has no finality/confidence or exact playback evidence.
   * This method can only issue the existing synthetic receipt for a proxy offer;
   * it never mints an approval nonce or calls a payment/order integration. */
  completeLiveDemo(id: string, raw: LiveDemoCompletion, interpretedApproval?: InterpretedCheckoutApproval) {
    object(raw);
    keys(raw, ["epoch", "expectedRevision", "summaryId", "summaryRevision", "responseTurnId", "delegationId", "transcript", "affirmationSummaryId"]);
    requireThat(typeof raw.delegationId === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(raw.delegationId), "INVALID_DELEGATION", "A server-observed delegation is required.");
    // Only the server can supply this separate argument. Public request keys
    // above intentionally cannot carry an interpretation or bypass the legacy
    // text check. Bind interpretation to the original reply and reviewed order.
    if (interpretedApproval !== undefined) {
      validateInterpretedApproval(interpretedApproval, raw.transcript, raw.summaryId, raw.summaryRevision);
    }
    const reply = interpretedApproval
      ? interpretedApproval.requiresApprovalQuestion ? "assent" : "approve"
      : classifyCheckoutReply(raw.transcript);
    requireThat(reply !== "other", "AMBIGUOUS_APPROVAL", "Would you like to place this order, or change the details?");
    requireThat(raw.affirmationSummaryId === undefined || (typeof raw.affirmationSummaryId === "string" && raw.affirmationSummaryId.length <= 128), "INVALID_SUMMARY", "A confirmation prompt must refer to an order summary.");
    // A retry may observe the revision advanced by its own successful receipt.
    // Stable identity/payload still prevents replaying a delegation for another order.
    const { expectedRevision, ...identity } = raw;
    const eventId = `live-demo-${hash(raw.delegationId).slice(0, 40)}`;
    const payload = interpretedApproval ? { ...identity, interpretedApproval: {
      intent: interpretedApproval.intent, transcript: interpretedApproval.transcript,
      summaryId: interpretedApproval.summaryId, summaryRevision: interpretedApproval.summaryRevision,
      requiresApprovalQuestion: interpretedApproval.requiresApprovalQuestion,
    } } : identity;
    return this.once(id, raw.epoch, eventId, payload, () => {
      const s = this.get(id);
      this.revision(s, expectedRevision);
      this.mutable(s);
      // Live's displayed order belongs to its immutable review identity, not
      // the narration/research turn that happened to prepare it. A later
      // question or interrupted readback cannot revoke that unchanged review.
      if (!this.liveDemoCheckoutSessions.has(id)) this.active(s, raw.responseTurnId);
      const m = s.summary;
      requireThat(
        m && m.id === raw.summaryId && m.revision === raw.summaryRevision &&
          m.responseTurnId === raw.responseTurnId && m.displayed,
        "STALE_SUMMARY", "Review the current order details before confirming.", 409,
      );
      if (reply === "assent") {
        requireThat(raw.affirmationSummaryId !== undefined, "AMBIGUOUS_APPROVAL", "That reply needs a current order approval question.");
        requireThat(raw.affirmationSummaryId === m.id, "STALE_SUMMARY", "The approval question referred to a different order. Review this order first.", 409);
      }
      const q = quoteOffer(m.quote.offer.id, m.quote.quantity, s.constraints,
        s.excludedProductIds, this.profile.catalog, s.destination);
      requireThat(q.eligible && JSON.stringify(q) === JSON.stringify(m.quote),
        "STALE_QUOTE", "The offer changed. Review the updated order details first.", 409);
      requireThat(q.offer.classification === "proxy", "LIVE_DEMO_ONLY",
        "Live rehearsal completion is limited to synthetic offers.", 409);
      s.history.push({ turnId: raw.responseTurnId, eventId, modality: "live_demo",
        text: raw.transcript, productIds: [...s.displayOrder], createdAt: new Date().toISOString() });
      s.history = s.history.slice(-100);
      s.receipt = {
        id: `SIM-${randomUUID()}`, simulated: true,
        label: "SIMULATED — no payment or real order", completionSource: "live_demo",
        summaryId: m.id, summaryRevision: m.revision,
        createdAt: new Date().toISOString(), quote: clone(q),
      };
      s.stage = "receipt";
      s.lastOutcome = "simulated_purchase_complete";
      const result = this.commit(s);
      return { session: result, receipt: result.receipt! };
    });
  }

  approve(id: string, raw: unknown, typed = false, interpretedApproval?: InterpretedCheckoutApproval) {
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
    if (interpretedApproval !== undefined) {
      validateInterpretedApproval(interpretedApproval, raw.transcript, raw.summaryId, s.summary?.revision);
      requireThat(s.turn?.input?.modality === (typed ? "text" : "voice") &&
        s.turn.input.text === raw.transcript,
        "UNTRUSTED_APPROVAL", "The interpretation must match the current shopper input.");
    }
    // Retries of the same already accepted approval produce the same receipt even after revision advanced.
    if (s.receipt) {
      requireThat(
        s.receipt.completionSource !== "live_demo" &&
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
    if (!typed && (this.profile.catalog.canonical || s.turn?.input))
      requireThat(s.turn?.input?.modality === "voice" && s.turn.input.text === o.transcript, "UNTRUSTED_APPROVAL", "Voice approval must match the current trusted shopper voice turn.");
    requireThat(
      typed ||
        (o.final === true &&
          typeof o.confidence === "number" && Number.isFinite(o.confidence) &&
          o.confidence >= 0.9 &&
          o.confidence <= 1 &&
          o.source === "shopper" &&
          o.echoDetected === false),
      "UNTRUSTED_APPROVAL",
      "Approval must be final, confident shopper speech without echo.",
    );
    requireThat(
      typeof o.transcript === "string" && o.transcript.length <= (interpretedApproval ? 4000 : 200),
      "INVALID_APPROVAL",
      "Invalid approval transcript.",
    );
    if (!interpretedApproval) {
      requireThat(!/[“”"‘’']/.test(o.transcript), "AMBIGUOUS_APPROVAL", "Quoted content is not a deliberate purchase instruction.");
      const normalized = intentText(o.transcript);
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
    }
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
      { session: clone(s) },
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
          JSON.stringify(x.visibleProductIds) === JSON.stringify(s.displayOrder),
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
          typeof x.url === "string" && !!this.profile.knownLinks && Object.hasOwn(this.profile.knownLinks, x.url) && this.profile.catalog.products.some((product) => product.id === this.profile.knownLinks![x.url!]),
          "UNSUPPORTED_LINK",
          "Only curated product links are supported. No URL was fetched.",
        );
      return this.beginTurn(id, x.baseRevision, x);
    });
  }
  usePreparedImage(id: string, expected: number, imageId: string) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    requireThat(
      this.profile.preparedImages.some((p) => p.id === imageId),
      "UNKNOWN_ATTACHMENT",
      "Unknown prepared image.",
    );
    if (!s.attachmentIds.includes(imageId)) s.attachmentIds.push(imageId);
    return this.commit(s);
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
    requireThat(
      validImage(bytes, contentType),
      "INVALID_IMAGE_TYPE",
      "Only structurally valid PNG/JPEG/WebP images up to 8192 pixels per side and 16 megapixels. SVG, malformed images and arbitrary documents are rejected.",
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
      bytes: Buffer.from(bytes),
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
    return { ...a, bytes: Buffer.from(a.bytes) };
  }
  /** Drop a session reference; idempotent if it was never attached or already gone. */
  removeAttachment(id: string, expected: number, attachmentId: string) {
    const s = this.get(id);
    this.revision(s, expected);
    this.mutable(s);
    s.attachmentIds = s.attachmentIds.filter((x) => x !== attachmentId);
    this.attachments.delete(attachmentId);
    return this.commit(s);
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
    } else {
      requireThat(s.mediaOwner === "video", "STALE_PLAYBACK", "No current video owns playback.", 409);
      s.mediaOwner = null;
    }
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
