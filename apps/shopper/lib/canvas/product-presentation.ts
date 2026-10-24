import type { Evidence, Product } from "./contracts";
import { consumerDetails } from "./consumer-details";

/** The supplied subtype covers model names that do not literally say "headset". */
export function audioSolution(
  category: string,
  title: string,
  specs: Record<string, unknown>,
): Product["solution"] {
  if (category !== "audio-accessories") return undefined;
  const group = String(specs.representationGroup ?? specs.solutionType ?? "");
  if (/headphones|earbuds|headset/i.test(group)) return "headset";
  if (/lavalier|wearable|clip/i.test(group)) return "clip";
  if (/headset|earpods|airpods/i.test(title)) return "headset";
  if (/lavalier|clip|lav\b/i.test(title)) return "clip";
  return "desktop";
}

export function reviewEvidence(
  product: Product,
  evidence: Evidence[],
): Evidence | undefined {
  return evidence.find(
    (entry) =>
      entry.subjectType === "product" &&
      entry.subjectId === product.id &&
      (entry.sourceType === "review" ||
        entry.sourceType === "Customer review snapshot") &&
      entry.classification !== "proxy",
  );
}

export function productSummary(product: Product): string {
  return (
    product.specs["Why it may help"] ??
    consumerDetails(product.specs)
      .slice(0, 3)
      .map(({ label, value }) => `${label}: ${value}`)
      .join(" · ")
  );
}
