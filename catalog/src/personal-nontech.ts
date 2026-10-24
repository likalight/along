import { readFileSync } from "node:fs";
import type { Evidence, Product } from "./types.ts";

/** Approved dated research, reconciled by manufacturer identity rather than overlapping IDs. */
type Addition = { sourceId: string; product: Product; evidence: Evidence[]; offerPrices: [number, number] };
export const personalNonTechSource = JSON.parse(readFileSync(new URL("../sources/personal-nontech-additions.json", import.meta.url), "utf8")) as {
  sourceDocument: string; sourceSha256: string; checkedOn: string; selectionPolicy: string; records: Addition[];
};
export const personalNonTechProducts = personalNonTechSource.records.map(row => row.product);
export const personalNonTechEvidence = personalNonTechSource.records.flatMap(row => row.evidence);
export const personalNonTechPrices = Object.fromEntries(personalNonTechSource.records.map(row => [row.product.id, row.offerPrices]));
export const personalIllustrations = new Map(personalNonTechProducts.map(product => [product.id, product.image.url]));
