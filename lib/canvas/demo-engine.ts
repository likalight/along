/** Server-only deterministic rehearsal adapter. Replace with #6/#7 acceptance, not an agent in the browser. */
import { randomUUID } from "node:crypto";
import { fixtureData } from "./fixtures";
import type {
  AcceptedEvent,
  Annotation,
  Category,
  Product,
  Snapshot,
} from "./contracts";
export type DemoInput = {
  sessionId: string;
  epoch: number;
  eventId: string;
  turnId: string;
  baseRevision: number;
  visibleRevision: number;
  visibleProductIds: string[];
  modality: "voice" | "text";
  text: string;
};
type RecordState = {
  snapshot: Snapshot;
  events: Map<string, { input: string; event: AcceptedEvent }>;
  touched: number;
};
const globalStore = globalThis as unknown as {
  canvasRehearsal?: Map<string, RecordState>;
};
const sessions = (globalStore.canvasRehearsal ??= new Map());
export function createDemo(category: Category = "audio"): Snapshot {
  for (const [key, record] of sessions)
    if (Date.now() - record.touched > 3600000) sessions.delete(key);
  if (sessions.size >= 100) sessions.delete(sessions.keys().next().value!);
  const snapshot: Snapshot = {
    sessionId: randomUUID(),
    epoch: 1,
    revision: 0,
    category,
    needs:
      category === "audio"
        ? ["Clearer laptop dictation in noisy cafés"]
        : category === "bags"
          ? ["A rounded work + gym bag"]
          : ["Sheets for a warm room"],
    hardConstraints: {
      budgetMinor: category === "audio" ? "30000" : "15000",
      currency: "USD",
      ...(category === "audio"
        ? { connection: "USB-C" }
        : category === "bedsheets"
          ? { dimensions: "152 × 203 cm", depth: "30 cm" }
          : {}),
    },
    preferences:
      category === "audio"
        ? ["Portable", "Discreet"]
        : category === "bags"
          ? ["Rounded shape", "Colour flexible"]
          : ["Easy care"],
    exclusions: [],
    shortlistIds: [],
    displayOrder: [],
    focusedProductId: null,
    comparisonIds: [],
    savedItems: [],
    selectedOfferId: null,
    view: "understanding",
    evidenceIds: [],
    attachmentIds: category === "bags" ? ["demo-reference-bag"] : [],
    canvas: {
      heading: "Let’s get the essentials right.",
      message:
        "Here’s what I’ve understood. Correct anything, then we’ll explore the possibilities.",
      annotations: {},
      ...(category === "bags"
        ? {
            reference: {
              url: "/canvas/bag.svg",
              alt: "Prepared navy rounded bag reference · schematic",
              classification: "proxy" as const,
            },
          }
        : {}),
    },
  };
  sessions.set(snapshot.sessionId, {
    snapshot,
    events: new Map(),
    touched: Date.now(),
  });
  return snapshot;
}
export const readDemo = (id: string) => sessions.get(id)?.snapshot;
const priorities = {
  value: "Best value",
  quality: "Best supported quality",
  cost: "Lowest-cost suitable",
};
function eligible(s: Snapshot): Product[] {
  return fixtureData.products.filter(
    (p) =>
      p.category === s.category &&
      p.availability !== "unavailable" &&
      !s.exclusions.includes(p.id) &&
      p.referencePriceMinor !== null &&
      p.referencePriceMinor <= Number(s.hardConstraints.budgetMinor) &&
      (s.category !== "audio" ||
        !s.canvas.solution ||
        p.solution === s.canvas.solution) &&
      (s.category !== "bags" ||
        !s.preferences.includes("Softer shape") ||
        p.specs.Shape === "Soft rounded silhouette") &&
      (s.category !== "bags" ||
        !s.preferences.includes("Navy colour") ||
        p.variantId.startsWith("Navy")) &&
      (s.category !== "bedsheets" ||
        (p.specs.Dimensions === s.hardConstraints.dimensions &&
          Number.parseInt(p.specs["Mattress depth"]) >=
            Number.parseInt(s.hardConstraints.depth))),
  );
}
function shortlist(s: Snapshot, closer = false) {
  const candidates = eligible(s);
  if (s.canvas.priority === "cost")
    candidates.sort((a, b) => a.referencePriceMinor! - b.referencePriceMinor!);
  if (s.category === "audio" && s.canvas.priority !== "cost") {
    const order =
      s.canvas.priority === "quality"
        ? [
            "MIC-009",
            "MIC-015",
            "MIC-040",
            "MIC-003",
            "MIC-044",
            "MIC-037",
            "MIC-020",
            "MIC-047",
            "MIC-022",
            "MIC-001",
          ]
        : [
            "MIC-003",
            "MIC-020",
            "MIC-040",
            "MIC-015",
            "MIC-047",
            "MIC-037",
            "MIC-044",
            "MIC-022",
            "MIC-001",
            "MIC-009",
          ];
    candidates.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); // Authored relevance hypothesis, independent of customer stars or price.
  }
  const ids = candidates
    .slice(0, s.category === "bags" && !closer ? 5 : 3)
    .map((p) => p.id);
  s.view = "shortlist";
  s.shortlistIds = ids;
  s.displayOrder = ids;
  s.focusedProductId = null;
  s.comparisonIds = [];
  s.canvas.heading =
    s.category === "bags" && !closer
      ? "A little closer. A little unexpected."
      : "A shortlist shaped around you.";
  s.canvas.message =
    s.category === "bags" && !closer
      ? "Two close matches, then three related discoveries. Tell me what speaks to you."
      : `${ids.length} option${ids.length === 1 ? "" : "s"} within your current constraints. ${ids.length < 3 ? "Fewer than three are eligible; I won’t fill the gaps with unsuitable products." : "Explore the reasons and the trade-offs."}`;
  if (s.category === "audio")
    s.canvas.message +=
      " Reference prices only; stock, host compatibility and setup costs still need checking. Ranking is a demo hypothesis, not measured dictation performance.";
  s.canvas.annotations = Object.fromEntries(
    ids.map((id, i) => {
      const p = fixtureData.products.find((p) => p.id === id)!;
      const a: Annotation = {
        role:
          s.category === "bags" && !closer
            ? i < 2
              ? "Close match"
              : "Related discovery"
            : priorities[s.canvas.priority ?? "value"],
        fitReason:
          s.category === "audio"
            ? p.specs["Why it may help"]
            : s.category === "bags"
              ? `${p.specs.Shape}; ${p.specs.Capacity} for your work + gym kit. ${p.specs.Compartments}.`
              : `${p.specs.Composition}, ${p.specs.Dimensions}, with a ${p.specs["Mattress depth"]} pocket for your stated bed.`,
        compromise: p.limitations[0],
      };
      if (!(s.category === "bags" && !closer)) a.rank = (i + 1) as 1 | 2 | 3;
      return [id, a];
    }),
  );
}
function resolveIds(text: string, s: Snapshot, visible: string[]): string[] {
  if (
    s.view === "evidence" &&
    /(?:play|stop).*video/.test(text) &&
    s.focusedProductId
  )
    return [s.focusedProductId];
  const explicit = visible.filter((id) => text.includes(id.toLowerCase()));
  if (explicit.length) return explicit;
  if (/first two|top two/.test(text)) return visible.slice(0, 2);
  if (/all|these/.test(text)) return visible;
  if (/\bright\b/.test(text) && visible.length)
    return [visible[visible.length - 1]];
  const ordinals = [
    "first|1|top recommendation|gold|left",
    "second|2|silver|middle",
    "third|3|bronze",
    "fourth|4",
    "fifth|5",
  ];
  const matched = ordinals.flatMap((pattern, i) =>
    new RegExp(`\\b(${pattern})\\b`).test(text) && visible[i]
      ? [visible[i]]
      : [],
  );
  if (matched.length) return matched;
  return s.focusedProductId ? [s.focusedProductId] : [];
}
export function applyDemo(input: DemoInput): {
  status: number;
  snapshot?: Snapshot;
  event?: AcceptedEvent;
  error?: string;
} {
  const record = sessions.get(input.sessionId);
  if (!record)
    return { status: 404, error: "Session expired. Start a new rehearsal." };
  const current = record.snapshot;
  const signature = JSON.stringify(input);
  const duplicate = record.events.get(input.eventId);
  if (duplicate)
    return duplicate.input === signature
      ? { status: 200, event: duplicate.event }
      : {
          status: 409,
          snapshot: current,
          error: "Event ID was reused with different content.",
        };
  if (
    input.epoch !== current.epoch ||
    input.baseRevision !== current.revision ||
    input.visibleRevision !== current.revision ||
    JSON.stringify(input.visibleProductIds) !==
      JSON.stringify(current.displayOrder)
  )
    return {
      status: 409,
      snapshot: current,
      error:
        "The view changed. Please repeat your request against the current numbered cards.",
    };
  const s: Snapshot = structuredClone(current);
  const t = input.text.trim().toLowerCase();
  s.canvas.message =
    "I didn’t catch a supported choice. Try “explore options”, “compare the first two”, “reviews for the first”, “save the first”, or “offers for the first”.";
  const ids = resolveIds(t, s, input.visibleProductIds);
  const productId = ids[0];
  const product = fixtureData.products.find((p) => p.id === productId);
  const budget = t.match(
    /(?:under|budget(?: is| of| to)?|maximum|max)\s*(?:usd\s*|\$)?(\d+(?:\.\d{1,2})?)/,
  );
  if (budget) {
    s.hardConstraints.budgetMinor = String(Math.round(Number(budget[1]) * 100));
    s.view = "understanding";
    s.displayOrder = [];
    s.shortlistIds = [];
    s.canvas.heading = "Your budget, updated.";
    s.canvas.message =
      "I’ve kept your reference and other preferences. Say “explore options” when you’re ready.";
  } else if (/softer|soft shape|rounded shape/.test(t)) {
    s.preferences = [...new Set([...s.preferences, "Softer shape"])];
    shortlist(s, true);
  } else if (/colour|color/.test(t)) {
    s.preferences = [
      ...s.preferences.filter((p) => !p.toLowerCase().includes("colour")),
      /navy|blue/.test(t) ? "Navy colour" : "Colour flexible",
    ];
    s.canvas.message =
      "Colour preference updated. Your budget and reference are preserved.";
    s.view = "understanding";
    s.displayOrder = [];
  } else if (/usb-a|usb-c/.test(t)) {
    s.hardConstraints.connection = t.includes("usb-a") ? "USB-A" : "USB-C";
    s.canvas.message =
      "Connection corrected. Other preferences and your budget are unchanged.";
    s.view = "understanding";
    s.displayOrder = [];
  } else if (/(?:dimensions|size)\s*\d/.test(t)) {
    const m = t.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (m) s.hardConstraints.dimensions = `${m[1]} × ${m[2]} cm`;
    s.view = "understanding";
    s.displayOrder = [];
    s.canvas.message =
      "Bed dimensions updated. Say “explore options” to check matching sets.";
  } else if (/depth\s*\d/.test(t)) {
    s.hardConstraints.depth = `${t.match(/depth\s*(\d+)/)![1]} cm`;
    s.view = "understanding";
    s.displayOrder = [];
    s.canvas.message =
      "Mattress depth updated. I’ll exclude pockets that are too shallow.";
  } else if (/tomorrow|deadline/.test(t)) {
    s.hardConstraints.deadlineDays = "1";
    s.canvas.message =
      "I’ll flag which demo offers meet tomorrow’s deadline. The cheapest may arrive later.";
    if (productId) s.view = "offers";
  } else if (/remove|exclude/.test(t) && productId) {
    s.exclusions = [...new Set([...s.exclusions, ...ids])];
    s.shortlistIds = s.shortlistIds.filter((id) => !ids.includes(id));
    s.displayOrder = s.displayOrder.filter((id) => !ids.includes(id));
    s.comparisonIds = s.comparisonIds.filter((id) => !ids.includes(id));
    if (ids.includes(s.focusedProductId!)) s.focusedProductId = null;
    s.canvas.message =
      "Removed from this shortlist. Say “restore” to bring the same product back.";
  } else if (/restore/.test(t)) {
    s.exclusions = [];
    shortlist(s, true);
    s.canvas.message =
      "Restored eligible products with their original identities and current constraints.";
  } else if (/saved|my saves/.test(t)) {
    s.view = "saved_choice";
    s.displayOrder = s.savedItems.map((item) => item.id);
    s.canvas.heading = "Your thinking, kept for later.";
    s.canvas.message =
      "Saved in this session. Say “restore shortlist” to explore again.";
  } else if (/save|defer/.test(t) && product) {
    if (!s.savedItems.some((item) => item.id === productId))
      s.savedItems.push({
        id: productId,
        rationale:
          s.canvas.annotations[productId]?.fitReason ?? "Saved by shopper",
      });
    s.canvas.message = `Saved ${product.model} for this session, with your reason. No order has been placed.`;
  } else if (/compare/.test(t) && ids.length >= 2) {
    s.view = "comparison";
    s.comparisonIds = ids;
    s.displayOrder = ids;
    s.canvas.heading = "The trade-offs, side by side.";
    s.canvas.message =
      "Positions stay still. Tell me which compromise matters most.";
  } else if (/reviews|evidence|video|play/.test(t) && product) {
    s.view = "evidence";
    s.focusedProductId = productId;
    s.evidenceIds = product.evidenceIds;
    s.canvas.heading = "A closer look at the evidence.";
    s.canvas.message = /play/.test(t)
      ? "Requested video is ready beside the product."
      : "Sources, scope and gaps, together. Say “play the first video” for the curated explainer.";
  } else if (/offers|seller|where.*buy/.test(t) && product) {
    s.view = "offers";
    s.focusedProductId = productId;
    s.canvas.heading = "Same product. Different ways to get it.";
    s.canvas.message =
      "Compare the exact variant, delivered total and timing. Seller evidence is separate from product reviews.";
  } else if (
    /choose.*(?:cheap|fast|earlier|lower)/.test(t) &&
    s.view === "offers" &&
    s.focusedProductId
  ) {
    s.selectedOfferId = `${s.focusedProductId}-${/fast|earlier/.test(t) ? "fast" : "cheap"}`;
    s.canvas.message =
      "Offer selected for comparison only. Checkout and approval belong to the session backend; this rehearsal cannot place an order.";
  } else if (/show|focus|option/.test(t) && product) {
    s.focusedProductId = productId;
    s.canvas.message = `Looking at ${product.brand} ${product.model}. Focus is separate from your shortlist ranking.`;
  } else if (
    /headset|clip|desktop|directional/.test(t) &&
    s.category === "audio"
  ) {
    s.canvas.solution = /headset/.test(t)
      ? "headset"
      : /clip/.test(t)
        ? "clip"
        : "desktop";
    s.view = "buying_priorities";
    s.displayOrder = [];
    s.canvas.heading = "What kind of good matters most?";
    s.canvas.message =
      "Choose your buying priority first. Then we’ll find suitable products within it. Your hard budget stays in place.";
  } else if (/value|quality|cost-effective|lowest|cheapest/.test(t)) {
    s.canvas.priority = /quality/.test(t)
      ? "quality"
      : /lowest|cheapest|cost-effective/.test(t)
        ? "cost"
        : "value";
    shortlist(s, true);
  } else if (/explore|continue|understood|more|shortlist|back/.test(t)) {
    if (s.category === "audio" && !s.canvas.solution) {
      s.view = "solution_types";
      s.displayOrder = [];
      s.canvas.heading = "Three ways to bring your voice closer.";
      s.canvas.message =
        "Start with the kind of setup you’d feel comfortable using.";
    } else if (s.category === "audio" && !s.canvas.priority) {
      s.view = "buying_priorities";
      s.displayOrder = [];
      s.canvas.heading = "Choose your buying priority.";
      s.canvas.message =
        "Value, supported quality, or the lowest-cost suitable option?";
    } else shortlist(s, /more|closer|back/.test(t));
  }
  // Any changed shortlist clears invalid focus. No card can reappear except through a fresh accepted revision.
  if (s.focusedProductId && !s.displayOrder.includes(s.focusedProductId))
    s.focusedProductId = null;
  s.revision++;
  record.snapshot = s;
  record.touched = Date.now();
  const event: AcceptedEvent = {
    sessionId: s.sessionId,
    epoch: s.epoch,
    eventId: input.eventId,
    turnId: input.turnId,
    revision: s.revision,
    type: "session.updated",
    snapshot: s,
  };
  record.events.set(input.eventId, { input: signature, event });
  if (record.events.size > 200)
    record.events.delete(record.events.keys().next().value!);
  return { status: 200, event };
}
