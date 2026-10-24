import type { DemoReviews, Evidence, Product } from "./types.ts";
import { emptyMetrics } from "./types.ts";
const authors = ["Demo shopper Alex", "Demo shopper Sam", "Demo shopper Jo", "Demo shopper Riley", "Demo shopper Casey", "Demo shopper Morgan", "Demo shopper Taylor", "Demo shopper Quinn"];
const disclosure = "Fictional reviews and ratings authored for this demo. These are simulated shopper perspectives, not real customer testimonials or evidence of product performance.";
type ReviewDraft = [title: string, body: string, usedFor: string];
function drafts(p: Product): ReviewDraft[] {
  if (p.category === "everyday-bags") {
    const capacity = p.specs.capacityLitres, laptop = p.specs.laptopFitInches, shoes = p.specs.separateShoeCompartment;
    return [
      ["A practical daily layout", `The ${p.model}'s ${capacity}-litre size suits my notebook, lunch and everyday essentials. ${laptop ? `The listed ${laptop}-inch laptop sleeve is a big part of the appeal; I would still check my laptop's actual dimensions.` : "I would add a padded sleeve for electronics."}`, "Daily commute"],
      [shoes ? "Useful after-work separation" : "Packing needs a little planning", shoes ? `The separate shoe section is the feature I wanted for work-to-gym days. A bulky pair of trainers still takes space away from the rest of this ${capacity}-litre bag.` : "I need a separate shoe pouch for gym days because a dedicated shoe section is not confirmed. This would suit my lighter days better than a full change of clothes and a laptop.", "Work and gym"],
      ["Keep an eye on packed weight", `${typeof p.specs.weightGrams === "number" ? `The listed ${p.specs.weightGrams} g empty weight is useful to know, especially before adding a laptop and water bottle.` : "I would want to know the empty weight before choosing this for long walks."} I like the format, but would avoid filling every pocket just because it is there.`, "Walking between appointments"],
      ["Good format, with a trade-off", `The ${p.specs.style ?? "carry"} format appeals to me for errands. ${p.specs.expandedCapacityLitres ? `Expansion to ${p.specs.expandedCapacityLitres} litres would help on shopping days, though a full bag will be bulkier.` : "I would measure my largest items first instead of relying only on the litre rating."} I would pack a rain cover for a wet forecast.`, "Weekend errands"],
    ];
  }
  if (p.category === "bedsheet-sets") {
    const pieces = p.specs.includedPieces as { fitted: number; flat: number; pillowcases: number } | null;
    return [
      ["Texture was the deciding factor", `The ${p.specs.compositionLabel} composition is what draws me to ${p.model}. ${p.specs.weave ? `I prefer the character of ${p.specs.weave} to choosing by thread count alone.` : "I would ask about the weave before deciding."} I am choosing a fabric preference, rather than expecting a guaranteed cooler night.`, "Everyday bedding"],
      ["Measure before choosing", `The listed fitted sheet is ${p.specs.fittedWidthInches} × ${p.specs.fittedLengthInches} inches. ${p.specs.maxMattressDepthInches ? `I would compare my mattress and topper with the ${p.specs.maxMattressDepthInches}-inch depth limit; the size name alone is not enough.` : "I would confirm the maximum mattress depth before checking out."}`, "Mattress fit"],
      ["Care is part of the choice", p.specs.care ? "The wash instructions matter to me as much as the color. I would wash this set before first use, leave enough drying time and avoid over-drying; I keep a second set for laundry day." : "I like the fabric description, but missing care instructions would make me ask for more information before ordering. I want something that fits my weekly laundry routine.", "Weekly washing"],
      ["Check the whole set", pieces ? `One fitted sheet, one flat sheet and ${pieces.pillowcases} pillowcase${pieces.pillowcases === 1 ? "" : "s"} would cover my planned setup. I would check pillow dimensions and the pictured color against my room before choosing.` : "The fabric description appeals to me, but the retail piece count is not confirmed. I would check that before comparing this price with another complete set.", "Bedroom refresh"],
    ];
  }
  const type = p.specs.solutionType;
  const path = p.specs.compatibilityFixture as { supportedHostConnections: string[]; requiredHardwareIds: string[] };
  const uncertain = p.specs.detailStatus === "linked_file_not_supplied";
  return [
    [type === "headset" ? "Convenient while typing" : type === "clip" ? "Easy to plan around a wearable mic" : "A considered desk setup",
      `${p.brand} ${p.model} appeals to me for a ${type === "headset" ? "hands-free" : type === "clip" ? "wearable" : "desk"} setup while writing spoken prompts. ${uncertain ? "I would confirm the microphone details before deciding; the listing alone does not tell me how it handles my room." : "I would test the placement in my actual recording app before relying on it for longer sessions."}`, "Spoken prompts"],
    ["Check the whole connection path", path.supportedHostConnections.length
      ? `I checked the demo bundle's ${path.supportedHostConnections.join(" or ")} connection before comparing prices. ${path.requiredHardwareIds.length ? `There ${path.requiredHardwareIds.length === 1 ? "is one separately priced setup component" : `are ${path.requiredHardwareIds.length} separately priced setup components`}, so the microphone price alone is not the whole cost.` : "Delivery still needs to be included in the total."} I would separately confirm what comes in the real retail box.`
      : "I would ask for the missing connector and package details before ordering. It is an interesting option, but I need to know how it connects to my computer.", "Computer compatibility"],
    ["Room noise still matters", type === "headset" ? "Close microphone placement is what interests me for café sessions. Headphone ANC would help my listening experience, but I would still test whether the microphone picks up nearby conversations."
      : type === "clip" ? "The wearable format appeals to me when moving around. I would pay attention to clothing contact and placement, then test it with another person talking nearby."
      : "I would put this close to my speaking position and compare recordings with and without processing. The desk space and setup effort matter to me just as much as the microphone's features.", "Shared workspace"],
    ["Compare delivery and setup costs", `I would compare both offers for ${p.model}, including shipping and any required hardware. ${["out_of_stock", "unavailable", "discontinued", "discontinued_at_seller", "backordered", "special_order", "available_soon"].includes(p.sourceAvailability) ? "The captured availability would stop me placing an immediate order." : "The faster option costs more, so I would only choose it when the date matters."}`, "First-time setup"],
  ];
}
export function attachDemoReviews(products: Product[]): Evidence[] {
  return products.map((p, index) => {
    const ratings = index % 5 === 0 ? [4, 4, 3, 3] : index % 3 === 0 ? [5, 4, 4, 4] : [5, 4, 4, 3];
    const entries = drafts(p).map(([title, body, usedFor], n) => ({ id: `DEMO-REVIEW-${p.id}-${n + 1}`, author: authors[(index + n) % authors.length], rating: ratings[n], title, body, usedFor,
      postedOn: `2026-10-${String(5 + ((index + n * 3) % 18)).padStart(2, "0")}`, verifiedPurchase: false as const }));
    const demoReviews: DemoReviews = { classification: "proxy", disclosure, rating: ratings.reduce((sum, n) => sum + n, 0) / ratings.length, ratingCount: entries.length, writtenReviewCount: entries.length, entries };
    p.demoReviews = demoReviews;
    p.provenance ??= { kind: "source_snapshot", notice: `Source facts captured ${p.checkedOn}; product photos are attributed separately. Offers and demo reviews are simulated.` };
    p.evidenceIds.push(`DEMO-REVIEWS-${p.id}`);
    return { ...emptyMetrics(), id: `DEMO-REVIEWS-${p.id}`, subjectType: "product", subjectId: p.id, sourceUrl: null, sourceType: "review", checkedOn: "2026-10-25", classification: "proxy",
      claim: `${disclosure} The ${entries.length} examples explore connection, fit, everyday use and buying trade-offs. Any sourced customer ratings are shown separately.` };
  });
}
