import type { Product } from "./contracts";

/** Category fallbacks exist for every product, including newly seeded rows. */
export const productImageFallback = (id: string) =>
  `/catalog/images/${id.startsWith("BAG-") ? "bag" : id.startsWith("BED-") ? "bedding" : "audio"}.svg`;

export function productImage(
  id: string,
  model: string,
  canonical?: Product["image"],
): Product["image"] {
  if (canonical?.url) return canonical;
  return {
    url: `/catalog/images/products/${id}.webp`,
    alt: `${model}: AI-generated product illustration; visual approximation`,
    source: "AI-generated illustration · visual approximation",
    classification: "proxy",
  };
}
