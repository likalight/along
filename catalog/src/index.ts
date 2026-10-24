import { buildAudio } from "./microphones.ts";
import { seededNonTechProducts, seededNonTechEvidence } from "./seeded-nontech.ts";
import { personalNonTechProducts, personalNonTechEvidence } from "./personal-nontech.ts";
import { attachDemoReviews } from "./demo-reviews.ts";
import { attachSourcePhotos } from "./source-photos.ts";
import { attachSourceNotices } from "./source-notices.ts";
import { nonTechProducts, nonTechEvidence } from "./nontech.ts";
import { buildOffers, scenarioNow, timezone, destination } from "./offers.ts";
import { buildKnownLinks, imageFixtures } from "./media.ts";
import { scenarios } from "./scenarios.ts";
import { validateCatalog } from "./validation.ts";
import type { Catalog } from "./types.ts";
export type * from "./types.ts";
export { microphoneArchive, legacyMicrophoneArchive, activeAudioIds, legacyAudioIds, importMicrophones, importMicrophoneIndex, decimalToMinor } from "./microphones.ts";
export { resolveKnownLink } from "./media.ts";
export { validateCatalog, quoteOffer, eligibleOffers } from "./validation.ts";
export { resolveDelivery } from "./offers.ts";

/** Fresh data per session/reset; callers cannot mutate later sessions' fixtures. */
export function getCatalog(): Catalog {
  const audio = buildAudio();
  // Append additions so existing IDs and index-based demo-review fixtures remain stable.
  const products = structuredClone([...audio.products, ...nonTechProducts, ...seededNonTechProducts, ...personalNonTechProducts]);
  const demoReviewEvidence = attachDemoReviews(products);
  const photoEvidence = attachSourcePhotos(products);
  const noticeEvidence = attachSourceNotices(products);
  const commerce = buildOffers(products);
  const data: Catalog = structuredClone({
    version: "2.0.0", currency: "USD", checkedOn: "2026-10-25", scenarioNow, timezone, destination,
    products, sellers: commerce.sellers, offers: commerce.offers,
    evidence: [...audio.evidence, ...nonTechEvidence, ...seededNonTechEvidence, ...personalNonTechEvidence, ...demoReviewEvidence, ...photoEvidence, ...noticeEvidence, ...commerce.evidence],
    scenarios, knownLinks: buildKnownLinks(products), imageFixtures,
  });
  validateCatalog(data);
  return data;
}
