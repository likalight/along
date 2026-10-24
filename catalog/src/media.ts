import type { ImageFixture, Product } from "./types.ts";

export type KnownLink = { url: string; productId: string };
export type LinkResolution =
  | { status: "matched"; productId: string }
  | { status: "unsupported" };

const trackingKeys = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid",
]);

/**
 * Local comparison only: never fetch a supplied URL.
 * Ignore fragment and the listed tracking parameters; preserve every other
 * parameter (including product variants). Ambiguous duplicate keys are rejected.
 */
function canonicalLink(input: string): string | null {
  if (typeof input !== "string" || input.length > 2048) return null;
  const candidate = input.trim();
  if (
    !candidate.startsWith("https://") ||
    /[\s\\\u0000-\u001f\u007f]/u.test(candidate) ||
    /%(?:00|0[ad]|2e|2f|5c)/iu.test(candidate.split(/[?#]/u)[0]) ||
    /\/(?:\.|\.\.)(?:\/|[?#]|$)/u.test(candidate)
  ) return null;
  let url: URL;
  try { url = new URL(candidate); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  // Reject host aliases such as a trailing DNS dot; only the cited host matches.
  if (url.hostname.endsWith(".")) return null;
  url.hash = "";
  const seen = new Set<string>();
  for (const key of Array.from(url.searchParams.keys())) {
    if (trackingKeys.has(key)) {
      url.searchParams.delete(key);
      continue;
    }
    if (seen.has(key)) return null;
    seen.add(key);
  }
  url.searchParams.sort();
  return url.href;
}

/** Only the first, product-identity source URL becomes a supported link. */
export function buildKnownLinks(products: Product[]): KnownLink[] {
  const result = new Map<string, string>();
  for (const product of products) {
    const source = product.sourceUrls[0];
    if (!source) continue;
    const canonical = canonicalLink(source);
    if (!canonical) throw new Error(`Unsafe product source URL: ${product.id}`);
    const previous = result.get(canonical);
    if (previous && previous !== product.id) throw new Error("Ambiguous catalog link");
    result.set(canonical, product.id);
  }
  return Array.from(result, ([url, productId]) => ({ url, productId }));
}

export function resolveKnownLink(input: string, links: KnownLink[]): LinkResolution {
  const canonical = canonicalLink(input);
  if (!canonical) return { status: "unsupported" };
  const matches = links.filter((link) => canonicalLink(link.url) === canonical);
  const productIds = new Set(matches.map((link) => link.productId));
  if (productIds.size !== 1) return { status: "unsupported" };
  return { status: "matched", productId: matches[0].productId };
}

export const imageFixtures: ImageFixture[] = [
  {
    id: "IMG-BAG-INSPIRATION",
    image: {
      url: "/catalog/images/bag.svg",
      alt: "Authored blue tote illustration; not a photograph of any catalog product",
      source: "Original project-owned SVG illustration, 2026-10-24",
      classification: "proxy",
    },
    productIds: ["BAG-001", "BAG-002", "BAG-003", "BAG-004", "BAG-005", "BAG-006"],
    description: "Shape/color inspiration only. Associations are curated candidate IDs, not image recognition results or evidence of size, material, laptop fit, or stock.",
    correctionExample: "I meant the tote shape, not the blue color. I need a separate shoe compartment.",
  },
  {
    id: "IMG-BED-INSPIRATION",
    image: {
      url: "/catalog/images/bedding.svg",
      alt: "Authored neutral bedding illustration; no actual material or mattress measurements shown",
      source: "Original project-owned SVG illustration, 2026-10-24",
      classification: "proxy",
    },
    productIds: ["BED-001", "BED-002", "BED-003", "BED-004", "BED-005", "BED-006"],
    description: "Prepared bedding inspiration. Clarify dimensions, depth, composition and included pieces; none can be inferred from this illustration.",
    correctionExample: "The mattress is twelve inches deep. I want plain white, not a particular fabric inferred from the picture.",
  },
  {
    id: "IMG-AUDIO-REFERENCE",
    image: {
      url: "/catalog/images/audio.svg",
      alt: "Authored generic desktop microphone illustration; not a model photograph or measured recording setup",
      source: "Original project-owned SVG illustration, 2026-10-24",
      classification: "proxy",
    },
    productIds: ["MIC-015", "MIC-020", "MIC-022"],
    description: "Generic desktop solution illustration only; does not establish model identity, compatibility or dictation performance.",
    correctionExample: "I prefer something wearable; I do not want a desktop microphone.",
  },
];
