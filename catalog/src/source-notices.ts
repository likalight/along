import type { Evidence, Product } from "./types.ts";
import { emptyMetrics } from "./types.ts";

/** Later source notices supplement, rather than rewrite, the supplied dated snapshots. */
export function attachSourceNotices(products: Product[]): Evidence[] {
  const product = products.find(p => p.id === "MIC-095");
  if (!product) return [];
  const sourceUrl = "https://ca.ankerwork.com/pages/a3302-recall";
  const claim = "Anker reports a recall affecting some A3302 PowerConf S3 units manufactured in March–April 2023 because of a battery fire risk. Applicability requires the manufacturer's serial-number check. The demo has no unit serial number, so its simulated offers are withheld pending verification.";
  product.specs.sourceSafetyNotice = { classification: "snapshot", sourceUrl, checkedOn: "2026-10-25", claim };
  product.specs.demoPurchaseHold = true;
  product.limitations.push(claim);
  product.sourceUrls.push(sourceUrl);
  product.evidenceIds.push("NOTICE-MIC-095");
  return [{ ...emptyMetrics(), id: "NOTICE-MIC-095", subjectType: "product", subjectId: product.id,
    sourceType: "manufacturer", sourceUrl, checkedOn: "2026-10-25", classification: "snapshot", claim }];
}
