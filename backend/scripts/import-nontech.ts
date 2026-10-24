/** Import the team's joined tables; unknowns stay null and source facts remain separate from offers. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const path = process.argv[2];
if (!path) throw new Error("Pass combined-shopping-demo-data.md");
const text = readFileSync(path, "utf8");
const sections = [
  "Product and commercial data",
  "Bag specifications and authored suitability",
  "Bedding specifications and fit",
  "Customer review data",
  "Synthetic seller offers — 24 rows",
];
const rows = (section: string) => {
  const start = text.lastIndexOf("## " + section);
  if (start < 0) throw new Error("Missing " + section);
  return text
    .slice(start)
    .split(/\n## /)[0]
    .split("\n")
    .filter((l) => /^\| (BAG|BED)-/.test(l))
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((x) => x.trim()),
    );
};
const cents = (x: string) => {
  if (!/^\d+\.\d{2}$/.test(x)) throw new Error("Invalid decimal");
  const [a, b] = x.split(".");
  return Number(a) * 100 + Number(b);
};
const [commercial, bags, beds, reviews, offers] = sections.map(rows);
const products = commercial.map((r) => ({
  id: r[0],
  brand: r[1],
  model: r[2],
  category: r[0].startsWith("BAG") ? "bags" : "bedding",
  description: r[3],
  referencePrice: { amountMinor: cents(r[4]), currency: "USD", kind: r[5] },
  realAvailability: r[6],
  sourceUrl: r[7].match(/\]\((.*)\)/)?.[1],
  specificationRow: (r[0].startsWith("BAG") ? bags : beds)
    .find((s) => s[0] === r[0])
    ?.slice(1),
  reviewRow: reviews.find((s) => s[0] === r[0])?.slice(1),
}));
if (
  products.length !== 12 ||
  offers.length !== 24 ||
  products.some((p) => !p.sourceUrl || !p.specificationRow || !p.reviewRow)
)
  throw new Error("Incomplete joins");
const result = {
  sourceFile: "combined-shopping-demo-data.md",
  sha256: createHash("sha256").update(text).digest("hex"),
  checkedOn: "2026-10-24",
  independentlyReverifiedByBackend: false,
  products,
  offers: offers.map((r) => {
    const item = cents(r[3]),
      shipping = cents(r[4]);
    if (item + shipping !== cents(r[5]))
      throw new Error("Invalid source total");
    return {
      id: r[0],
      productId: r[1],
      sellerId: r[2],
      unitPrice: item,
      shipping,
      total: cents(r[5]),
      deliveryDays: Number(r[6]),
    };
  }),
};
writeFileSync(
  new URL("../data/nontech-reference.json", import.meta.url),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  "Imported 12 source records and 24 synthetic offers with exact cents.",
);
