import { parseBudget } from "../intent/requirements.js";
import type { AgentProposal, SessionSnapshot } from "@coupang/contract";
import { PRODUCTS } from "../fixtures/catalog.js";

export function beddingClarifySizing(
  base: Omit<AgentProposal, "action" | "payload" | "evidenceIds">,
): AgentProposal {
  return {
    ...base,
    action: "clarify",
    evidenceIds: [],
    payload: {
      question:
        "For warm-room bedding, what are the exact bed dimensions or size, and any must-have material or care needs? I won't claim cooling or health effects.",
      stage: "understand",
    },
  };
}

export function buildBeddingShortlist(
  snapshot: SessionSnapshot,
): SessionSnapshot["shortlistEntries"] {
  const size = String(
    snapshot.hardConstraints["bedSize"] ??
      snapshot.preferences["bedSize"] ??
      "queen",
  );
  const material = String(
    snapshot.preferences["material"] ??
      snapshot.hardConstraints["material"] ??
      "",
  );

  let pool = PRODUCTS.filter(
    (p) =>
      p.category === "bedding" &&
      !snapshot.exclusions.includes(p.id) &&
      (!size || String(p.specs["size"] ?? "") === size),
  );
  if (material) {
    pool = pool.filter((p) =>
      String(p.specs["material"] ?? "").includes(material.toLowerCase()),
    );
  }
  if (pool.length === 0) {
    pool = PRODUCTS.filter(
      (p) => p.category === "bedding" && !snapshot.exclusions.includes(p.id),
    );
  }

  const ranks = ["gold", "silver", "bronze"] as const;
  return pool.slice(0, 3).map((p, i) => ({
    productId: p.id,
    rank: ranks[i],
    fitReason: `Matches size ${String(p.specs["size"])} with ${String(p.specs["material"])}; care notes are fixture-supported.`,
    compromise:
      "No cooling or health guarantees — only material and care attributes we have.",
  }));
}

export function parseBeddingPrefs(text: string): {
  bedSize?: string;
  material?: string;
  budgetMinor?: number;
} {
  const out: { bedSize?: string; material?: string; budgetMinor?: number } = {};
  if (/\bking\b/i.test(text)) out.bedSize = "king";
  if (/\bqueen\b/i.test(text)) out.bedSize = "queen";
  if (/\bfull\b|\bdouble\b/i.test(text)) out.bedSize = "full";
  if (/linen/i.test(text)) out.material = "linen";
  if (/percale/i.test(text)) out.material = "cotton-percale";
  if (/bamboo/i.test(text)) out.material = "bamboo-blend";
  if (/sateen/i.test(text)) out.material = "cotton-sateen";
  const budget = parseBudget(text);
  if (budget !== undefined) out.budgetMinor = budget;
  return out;
}

export function beddingOpeningProposal(
  base: Omit<AgentProposal, "action" | "payload" | "evidenceIds">,
): AgentProposal {
  return beddingClarifySizing(base);
}
