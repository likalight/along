import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductCanvas } from "@/components/canvas/ProductCanvas";
import { fixtureData } from "@/lib/canvas/fixtures";
import { createDemo } from "@/lib/canvas/demo-engine";
import type { Evidence, Offer, Product } from "@/lib/canvas/contracts";

const bag = fixtureData.products.find((product) => product.id === "BAG-001")!;
const product: Product = {
  ...bag,
  image: {
    url: "/catalog/images/products/BAG-001.png",
    alt: "AI-generated bag illustration",
    source: "AI-generated illustration · visual approximation",
    classification: "proxy",
  },
  demoReviews: {
    classification: "proxy",
    disclosure: "Fictional demo feedback; no real purchases.",
    rating: 4.5,
    ratingCount: 120,
    writtenReviewCount: 24,
    entries: [
      {
        id: "demo-review-1",
        author: "Alex T.",
        rating: 4,
        title: "Fits a weekday routine",
        body: "The demo bag keeps a laptop separate from gym clothes.",
        usedFor: "Work and gym",
        postedOn: "2026-10-24",
        verifiedPurchase: false,
      },
    ],
  },
};
const data = {
  products: [product],
  offers: [],
  evidence: [
    {
      id: "REV-BAG-001",
      subjectType: "product" as const,
      subjectId: product.id,
      sourceUrl: null,
      sourceType: "review",
      checkedOn: "2026-10-24",
      classification: "snapshot" as const,
      claim: "A captured source aggregate.",
      rating: 3.2,
      ratingCount: 25,
      writtenReviewCount: 20,
    },
    {
      id: "FICTIONAL-REVIEW-BAG-001",
      subjectType: "product" as const,
      subjectId: product.id,
      sourceUrl: null,
      sourceType: "review",
      checkedOn: "2026-10-24",
      classification: "proxy" as const,
      claim: "Invented reviewers love this bag.",
      rating: 4.5,
      ratingCount: 120,
    },
  ],
};

describe("catalogue review display", () => {
  it("hides authored seller fixtures while retaining sourced seller terms and the delivery estimate", () => {
    const sellerId = "seller-1";
    const evidence: Evidence[] = [
      { id: "proxy-seller", subjectType: "seller", subjectId: sellerId, sourceType: "fixture", classification: "proxy", sourceUrl: null, checkedOn: "2026-10-24", claim: "Authored fulfillment fixture only. No real seller reviews or stock are asserted." },
      { id: "authored-seller", subjectType: "seller", subjectId: sellerId, sourceType: "authored fixture", classification: "snapshot", sourceUrl: null, checkedOn: "2026-10-24", claim: "Authored MIC-067-A: MIC-067-DEMO, USD3289 itemcents. No live retail offer." },
      { id: "source-seller", subjectType: "seller", subjectId: sellerId, sourceType: "returns policy", classification: "snapshot", sourceUrl: "https://example.com/returns", checkedOn: "2026-10-24", claim: "Returns accepted within 14 days in original condition." },
    ];
    const offer: Offer = {
      id: "offer-1", productId: product.id, variantId: product.variantId, sellerId,
      currency: "USD", unitPriceMinor: 3289, shippingMinor: 0, otherFeesMinor: 0,
      requiredSetupMinor: 0, availability: "in_stock", destination: "Singapore",
      deliveryWindow: { latestOffsetDays: 4 }, returnTerms: "Return postage applies.",
      conditions: [], evidenceIds: evidence.map((entry) => entry.id), classification: "proxy",
    };
    const snapshot = { ...createDemo("bags"), view: "offers" as const, displayOrder: [product.id], focusedProductId: product.id };
    const markup = renderToStaticMarkup(createElement(ProductCanvas, {
      snapshot, data: { products: [product], offers: [offer], evidence }, onIntent: () => {}, onMediaEvent: () => {},
    }));
    expect(markup).not.toMatch(/Authored|fulfillment fixture|itemcents|No live retail offer|based on 24 Oct/);
    expect(markup).toContain("Returns accepted within 14 days in original condition.");
    expect(markup).toContain("Return postage applies.");
    expect(markup).toContain("28 Oct 2026");
    expect(markup).toContain("USD 32.89");
  });

  it("hides fictional review bodies and ratings while preserving genuine source ratings", () => {
    const snapshot = {
      ...createDemo("bags"),
      view: "evidence" as const,
      displayOrder: [product.id],
      focusedProductId: product.id,
      evidenceIds: ["REV-BAG-001", "FICTIONAL-REVIEW-BAG-001"],
    };
    const markup = renderToStaticMarkup(
      createElement(ProductCanvas, {
        snapshot,
        data,
        onIntent: () => {},
        onMediaEvent: () => {},
      }),
    );
    expect(markup).not.toContain("Demo reviews");
    expect(markup).not.toContain("Fictional demo feedback; no real purchases.");
    expect(markup).not.toContain("Fits a weekday routine");
    expect(markup).not.toContain("Alex T.");
    expect(markup).not.toContain("Invented reviewers love this bag.");
    expect(markup).not.toContain("4.5/5");
    expect(markup).not.toContain("4.5 / 5");
    expect(markup).toContain("Source review snapshot");
    expect(markup).toContain("3.2 / 5");
    expect(markup).toContain("AI-generated illustration");
    expect(markup).not.toContain("Verified purchase");
  });

  it("compares sourced ratings without presenting fictional aggregates as customer evidence", () => {
    const snapshot = {
      ...createDemo("bags"),
      view: "comparison" as const,
      displayOrder: [product.id],
      comparisonIds: [product.id],
      focusedProductId: product.id,
    };
    const markup = renderToStaticMarkup(
      createElement(ProductCanvas, {
        snapshot,
        data,
        onIntent: () => {},
        onMediaEvent: () => {},
      }),
    );
    expect(markup).not.toContain("Demo stars");
    expect(markup).not.toContain("4.5/5");
    expect(markup).toContain("Source stars");
    expect(markup).toContain("3.2/5 · 20 source reviews");
  });
});
