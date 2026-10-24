import { buildAudio } from "./microphones.ts";
import { nonTechProducts, nonTechEvidence } from "./nontech.ts";
import { buildOffers, scenarioNow, timezone, destination } from "./offers.ts";
import { buildKnownLinks, imageFixtures } from "./media.ts";
import { scenarios } from "./scenarios.ts";
import { validateCatalog } from "./validation.ts";
import type { Catalog } from "./types.ts";
export type * from "./types.ts";
export { microphoneArchive, activeAudioIds, importMicrophones, decimalToMinor } from "./microphones.ts";
export { resolveKnownLink } from "./media.ts";
export { validateCatalog, quoteOffer, eligibleOffers } from "./validation.ts";
export { resolveDelivery } from "./offers.ts";

/** Fresh data per session/reset; callers cannot mutate later sessions' fixtures. */
export function getCatalog(): Catalog {
  const audio = buildAudio();
  const products = [...audio.products, ...nonTechProducts];
  const commerce = buildOffers(products);
  const data: Catalog = structuredClone({
    version: "1.0.0", currency: "USD", checkedOn: "2026-10-24", scenarioNow, timezone, destination,
    products, sellers: commerce.sellers, offers: commerce.offers,
    evidence: [...audio.evidence, ...nonTechEvidence, ...commerce.evidence],
    scenarios, knownLinks: buildKnownLinks(products), imageFixtures,
  });
  validateCatalog(data);
  return data;
}
