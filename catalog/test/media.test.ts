import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildKnownLinks, imageFixtures, resolveKnownLink } from "../src/media.ts";
import type { Product } from "../src/types.ts";

const links = [
  { url: "https://shop.example/products/tote?color=navy&size=one", productId: "BAG-001" },
  { url: "https://shop.example/products/sheet", productId: "BED-001" },
];
test("known links match identity, ignore fragment/tracking, preserve variant", () => {
  assert.deepEqual(resolveKnownLink("https://shop.example/products/tote?size=one&color=navy&utm_source=demo#details", links), { status: "matched", productId: "BAG-001" });
  assert.deepEqual(resolveKnownLink("https://shop.example/products/tote?color=red&size=one", links), { status: "unsupported" });
  assert.deepEqual(resolveKnownLink("https://shop.example/products/tote", links), { status: "unsupported" });
  assert.deepEqual(resolveKnownLink("https://shop.example/products/sheet?coupon=offer", links), { status: "unsupported" });
});
test("unknown and hostile references never resolve or execute", () => {
  const unsupported = [
    "javascript:alert(1)", "http://shop.example/products/sheet", "https://evil.example/products/sheet",
    "https://shop.example.evil.test/products/sheet", "https://shop.example@evil.test/products/sheet",
    "https://user:secret@shop.example/products/sheet", "https://shop.example:444/products/sheet",
    "https://shop.example./products/sheet", "https://shop.example/fake/../products/sheet",
    "https://shop.example/%2e%2e/products/sheet", "https://shop.example%2fevil.test/products/sheet",
    "https://shop.example/products/sheet\n?x=1", "Find me a blue bag", "/products/sheet",
    "https://shop.example/products/tote?color=navy&color=red&size=one",
    "https://shop.example/products/tote?color=navy&color=navy&size=one",
  ];
  for (const url of unsupported) assert.deepEqual(resolveKnownLink(url, links), { status: "unsupported" }, url);
});
test("first source only, no review URL admission, and no ambiguous product mappings", () => {
  const products = [{ id: "P1", sourceUrls: ["https://shop.example/products/sheet", "https://reviews.example/one"] }] as Product[];
  assert.deepEqual(buildKnownLinks(products), [{ url: "https://shop.example/products/sheet", productId: "P1" }]);
  assert.deepEqual(resolveKnownLink("https://reviews.example/one", buildKnownLinks(products)), { status: "unsupported" });
  assert.deepEqual(buildKnownLinks([...products, { id: "P2", sourceUrls: products[0].sourceUrls } as Product]), []);
  assert.deepEqual(resolveKnownLink("https://shop.example/products/sheet", [...links, { url: "https://shop.example/products/sheet", productId: "OTHER" }]), { status: "unsupported" });
});
test("prepared images exist, disclose proxy origin, and contain no remote resources", () => {
  assert.equal(new Set(imageFixtures.map((fixture) => fixture.id)).size, imageFixtures.length);
  for (const fixture of imageFixtures) {
    assert.equal(fixture.image.classification, "proxy");
    assert.ok(fixture.productIds.length);
    assert.ok(fixture.correctionExample);
    const file = new URL(`../public${fixture.image.url}`, import.meta.url);
    const svg = readFileSync(file, "utf8");
    assert.match(svg, /DEMO ILLUSTRATION/);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject|(?:href|src)=["']https?:/i);
  }
});
