// Deterministic, in-memory server fixture. Replace this boundary with #7/#10;
// client code must never manufacture accepted snapshots or purchase receipts.
import { randomUUID } from "node:crypto";
import type {
  Accepted,
  Attachment,
  Identity,
  Input,
  Lifecycle,
  Session,
} from "./contract";
import { summaryText } from "./contract";
import { initialSession, offers, products, solutions } from "./fixtures";
class Conflict extends Error {
  constructor(
    public snapshot: Session,
    message = "Session changed. Please review the current state and try again.",
  ) {
    super(message);
  }
}
export { Conflict };
type RecordState = {
  snapshot: Session;
  cancelled: Set<string>;
  events: Map<string, Accepted>;
  playback: Lifecycle | null;
  activeTurn: string | null;
  mode: "text" | "voice";
  assets: Map<string, Attachment>;
  touched: number;
};
const globalStore = globalThis as unknown as {
  concierge?: Map<string, RecordState>;
};
const sessions: Map<string, RecordState> = (globalStore.concierge ??= new Map<
  string,
  RecordState
>());
export function connect(id?: string): Session {
  if (id) {
    const r = record(id);
    r.touched = Date.now();
    return structuredClone(r.snapshot);
  }
  for (const [key, r] of sessions)
    if (Date.now() - r.touched > 3_600_000) sessions.delete(key);
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
  const sessionId = randomUUID();
  const snapshot = initialSession(sessionId);
  sessions.set(sessionId, {
    snapshot,
    cancelled: new Set(),
    events: new Map(),
    playback: null,
    activeTurn: null,
    mode: "text",
    assets: new Map(),
    touched: Date.now(),
  });
  return structuredClone(snapshot);
}
function record(id: string) {
  const r = sessions.get(id);
  if (!r) throw new Error("Session expired. Start a new session.");
  return r;
}
function check(i: Identity) {
  const r = record(i.sessionId);
  if (r.snapshot.epoch !== i.epoch) throw new Conflict(r.snapshot);
  r.touched = Date.now();
  return r;
}
function invalidate(r: RecordState) {
  r.playback = null;
  if (r.snapshot.summary && r.snapshot.approvalStatus !== "approved") {
    r.snapshot.summary.status = "invalidated";
    r.snapshot.approvalStatus = "not_prepared";
  }
}
export function cancel(i: Identity) {
  const r = check(i);
  r.cancelled.add(i.turnId);
  if (r.activeTurn === i.turnId) {
    if (r.snapshot.approvalStatus === "presenting") invalidate(r);
    else r.playback = null;
    r.activeTurn = null;
  }
  return structuredClone(r.snapshot);
}
export function setMode(i: Identity, mode: "text" | "voice") {
  const r = check(i);
  r.cancelled.add(i.turnId);
  invalidate(r);
  r.activeTurn = null;
  r.mode = mode;
  if (
    r.snapshot.summary &&
    r.snapshot.view === "summary" &&
    !r.snapshot.receipt
  ) {
    r.snapshot.revision++;
    r.snapshot.summary = {
      ...r.snapshot.summary,
      revision: r.snapshot.revision,
      presentationMode: mode,
      status: mode === "text" ? "eligible" : "presenting",
    };
    r.snapshot.approvalStatus = mode === "text" ? "eligible" : "presenting";
    r.snapshot.message = summaryText(r.snapshot.summary);
  }
  return structuredClone(r.snapshot);
}
export function lifecycle(e: Lifecycle) {
  const r = check(e),
    s = r.snapshot;
  if (
    r.cancelled.has(e.turnId) ||
    r.activeTurn !== e.turnId ||
    e.revision !== s.revision
  )
    return structuredClone(s);
  if (e.type === "audio.started") r.playback = e;
  if (e.type === "audio.interrupted" || e.type === "turn.cancelled")
    invalidate(r);
  if (
    e.type === "audio.completed" &&
    r.playback?.playbackId === e.playbackId &&
    e.summaryId === s.summaryId &&
    s.summary?.presentationMode === "voice"
  ) {
    s.summary.status = "eligible";
    s.approvalStatus = "eligible";
    r.playback = null;
  }
  return structuredClone(s);
}
export function addAsset(id: string, asset: Omit<Attachment, "id">) {
  const r = record(id);
  if (r.assets.size >= 12)
    throw new Error(
      "Remove or reuse a reference; this rehearsal allows 12 uploads per session.",
    );
  const a = { ...asset, id: randomUUID() };
  r.assets.set(a.id, a);
  return a;
}
export function accept(input: Input): Accepted {
  const r = check({ ...input, revision: input.baseRevision }),
    s = r.snapshot;
  if (r.cancelled.has(input.turnId))
    throw new Conflict(s, "That turn was interrupted.");
  const prior = r.events.get(input.eventId);
  if (prior) return structuredClone(prior);
  if (
    (input.modality === "voice" || input.modality === "text") &&
    input.modality !== r.mode
  )
    throw new Conflict(
      s,
      "Choose your input mode explicitly before continuing.",
    );
  if (input.baseRevision !== s.revision || input.visibleRevision !== s.revision)
    throw new Conflict(s);
  if (input.attachmentId && !r.assets.has(input.attachmentId))
    throw new Error("Unknown attachment. Upload the reference again.");
  const text = (input.text ?? "").trim(),
    t = text.toLowerCase();
  // Approval is deliberately narrow and cannot originate in image/link content.
  if (
    t === "confirm simulated purchase" &&
    (input.modality === "voice" || input.modality === "text")
  ) {
    if (s.receipt) return event(input, r);
    if (
      !s.summary ||
      s.approvalStatus !== "eligible" ||
      s.summary.status !== "eligible" ||
      s.summary.presentationMode !== input.modality ||
      r.mode !== input.modality
    )
      throw new Conflict(
        s,
        "Review the complete current summary before confirming.",
      );
    s.receipt = {
      id: randomUUID(),
      simulated: true,
      acceptedOrder: structuredClone(s.summary),
    };
    s.view = "receipt";
    s.approvalStatus = "approved";
    s.heading = "A considered choice.";
    s.message =
      "Your simulated order is confirmed. No purchase was made and no payment was taken.";
    s.cards = [];
  } else {
    invalidate(r);
    if (t.startsWith("remove reference ")) {
      const id = text.slice("remove reference ".length);
      s.attachmentIds = s.attachmentIds.filter((a) => a !== id);
      s.message =
        "Reference removed from this session. Tell me what you would like to keep or change.";
    } else if (input.attachmentId) {
      s.attachmentIds = [...new Set([...s.attachmentIds, input.attachmentId])];
      s.category = "bags";
      s.view = "understanding";
      s.heading = "What caught your eye?";
      s.message =
        "This is a prepared reference, not a verified product. Is it the shape, colour, or how much it carries? Tell me what I should keep, and your budget.";
      s.cards = [];
    } else if (/save|defer|later/.test(t)) {
      s.savedItems = s.focusedProductId
        ? [{ id: s.focusedProductId, rationale: text }]
        : s.savedItems;
      s.view = "saved_choice";
      s.heading = "Room to think.";
      s.message =
        "Saved in this session only. Say “show options” to return whenever you’re ready.";
      s.cards = [];
    } else if (/summary|order|buy|choose.*offer/.test(t) && s.category) {
      if (!s.focusedProductId) s.focusedProductId = products(s.category)[0].id;
      s.selectedOfferId = /fast|tomorrow/.test(t)
        ? "fast"
        : (s.selectedOfferId ?? "cheap");
      s.view = "summary";
      s.heading = "Let’s check every detail.";
      s.cards = [];
      const fast = s.selectedOfferId === "fast";
      const rev = s.revision + 1;
      s.summary = {
        id: randomUUID(),
        revision: rev,
        productId: s.focusedProductId,
        variantId:
          s.category === "bags"
            ? "navy"
            : s.category === "bedsheets"
              ? "queen-demo"
              : "usb-demo",
        offerId: s.selectedOfferId,
        sellerId: fast ? "Synthetic seller B" : "Synthetic seller A",
        quantity: 1,
        currency: "USD",
        lineItemsMinor: {
          items: fast ? 8900 : 7900,
          shipping: fast ? 1000 : 500,
          otherFees: 0,
        },
        totalMinor: fast ? 9900 : 8400,
        destination: "DEMO-DESTINATION, Singapore",
        deliveryWindow: fast
          ? "25 October 2026 (demo estimate, Asia/Singapore)"
          : "27 October 2026 (demo estimate, Asia/Singapore)",
        conditions: [
          "14-day demo returns",
          "Synthetic fulfillment fixture",
          "Required setup hardware included in this synthetic kit",
        ],
        uncertainties: [
          "No live seller, compatibility, stock or delivery verification",
        ],
        presentationMode: r.mode,
        status: r.mode === "text" ? "eligible" : "presenting",
      };
      s.summaryId = s.summary.id;
      s.approvalStatus = r.mode === "text" ? "eligible" : "presenting";
      s.message = summaryText(s.summary);
    } else if (/offer|seller|price|tomorrow/.test(t) && s.category) {
      s.view = "offers";
      s.heading = "The same choice. Two ways to get it.";
      s.message =
        "These are synthetic offers for the same demo variant. The lower price arrives later. Say “choose cheaper offer” or “choose faster offer”.";
      s.cards = offers;
    } else if (/review|evidence|video/.test(t) && s.category) {
      s.view = "evidence";
      s.heading = "Look a little closer.";
      s.message =
        "No verified buyer reviews or videos are connected to these shell fixtures. Ratings, review counts, and café performance evidence are not available. Say “show offers”, “show options”, or “save for later”.";
      s.cards = [];
    } else if (/compare/.test(t) && s.category) {
      s.view = "comparison";
      s.heading = "A closer comparison.";
      s.cards = products(s.category).slice(0, 2);
      s.comparisonIds = s.cards.map((c) => c.id);
      s.message =
        "Stable positions: option 1 and option 2. These synthetic products demonstrate the session shell; verified specifications and product evidence arrive through the catalog integration. Say “show option 1” or “show evidence”.";
    } else if (/option\s*[123]|first|second|third/.test(t) && s.category) {
      const index = /2|second/.test(t) ? 1 : /3|third/.test(t) ? 2 : 0;
      s.cards = [products(s.category)[index]];
      s.focusedProductId = s.cards[0].id;
      s.view = "shortlist";
      s.heading = "A little more about this one.";
      s.message =
        "Say “compare”, “show evidence”, “show offers”, or “save for later”.";
    } else if (
      /value|quality|cost|cheapest|options|shape|colou?r|capacity|budget/.test(
        t,
      ) &&
      s.category
    ) {
      s.preferences = [...new Set([...s.preferences, text])];
      s.cards = products(s.category);
      s.view = "shortlist";
      s.shortlistIds = s.cards.map((c) => c.id);
      s.heading = "A few thoughtful possibilities.";
      s.message =
        "Three synthetic shell fixtures, in stable numbered positions. Rankings illustrate fit within this demo only. Say “compare”, “show option 1”, or “show evidence”.";
    } else if (
      /choose|headset|clip|desktop/.test(t) &&
      s.category === "audio"
    ) {
      s.view = "buying_priorities";
      s.heading = "What matters most to you?";
      s.message =
        "Would you like best value, best supported quality, or the lowest-cost suitable option? Your existing constraints still apply.";
      s.cards = [];
    } else if (/bag|work|gym/.test(t)) {
      s.category = "bags";
      s.needs = [text];
      s.view = "understanding";
      s.heading = "For everything your day holds.";
      s.message =
        "What should it carry? Tell me your preferred shape, colour, capacity and budget. You can add a photo or the prepared reference.";
      s.cards = [];
    } else if (/sheet|bed|warm/.test(t)) {
      s.category = "bedsheets";
      s.needs = [text];
      s.view = "understanding";
      s.heading = "Find your comfortable fit.";
      s.message =
        "What are your bed dimensions, mattress depth, preferred material, included pieces and budget? No cooling or health guarantees are implied.";
      s.cards = [];
    } else if (/audio|dictat|café|cafe|microphone/.test(t)) {
      s.category = "audio";
      s.needs = [text];
      s.view = "solution_types";
      s.heading = "Make yourself heard.";
      s.message =
        "Which computer and connection do you use? Do you prefer a headset, a clip-on, or a directional desktop microphone? Say “choose headset”, for example.";
      s.cards = solutions;
    } else {
      s.view = s.category ? s.view : "understanding";
      s.heading = s.category ? s.heading : "Let’s find your starting point.";
      s.message = s.summary
        ? "That is not explicit approval. Say “review summary” to present the complete summary again, or describe a change."
        : "Tell me about café dictation, a work and gym bag, or bedsheets for a warm room. You can revisit any step by speaking or typing.";
    }
    if (s.summary && s.view !== "summary") {
      s.summary = null;
      s.summaryId = null;
      s.approvalStatus = "not_prepared";
    }
  }
  s.displayOrder = s.cards.map((c) => c.id);
  s.revision++;
  s.history = [
    ...s.history,
    {
      role: "user" as const,
      text: input.attachmentId ? "Added a reference" : text,
    },
    { role: "assistant" as const, text: s.message },
  ].slice(-40);
  r.activeTurn = input.turnId;
  return event(input, r);
}
function event(input: Input, r: RecordState): Accepted {
  const e: Accepted = {
    sessionId: input.sessionId,
    epoch: input.epoch,
    turnId: input.turnId,
    revision: r.snapshot.revision,
    eventId: input.eventId,
    type: "session.updated",
    snapshot: structuredClone(r.snapshot),
  };
  r.events.set(input.eventId, e);
  return e;
}
