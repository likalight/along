import { parseBudget } from "../intent/requirements.js";
import type { AgentProposal, SessionSnapshot } from "@coupang/contract";
import { PRODUCTS, completeTotalMinor, offersForProduct } from "../fixtures/catalog.js";

export function bagClarifyShapeColour(
  base: Omit<AgentProposal, "action" | "payload" | "evidenceIds">,
): AgentProposal {
  return {
    ...base,
    action: "clarify",
    evidenceIds: [],
    payload: {
      question:
        "What matters most in your bag — how much it holds, its shape, or its colour?",
      stage: "understand",
    },
  };
}

export function buildBagDiscovery(snapshot: SessionSnapshot): {
  closeMatches: string[];
  related: string[];
  narrowed: SessionSnapshot["shortlistEntries"];
} {
  const shape = String(
    snapshot.preferences["shape"] ?? snapshot.hardConstraints["shape"] ?? "",
  );
  const color = String(snapshot.preferences["color"] ?? "");
  let bags = PRODUCTS.filter(
    (p) => p.category === "bags" && !snapshot.exclusions.includes(p.id),
  );

  const budget = snapshot.hardConstraints["budgetMinor"];
  const currency = snapshot.hardConstraints["currency"] ?? "USD";
  if (typeof budget === "number" && Number.isFinite(budget)) {
    // Apply the accepted ceiling before ranking or taking three. Otherwise a
    // roomy but unaffordable top three can hide all the suitable cheaper bags.
    // This candidate filter never replaces the authoritative quote checks.
    bags = bags.filter((product) => offersForProduct(product.id).some((offer) => {
      const total = completeTotalMinor(offer);
      return offer.currency === currency && total !== null && total <= budget;
    }));
  }

  if (snapshot.preferences["bagPriority"] === "capacity") {
    // Prefer known roomier bags; never invent a capacity for missing specs.
    bags = [...bags].sort((a, b) =>
      Number(b.specs["capacityLitres"] ?? 0) - Number(a.specs["capacityLitres"] ?? 0));
  }

  const close = bags.filter((p) => {
    const shapes = [p.specs["shape"], p.specs["style"], ...(Array.isArray(p.specs["carryModes"]) ? p.specs["carryModes"] : [])].filter(Boolean).map(value => String(value).toLowerCase());
    const c = String(p.specs["color"] ?? "").toLowerCase();
    return (
      (!shape || shapes.some(value => value.includes(shape.toLowerCase()))) && (!color || c === color || c.includes(color))
    );
  });

  const closeMatches = (close.length ? close : bags)
    .slice(0, 2)
    .map((p) => p.id);
  const related = bags
    .filter((p) => !closeMatches.includes(p.id))
    .slice(0, 3)
    .map((p) => p.id);

  const narrowedPool = [...closeMatches, ...related]
    .map((id) => PRODUCTS.find((p) => p.id === id)!)
    .filter(Boolean)
    .slice(0, 3);

  const ranks = ["gold", "silver", "bronze"] as const;
  const narrowed = narrowedPool.map((p, i) => ({
    productId: p.id,
    rank: ranks[i],
    fitReason: snapshot.preferences["bagPriority"] === "capacity"
      ? typeof p.specs["capacityLitres"] === "number"
        ? `${p.specs["capacityLitres"]} litres of space, with room to consider for your work and gym gear.`
        : "Worth a look, though we still need to check how much it holds."
      : `Worth a look for your ${shape || color || "everyday bag"} preference.`,
    compromise:
      "We still need to check the laptop fit and whether it keeps your shoes separate.",
  }));

  return { closeMatches, related, narrowed };
}

export function parseBagPrefs(text: string): {
  shape?: string;
  color?: string;
  budgetMinor?: number;
  needTomorrow?: boolean;
  bagPriority?: "capacity" | "shape" | "color";
} {
  const out: {
    shape?: string;
    color?: string;
    budgetMinor?: number;
    needTomorrow?: boolean;
    bagPriority?: "capacity" | "shape" | "color";
  } = {};
  if (/\b(capacity|roomy|spacious|storage|space|holds?|fit everything)\b|room for|how much.*(?:carry|fit)|laptop.*gym|gym.*laptop/i.test(text)) out.bagPriority = "capacity";
  else if (/\bshape\b/i.test(text)) out.bagPriority = "shape";
  else if (/\bcolou?r\b/i.test(text)) out.bagPriority = "color";
  if (/backpack/i.test(text)) out.shape = "backpack";
  if (/tote/i.test(text)) out.shape = "tote";
  if (/sling/i.test(text)) out.shape = "sling";
  if (/duffel|weekender/i.test(text)) out.shape = "duffel";
  if (/navy|blue/i.test(text)) out.color = "navy";
  if (/olive/i.test(text)) out.color = "olive";
  if (/black/i.test(text)) out.color = "black";
  if (/khaki/i.test(text)) out.color = "khaki";
  if (/slate/i.test(text)) out.color = "slate";
  const budget = parseBudget(text);
  if (budget !== undefined) out.budgetMinor = budget;
  if (/tomorrow|need it tomorrow|next day/i.test(text)) out.needTomorrow = true;
  return out;
}
