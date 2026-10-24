import type { DiscoveryReference, SessionSnapshot } from "@coupang/contract";
import { getProduct } from "../fixtures/catalog.js";

export type DiscoveryImportResult = {
  snapshot: SessionSnapshot;
  speakable: string;
  duplicate: boolean;
  turnId: string;
};

export function discoveryArrival(reference: DiscoveryReference): string {
  const candidate = reference.candidate;
  const price = candidate.price
    ? `${candidate.price.currency} ${candidate.price.amount.toFixed(2)} is a ${reference.mode === "demo" ? "demo" : "captured listing"} price, not a delivered total.`
    : "Price and delivery costs are unknown.";
  return `I've brought ${quoted(candidate.title)} into our conversation. ` +
    `${candidate.linkKind === "search" ? "This opens a search page; a specific listing still needs checking." : "The exact item and seller details still need checking."} ` +
    `${price} Your requirements are unchanged. We can discuss fit or similarity, or say “Back to my catalog” to resume your choices.`;
}

/** An explicit new catalog request changes the visible referent; vague commands do not. */
export function isExplicitCatalogRequest(text: string): boolean {
  if (/\b(catalog|(?:MIC|BAG|BED)-\d{3})\b/i.test(text)) return true;
  return !/\b(this|that|it|external)\b/i.test(text) &&
    /\b(find|search|show|need|want|looking for)\b.*\b(bags?|backpacks?|totes?|bedsheets?|sheets?|bedding|microphones?|headsets?)\b/i.test(text);
}

export function isDiscoveryFollowup(text: string): boolean {
  // While the external reference is visible, ordinals, offers and approvals cannot
  // silently resolve against a hidden earlier catalog selection.
  return !isExplicitCatalogRequest(text);
}

const quoted = (value: string) => JSON.stringify(value.length > 140 ? `${value.slice(0, 137)}…` : value);

/** Only the shopper's fresh question is interpreted; imported labels are evidence. */
export function discoveryReply(reference: DiscoveryReference, snapshot: SessionSnapshot, text: string): string {
  const candidate = reference.candidate;
  if (/\b(laptop|fit)\b/i.test(text)) {
    const product = reference.mode === "demo" && candidate.catalogProductId ? getProduct(candidate.catalogProductId) : undefined;
    const max = product?.specs.laptopFitInches;
    const requested = text.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:[- ]?inch|inches|["”])/i)?.[1];
    const compatibility = snapshot.hardConstraints.compatibility as { laptopInches?: number } | undefined;
    const laptop = requested ? Number(requested) : snapshot.hardConstraints.laptopInches ?? compatibility?.laptopInches;
    const grounding = typeof max === "number"
      ? `The demo reference ${product!.id} states laptop support up to ${max} inches${typeof laptop === "number" && laptop > max ? `, below the ${laptop}-inch size you asked about` : ""}. That is not verification of the external listing. `
      : "Laptop fit is not verified for this external reference. ";
    return grounding + "We need your laptop's width, height and thickness, plus the exact bag's usable compartment measurements. Your requirements are unchanged.";
  }
  if (/\b(cheaper|less expensive)\b/i.test(text)) {
    const price = candidate.price ? `${candidate.price.currency} ${candidate.price.amount.toFixed(2)}` : "an unknown price";
    return `This ${reference.mode === "demo" ? "demo reference" : "listing snapshot"} shows ${price}, before unknown delivery costs and taxes. I have not searched for a cheaper listing or converted currencies. Find another match in the discovery panel, or say “Back to my catalog” to compare your earlier choices.`;
  }
  if (/\b(buy|purchase|approve|confirm|order|offers?|seller|compare|save|first|second|third|select|choose)\b/i.test(text))
    return "This match needs its exact listing, seller and delivery details checked before you decide. I cannot purchase it here or use an earlier catalog offer for it. Say “Back to my catalog” to resume your earlier choices.";
  if (!/\b(similar|similarity|exact|same|match|why)\b/i.test(text))
    return "We are discussing the match you brought in. I can explain its similarity or what we still need to check for fit. Say “Back to my catalog” to resume your earlier choices.";
  const reasons = candidate.reasons.length
    ? `The match was suggested for ${candidate.reasons.slice(0, 2).map(quoted).join(" and ")}. `
    : "No specific similarity details were supplied. ";
  const unknowns = candidate.unknowns.length
    ? `Still unverified: ${candidate.unknowns.slice(0, 2).map(quoted).join(" and ")}. `
    : "Exact identity, material and dimensions remain unverified. ";
  return reasons + unknowns + "These are reported clues, not proof of the same item or a guarantee of fit.";
}
