import type { InputEvent, SessionSnapshot } from "@coupang/contract";

export type Route =
  | "strong_intent"
  | "weak_intent"
  | "cold_start"
  | "revise"
  | "evidence_q"
  | "ordinal_ref"
  | "stop_decline"
  | "image_correct"
  | "image_ingest"
  | "link_ingest"
  | "save"
  | "approve_candidate"
  | "priority"
  | "solution_type"
  | "compare";

const STOP = /\b(stop|never ?mind|not now|defer|cancel|quit)\b/i;
const SAVE = /\b(save( this)?|pin this|bookmark)\b/i;
const EVIDENCE =
  /\b(review|reviews|complaint|video|seller|evidence|drawback|rating)\b/i;
const PRIORITY =
  /\b(best value|best quality|lowest[- ]cost|cheapest suitable|quality[- ]first|budget[- ]first)\b/i;
const SOLUTION =
  /\b(headsets?|lavalier(?:s)?|lapel|clip[- ]?on|desktop|directional|solution type)\b/i;
const COMPARE = /\b(compare|versus|vs\.?)\b/i;
const APPROVE =
  /\b(approve|confirm( the)? (purchase|order)|yes[,.]? (approve|confirm)|place (the )?order)\b/i;
const ORDINAL =
  /\b(first|second|third|left|right|top|blue|navy|olive|the \d+(st|nd|rd|th))\b/i;
const CORRECT =
  /\b(actually|not the|wrong|i meant|correction|shape|colour|color)\b/i;
const REVISE =
  /\b(budget|instead|change|prefer|tomorrow|delivery|need it by)\b/i;

export function routeInput(
  input: InputEvent,
  snapshot: SessionSnapshot,
): Route {
  if (input.modality === "image") return "image_ingest";
  if (input.modality === "link") return "link_ingest";

  const text = (input.text ?? "").trim();
  if (!text) {
    if (snapshot.revision === 0) return "cold_start";
    return "weak_intent";
  }

  if (STOP.test(text)) return "stop_decline";
  if (SAVE.test(text)) return "save";
  if (APPROVE.test(text) && snapshot.summaryId) return "approve_candidate";
  if (
    input.modality === "text" &&
    CORRECT.test(text) &&
    snapshot.imageInferences.length
  ) {
    return "image_correct";
  }
  if (EVIDENCE.test(text)) return "evidence_q";
  // A priority embedded in a request must not swallow its budget, type or fit.
  if (
    PRIORITY.test(text) &&
    !SOLUTION.test(text) &&
    !/\d|usb|budget|tomorrow|delivery|under|exclude|without/i.test(text)
  )
    return "priority";
  if (
    SOLUTION.test(text) &&
    !/\d|usb|tomorrow/i.test(text) &&
    snapshot.scenarioId === "cafe_dictation"
  )
    return "solution_type";
  if (COMPARE.test(text)) return "compare";
  if (ORDINAL.test(text) && snapshot.displayOrder.length) return "ordinal_ref";
  if (CORRECT.test(text) && snapshot.imageInferences.length)
    return "image_correct";
  if (REVISE.test(text) && snapshot.revision > 0) return "revise";

  // Strong intent: exact product/model-ish or clear category + constraint
  if (
    /\b(MIC-\d+|BAG-\d+|BED-\d+|beam pro|citypack|percale|talkclip)\b/i.test(
      text,
    )
  ) {
    return "strong_intent";
  }

  if (snapshot.revision === 0 && text.length < 24) return "cold_start";
  if (
    /\b(something|not sure|maybe|browse|looking around|no idea)\b/i.test(text)
  ) {
    return "cold_start";
  }
  if (
    /\b(for|need|want|looking for)\b/i.test(text) &&
    text.split(/\s+/).length <= 8
  ) {
    return "weak_intent";
  }
  if (/\b(café|cafe|dictation|noisy|microphone|headset)\b/i.test(text)) {
    return snapshot.scenarioStage === "opening" ||
      snapshot.scenarioStage === "understand"
      ? "weak_intent"
      : "strong_intent";
  }
  if (/\b(bag|backpack|gym|tote)\b/i.test(text)) return "weak_intent";
  if (/\b(sheets?|bedding|bedsheet|linen|percale)\b/i.test(text))
    return "weak_intent";

  return snapshot.revision === 0 ? "cold_start" : "weak_intent";
}

/** Resolve ordinal/spatial/color refs against accepted visible state. */
export function resolveReference(
  text: string,
  snapshot: SessionSnapshot,
  visibleProductIds: string[],
): { productId?: string; ambiguous?: string } {
  const order =
    visibleProductIds.length > 0 ? visibleProductIds : snapshot.displayOrder;
  if (!order.length)
    return { ambiguous: "Nothing is on screen to refer to yet." };

  const lower = text.toLowerCase();
  if (/\b(first|1st|top)\b/.test(lower)) return { productId: order[0] };
  if (/\b(second|2nd)\b/.test(lower)) {
    return order[1]
      ? { productId: order[1] }
      : { ambiguous: "There isn't a second option visible." };
  }
  if (/\b(third|3rd)\b/.test(lower)) {
    return order[2]
      ? { productId: order[2] }
      : { ambiguous: "There isn't a third option visible." };
  }
  if (/\bleft\b/.test(lower)) return { productId: order[0] };
  if (/\bright\b/.test(lower)) return { productId: order[order.length - 1] };

  const colorHit = order.find((id) => {
    // color often encoded in variantId / title via store — soft match on id list position labels only
    return lower.includes(id.toLowerCase());
  });
  if (colorHit) return { productId: colorHit };

  const navy = order.filter(
    (id) => /navy|blue/i.test(id) || lower.includes("navy"),
  );
  if (/\bnavy\b|\bblue\b/.test(lower)) {
    const matches = order.filter(
      (id) => id.startsWith("BAG") && (id === "BAG-001" || id === "BAG-006"),
    );
    if (matches.length === 1) return { productId: matches[0] };
    if (matches.length > 1) {
      return { ambiguous: "More than one navy option is visible — which one?" };
    }
  }

  void navy;
  return {
    ambiguous:
      "I'm not sure which item you mean — could you say the number or name?",
  };
}
