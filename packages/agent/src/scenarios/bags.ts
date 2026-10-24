import type { AgentProposal, SessionSnapshot } from "@coupang/contract";
import { PRODUCTS } from "../fixtures/catalog.js";

export function bagClarifyShapeColour(
  base: Omit<AgentProposal, "action" | "payload" | "evidenceIds">,
): AgentProposal {
  return {
    ...base,
    action: "clarify",
    evidenceIds: [],
    payload: {
      question:
        "For this bag inspiration, what matters more right now — the shape, the colour, or another practical detail like capacity?",
      stage: "understand",
    },
  };
}

export function buildBagDiscovery(snapshot: SessionSnapshot): {
  closeMatches: string[];
  related: string[];
  narrowed: SessionSnapshot["shortlistEntries"];
} {
  const shape = String(snapshot.preferences["shape"] ?? snapshot.hardConstraints["shape"] ?? "");
  const color = String(snapshot.preferences["color"] ?? "");
  let bags = PRODUCTS.filter(
    (p) => p.category === "bags" && !snapshot.exclusions.includes(p.id),
  );

  const close = bags.filter((p) => {
    const s = String(p.specs["shape"] ?? "");
    const c = String(p.specs["color"] ?? "");
    return (
      (!shape || s === shape) && (!color || c === color || c.includes(color))
    );
  });

  const closeMatches = (close.length ? close : bags).slice(0, 2).map((p) => p.id);
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
    fitReason: `Tentative resemblance to your ${shape || "preferred"} / ${color || "stated"} cues — not designer attribution.`,
    compromise:
      "Practical fit (laptop/waterproofing) is not inferred from appearance alone.",
  }));

  return { closeMatches, related, narrowed };
}

export function parseBagPrefs(text: string): {
  shape?: string;
  color?: string;
  budgetMinor?: number;
  needTomorrow?: boolean;
} {
  const out: {
    shape?: string;
    color?: string;
    budgetMinor?: number;
    needTomorrow?: boolean;
  } = {};
  if (/backpack/i.test(text)) out.shape = "backpack";
  if (/tote/i.test(text)) out.shape = "tote";
  if (/sling/i.test(text)) out.shape = "sling";
  if (/duffel|weekender/i.test(text)) out.shape = "duffel";
  if (/navy|blue/i.test(text)) out.color = "navy";
  if (/olive/i.test(text)) out.color = "olive";
  if (/black/i.test(text)) out.color = "black";
  if (/khaki/i.test(text)) out.color = "khaki";
  if (/slate/i.test(text)) out.color = "slate";
  const budget = text.match(/\$?\s?(\d{2,4})\b/);
  if (budget) out.budgetMinor = Number(budget[1]) * 100;
  if (/tomorrow|need it tomorrow|next day/i.test(text)) out.needTomorrow = true;
  return out;
}
