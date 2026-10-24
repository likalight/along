import type { InputEvent, SessionSnapshot } from "@coupang/contract";
import { isDiscoveryFollowup } from "../discovery/reference.js";
import { getProduct } from "../fixtures/catalog.js";

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
  | "compare"
  | "discovery_followup"
  | "catalog_product"
  | "discovery_return";

const STOP = /\b(stop|never ?mind|not now|defer|cancel|quit)\b/i;
const SAVE = /\b(save( this)?|pin this|bookmark)\b/i;
const EVIDENCE = /\b(review|reviews|complaint|video|seller|evidence|drawback|rating)\b/i;
const PRIORITY =
  /\b(best value|best quality|lowest[- ]cost|cheapest suitable|quality[- ]first|budget[- ]first)\b/i;
const SOLUTION = /\b(headset|clip[- ]?on|desktop|directional|solution type)\b/i;
const COMPARE = /\b(compare|versus|vs\.?)\b/i;
const APPROVE = /\b(approve|confirm( the)? (purchase|order)|yes[,.]? (approve|confirm)|place (the )?order)\b/i;
const ORDINAL = /\b(first|second|third|left|right|middle|center|centre|top|blue|navy|olive|the \d+(st|nd|rd|th))\b/i;
const CORRECT = /\b(actually|not the|wrong|i meant|correction|shape|colour|color)\b/i;
const REVISE = /\b(budget|instead|change|prefer|tomorrow|delivery|need it by)\b/i;

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
  if (/^back to my catalog[.!]?$/i.test(text)) return "discovery_return";
  if (/^(?:show|open) catalog (?:MIC|BAG|BED)-\d{3}[.!]?$/i.test(text)) return "catalog_product";
  if (snapshot.discoveryReference && isDiscoveryFollowup(text)) return "discovery_followup";
  if (SAVE.test(text)) return "save";
  if (APPROVE.test(text) && snapshot.summaryId) return "approve_candidate";
  if (input.modality === "text" && CORRECT.test(text) && snapshot.imageInferences.length) {
    return "image_correct";
  }
  if (EVIDENCE.test(text)) return "evidence_q";
  if (PRIORITY.test(text)) return "priority";
  if (SOLUTION.test(text) && !/\d|usb|tomorrow/i.test(text) && snapshot.scenarioId === "cafe_dictation") return "solution_type";
  if (COMPARE.test(text)) return "compare";
  if (ORDINAL.test(text) && snapshot.displayOrder.length) return "ordinal_ref";
  if (CORRECT.test(text) && snapshot.imageInferences.length) return "image_correct";
  if (REVISE.test(text) && snapshot.revision > 0) return "revise";

  // Strong intent: exact product/model-ish or clear category + constraint
  if (
    /\b(MIC-\d+|BAG-\d+|BED-\d+|beam pro|citypack|percale|talkclip)\b/i.test(text)
  ) {
    return "strong_intent";
  }

  if (snapshot.revision === 0 && text.length < 24) return "cold_start";
  if (
    /\b(something|not sure|maybe|browse|looking around|no idea)\b/i.test(text)
  ) {
    return "cold_start";
  }
  if (/\b(for|need|want|looking for)\b/i.test(text) && text.split(/\s+/).length <= 8) {
    return "weak_intent";
  }
  if (/\b(café|cafe|dictation|noisy|microphone|headset)\b/i.test(text)) {
    return snapshot.scenarioStage === "opening" || snapshot.scenarioStage === "understand"
      ? "weak_intent"
      : "strong_intent";
  }
  if (/\b(bag|backpack|gym|tote)\b/i.test(text)) return "weak_intent";
  if (/\b(sheets?|bedding|bedsheet|linen|percale)\b/i.test(text)) return "weak_intent";

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
  if (!order.length) return { ambiguous: "Nothing is on screen to refer to yet." };

  const lower = text.toLowerCase();
  // Product order identifies numbered choices, not spatial placement. Carousel
  // focus, comparison mode and responsive layouts can all move cards on screen.
  if (/\b(left|right|middle|center|centre|top)\b/.test(lower))
    return { ambiguous: "Which product do you mean? Say its name or number so I choose the right one." };
  if (/\b(first|1st)\b/.test(lower)) return { productId: order[0] };
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

  const named = order.filter((id) => {
    const product = getProduct(id);
    return lower.includes(id.toLowerCase()) || (product && lower.includes(product.model.toLowerCase()));
  });
  if (named.length === 1) return { productId: named[0] };
  if (named.length > 1) return { ambiguous: "More than one named option is visible — which one?" };

  const color = lower.match(/\b(navy|blue|olive|black|white|grey|gray|green|orange|red|sand|ivory|burgundy|terracotta)\b/)?.[1];
  if (color) {
    const matches = order.filter(id => {
      const specs = getProduct(id)?.specs;
      const variant = specs?.demoVariant as { color?: string } | undefined;
      const actual = String(specs?.color ?? variant?.color ?? "").toLowerCase();
      return actual.includes(color) || (color === "blue" && actual.includes("navy")) ||
        (["grey", "gray"].includes(color) && /gr[ae]y/.test(actual));
    });
    if (matches.length === 1) return { productId: matches[0] };
    if (matches.length > 1) return { ambiguous: `More than one ${color} option is visible — which one?` };
  }
  return { ambiguous: "I'm not sure which item you mean — could you say the number or name?" };
}
