import { existsSync, readFileSync } from "node:fs";
import type { Evidence, Product } from "./types.ts";
import { emptyMetrics } from "./types.ts";
import { personalIllustrations } from "./personal-nontech.ts";
type SourcePhoto = { sourceUrl: string; imageUrl: string; alt: string; source: string; checkedOn: string };

export function attachSourcePhotos(products: Product[]): Evidence[] {
  const photos: Record<string, SourcePhoto> = {};
  // Static URLs let the application bundler trace each distinct manifest correctly.
  for (const path of [
    new URL("../sources/audio-001-050-images.json", import.meta.url),
    new URL("../sources/audio-051-100-images.json", import.meta.url),
    new URL("../sources/nontech-original-images.json", import.meta.url),
    new URL("../sources/nontech-product-images.json", import.meta.url),
  ]) {
    if (existsSync(path)) Object.assign(photos, JSON.parse(readFileSync(path, "utf8")));
  }
  const evidence: Evidence[] = [];
  for (const product of products) {
    const photo = photos[product.id];
    // Only the explicitly imported additions may retain their disclosed generic illustration.
    // Missing photographs for the existing catalog still fail instead of silently degrading.
    if (!photo && personalIllustrations.get(product.id) === product.image.url &&
      product.image.classification === "proxy" && /illustration/i.test(product.image.source) &&
      !product.image.originalUrl && !product.image.sourceUrl) continue;
    if (!photo) throw new Error(`MISSING_SOURCE_PHOTO:${product.id}`);
    const representative = product.provenance?.kind === "synthetic";
    product.image = { url: `/catalog/images/products/${product.id}.webp`, alt: photo.alt,
      source: representative ? "Representative source photograph for a simulated product; not an exact retail SKU" : photo.source,
      classification: representative ? "proxy" : "snapshot", sourceUrl: photo.sourceUrl,
      originalUrl: photo.imageUrl, checkedOn: photo.checkedOn };
    const id = `PHOTO-${product.id}`;
    if (!representative && !product.sourceUrls.includes(photo.sourceUrl)) product.sourceUrls.push(photo.sourceUrl);
    product.evidenceIds.push(id);
    evidence.push({ ...emptyMetrics(), id, subjectType: "product", subjectId: product.id,
      sourceUrl: representative ? null : photo.sourceUrl, sourceType: "merchant", checkedOn: photo.checkedOn,
      classification: representative ? "proxy" : "snapshot", claim: representative
        ? "The photograph illustrates this demo product's general style. It does not identify a real product with these simulated specifications."
        : "Product photograph retrieved from the linked listing. The pictured color, accessories or kit may differ; compare the selected configuration before choosing." });
  }
  return evidence;
}
