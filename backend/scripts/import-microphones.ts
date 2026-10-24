/** Convert the team's supplied Markdown research to reference JSON, never purchasable offers. */
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const sourcePath = process.argv[2];
if (!sourcePath)
  throw new Error(
    "Usage: node --experimental-strip-types scripts/import-microphones.ts /path/to/microphone-demo-data.md",
  );
const source = await readFile(sourcePath, "utf8");
const tables: Record<string, string>[][] = [];
const lines = source.split(/\r?\n/);
const cells = (line: string) =>
  line
    .split("|")
    .slice(1, -1)
    .map((s) => s.trim());
for (let i = 0; i < lines.length; i++)
  if (lines[i].startsWith("| id |")) {
    const header = cells(lines[i]);
    const rows: Record<string, string>[] = [];
    i += 2;
    while (i < lines.length && lines[i].startsWith("| MIC-")) {
      const values = cells(lines[i]);
      if (values.length !== header.length)
        throw new Error(`Unexpected cell count at line ${i + 1}`);
      rows.push(Object.fromEntries(header.map((key, k) => [key, values[k]])));
      i++;
    }
    if (rows.length !== 50 || new Set(rows.map((r) => r.id)).size !== 50)
      throw new Error("Expected 50 unique IDs in each source table");
    tables.push(rows);
  }
if (tables.length !== 3)
  throw new Error("Expected exactly three source tables");
const notes = new Map(
  Array.from(source.matchAll(/^- \*\*(MIC-\d{3})[^\n]+?\*\* (.+)$/gm), (m) => [
    m[1],
    m[2],
  ]),
);
const maybeNumber = (s: string) => (s === "null" ? null : Number(s));
const extractUrl = (s: string) =>
  s === "null" ? null : (s.match(/\]\((https:\/\/[^)]+)\)/)?.[1] ?? null);
const records = tables[0].map((commercial) => {
  const technical = tables[1].find((r) => r.id === commercial.id)!;
  const reviews = tables[2].find((r) => r.id === commercial.id)!;
  if (!technical || !reviews) throw new Error("Missing joined product row");
  const amount = Number(commercial.reference_price_usd);
  if (!Number.isFinite(amount) || amount < 0)
    throw new Error("Invalid reference amount");
  return {
    id: commercial.id,
    brand: commercial.brand,
    name: commercial["model / exact configuration"],
    category: commercial.category,
    referencePrice: {
      currency: "USD",
      amountMinor: Math.round(amount * 100),
      kind: commercial.price_kind,
      payableTotalMinor: null,
      shippingMinor: null,
      taxMinor: null,
      extraHardwareIncluded: false,
    },
    availability: commercial.availability,
    sellerOrSource: commercial["seller / source"],
    productSource: extractUrl(commercial.product_source),
    technical: Object.fromEntries(
      Object.entries(technical).filter(
        ([key]) =>
          ![
            "id",
            "demo_cafe_fit",
            "demo_office_fit",
            "authored_assessment",
          ].includes(key),
      ),
    ),
    authoredFit: {
      classification: "proxy",
      cafe: maybeNumber(technical.demo_cafe_fit),
      office: maybeNumber(technical.demo_office_fit),
      assessment: technical.authored_assessment,
      measuredDictationBenchmark: false,
    },
    customerReviews: {
      value: maybeNumber(reviews.customer_rating_out_of_5),
      count: maybeNumber(reviews.customer_review_count),
      scope: reviews.review_scope,
      feedback: reviews.inspected_customer_feedback,
      source: extractUrl(reviews.review_source),
    },
    variantNotes: notes.get(commercial.id) ?? null,
    checkedOn: "2026-10-24",
    selectable: false,
  };
});
const result = {
  kind: "reference-research-not-purchase-catalog",
  source: "Team-supplied microphone-demo-data.md",
  sourceSha256: createHash("sha256").update(source).digest("hex"),
  independentlyReverifiedByBackend: false,
  notice:
    "USD research/reference amounts exclude shipping, tax, imports and required extra hardware. These records are not eligible purchase offers. Customer ratings and authored fit hypotheses are distinct. No SGD conversion is implied.",
  records,
};
await writeFile(
  new URL("../data/microphones-reference.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  `Imported ${records.length} joined reference records; preserved USD, nulls, source URLs, variant notes and authored-vs-customer distinction. No purchase offers created.`,
);
