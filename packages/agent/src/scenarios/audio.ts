import type { AgentProposal, SessionSnapshot } from "@coupang/contract";
import {
  completeTotalMinor,
  getProduct,
  offersForProduct,
  PRODUCTS,
} from "../fixtures/catalog.js";
import type { BuyingPriority } from "@coupang/contract";

export function audioSolutionTypesProposal(
  base: Omit<AgentProposal, "action" | "payload" | "evidenceIds">,
  exclusions: string[] = [],
): AgentProposal {
  const choices = [
    ["headset", "a headset"],
    ["clip_on", "a clip-on mic"],
    ["directional_desktop", "a directional desktop mic"],
  ]
    .filter(([type]) =>
      PRODUCTS.some(
        (p) => p.solutionType === type && !exclusions.includes(p.id),
      ),
    )
    .map(([, label]) => label);
  return {
    ...base,
    action: "clarify",
    evidenceIds: [],
    payload: {
      question: choices.length
        ? `For noisy-café dictation, do you prefer ${choices.join(" or ")}?`
        : "All microphone types have been excluded. Which requirement would you like to reconsider?",
      stage: "solution_types",
    },
  };
}

export function audioPriorityProposal(
  base: Omit<AgentProposal, "action" | "payload" | "evidenceIds">,
): AgentProposal {
  return {
    ...base,
    action: "clarify",
    evidenceIds: [],
    payload: {
      question:
        "Within that type, should we optimize for best value, best supported quality, or lowest-cost suitable? Best value is not the same as cheapest.",
      stage: "buying_priorities",
    },
  };
}

export function buildAudioShortlist(
  snapshot: SessionSnapshot,
  solutionType: "headset" | "clip_on" | "directional_desktop" | undefined,
  priority: BuyingPriority,
): SessionSnapshot["shortlistEntries"] {
  let pool = PRODUCTS.filter(
    (p) =>
      p.category === "audio" &&
      offersForProduct(p.id).length > 0 &&
      !snapshot.exclusions.includes(p.id) &&
      (!solutionType || p.solutionType === solutionType),
  );

  const budget = snapshot.hardConstraints["budgetMinor"];
  if (typeof budget === "number") {
    pool = pool.filter((p) => {
      const offers = offersForProduct(p.id);
      return offers.some((o) => {
        const t = completeTotalMinor(o);
        return t != null && t <= budget;
      });
    });
  }

  if (priority === "lowest_cost_suitable") {
    pool = [...pool].sort((a, b) => {
      const ta = Math.min(
        ...offersForProduct(a.id).map((o) => completeTotalMinor(o) ?? Infinity),
      );
      const tb = Math.min(
        ...offersForProduct(b.id).map((o) => completeTotalMinor(o) ?? Infinity),
      );
      return ta - tb;
    });
  } else if (priority === "best_supported_quality") {
    pool = [...pool].sort(
      (a, b) => (b.authoredFitScore ?? 0) - (a.authoredFitScore ?? 0),
    );
  } else {
    // best_value: balance fit score and total
    pool = [...pool].sort((a, b) => {
      const score = (p: (typeof pool)[0]) => {
        const t = Math.min(
          ...offersForProduct(p.id).map((o) => completeTotalMinor(o) ?? 999999),
        );
        return (p.authoredFitScore ?? 50) - t / 500;
      };
      return score(b) - score(a);
    });
  }

  const top = pool.slice(0, 3);
  const ranks = ["gold", "silver", "bronze"] as const;
  return top.map((p, i) => ({
    productId: p.id,
    rank: ranks[i],
    fitReason: fitReason(p, priority),
    compromise: compromise(p),
  }));
}

function fitReason(p: (typeof PRODUCTS)[0], priority: BuyingPriority): string {
  if (priority === "lowest_cost_suitable") {
    return `${p.title} has the lowest complete fixture total among eligible ${p.solutionType} options checked.`;
  }
  if (priority === "best_supported_quality") {
    return `${p.title} leads authored fit heuristics for your café dictation constraints (not measured WER).`;
  }
  return `${p.title} balances authored fit and complete offer total for value — not merely the lowest price.`;
}

function compromise(p: (typeof PRODUCTS)[0]): string {
  if (p.solutionType === "headset") {
    return "Requires wearing a headset; hearing-side ANC is not the same as microphone processing.";
  }
  if (p.solutionType === "clip_on") {
    return "Placement and host hardware still affect outgoing clarity.";
  }
  return "Desktop mics are less portable for moving between café seats.";
}

type SolutionType = "headset" | "clip_on" | "directional_desktop";

function solutionMentions(text: string) {
  return [
    ...text.matchAll(
      /\b(headsets?|earphones?|lavalier(?:s)?|lapel|clip[- ]?on|desktop|directional|beam)\b/gi,
    ),
  ].map((m) => {
    const prefix = text.slice(0, m.index);
    const excluded =
      /\b(?:no|not|without|avoid|exclude|don't want|do not want|don't like|do not like)\s+(?:(?:a|an|any|the|wearing)\s+){0,3}$/i.test(
        prefix,
      );
    const type: SolutionType = /headset|earphone/i.test(m[0])
      ? "headset"
      : /lavalier|lapel|clip/i.test(m[0])
        ? "clip_on"
        : "directional_desktop";
    return { type, excluded };
  });
}

export function parseExcludedSolutionTypes(text: string): SolutionType[] {
  return [
    ...new Set(
      solutionMentions(text)
        .filter((m) => m.excluded)
        .map((m) => m.type),
    ),
  ];
}

export function parseSolutionType(text: string): SolutionType | undefined {
  const mentions = solutionMentions(text);
  const excluded = new Set(
    mentions.filter((m) => m.excluded).map((m) => m.type),
  );
  // Conflicting positive/negative mentions require clarification, not guessing.
  return mentions.find((m) => !m.excluded && !excluded.has(m.type))?.type;
}

export function parsePriority(text: string): BuyingPriority | undefined {
  if (/best value|value/i.test(text) && !/quality|lowest|cheap/i.test(text)) {
    return "best_value";
  }
  if (/quality/i.test(text)) return "best_supported_quality";
  if (/lowest|cheap/i.test(text)) return "lowest_cost_suitable";
  if (/best value/i.test(text)) return "best_value";
  return undefined;
}

export function ensureProduct(id: string) {
  return getProduct(id);
}
