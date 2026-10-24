import { mkdirSync, writeFileSync } from "node:fs";
import { getCatalog, microphoneArchive, eligibleOffers } from "../src/index.ts";
const catalog = getCatalog();
for (const scenario of catalog.scenarios) {
  const constraints = { ...scenario.constraints };
  for (const change of scenario.changes) {
    Object.assign(constraints, change.constraints);
    const actual = eligibleOffers(catalog, constraints).map(q => q.offerId).sort();
    if (JSON.stringify(actual) !== JSON.stringify([...change.expectedOfferIds].sort()))
      throw new Error(`Scenario mismatch: ${scenario.id}: ${change.utterance}: ${actual}`);
  }
}
const directory = new URL("../data/", import.meta.url);
mkdirSync(directory, {recursive: true});
writeFileSync(new URL("catalog.json", directory), JSON.stringify(catalog, null, 2) + "\n");
writeFileSync(new URL("microphones-archive.json", directory), JSON.stringify(microphoneArchive, null, 2) + "\n");
console.log(`Validated ${catalog.products.length} products, ${catalog.offers.length} proxy offers, ${catalog.evidence.length} evidence records, 3 scenarios; archived 50 source rows.`);
