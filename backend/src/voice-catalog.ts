import { readFileSync } from "node:fs";
import type { CatalogProfile, Product, Offer, Evidence } from "./contracts.ts";
import { validateCatalog } from "./catalog.ts";
const reference = JSON.parse(
  readFileSync(
    new URL("../data/microphones-reference.json", import.meta.url),
    "utf8",
  ),
);
const products: Product[] = [],
  offers: Offer[] = [],
  evidence: Evidence[] = [];
function addDemoOffers(p: Product, basePrice: number) {
  for (const [id, name, premium, days] of [
    ["economy", "Demo Economy Seller", 0, 4],
    ["express", "Demo Express Seller", 1500, 1],
  ] as const) {
    offers.push({
      id: `${p.id}-${id}`,
      productId: p.id,
      sellerId: id,
      sellerName: name,
      currency: "USD",
      unitPrice: basePrice + premium,
      shipping: 500,
      otherFees: 0,
      available: true,
      stock: 8,
      deliveryDays: days,
      deliveryConditions: `Synthetic demo estimate: ${days} calendar day(s) after approval to the stated demo destination. No shipment.`,
      returnConditions:
        "Synthetic policy: unused within 14 days; return postage paid by shopper.",
      conditions: [
        "All prices, stock, tax, shipping and fulfillment in this offer are synthetic demo fixtures.",
        "No merchant order, tax assessment or payment will occur.",
      ],
      uncertainties: [
        "Real destination availability, shipping and tax have not been checked.",
      ],
      evidenceIds: [`ev-demo-seller-${id}`],
      classification: "proxy",
    });
  }
}
for (const id of [
  "MIC-001",
  "MIC-003",
  "MIC-007",
  "MIC-016",
  "MIC-017",
  "MIC-019",
  "MIC-020",
  "MIC-022",
  "MIC-028",
  "MIC-035",
  "MIC-040",
  "MIC-044",
]) {
  const r = reference.records.find((x: any) => x.id === id);
  const specId = `ev-${id}-spec`,
    reviewId = `ev-${id}-reviews`,
    fitId = `ev-${id}-authored-fit`;
  const p: Product = {
    id,
    category: "audio-accessories",
    brand: r.brand,
    name: `${r.brand} ${r.name}`,
    variant: r.name,
    description: r.category,
    specifications: {
      ...r.technical,
      sourceAvailability: r.availability,
      referencePriceUSD: r.referencePrice.amountMinor / 100,
      referencePriceKind: r.referencePrice.kind,
    },
    strengths: [r.authoredFit.assessment],
    limitations: [
      "Dictation improvements are unmeasured hypotheses; placement, compatibility and surroundings matter.",
      r.technical.additional_hardware,
    ],
    evidenceIds: [specId, fitId],
    media: [
      {
        url: "/reference/microphone-style.svg",
        alt: "Generic microphone category illustration, not a photograph of this model",
        classification: "proxy",
      },
    ],
    buyerSignals: {
      averageRating: r.customerReviews.value,
      ratingCount: r.customerReviews.count,
      writtenReviewCount:
        r.customerReviews.scope === "Rendered customer reviews"
          ? r.customerReviews.count
          : null,
      purchaseCount: null,
      purchasePeriod: null,
      reviewSummary:
        r.customerReviews.feedback === "Not captured."
          ? null
          : r.customerReviews.feedback,
    },
    videos: [],
  };
  evidence.push({
    id: specId,
    subjectType: "product",
    subjectId: id,
    source:
      "Team-supplied manufacturer/merchant research; not independently reverified by backend",
    sourceUrl: r.productSource,
    sourceType: "merchant",
    classification: "snapshot",
    capturedAt: r.checkedOn,
    claim: JSON.stringify({
      technical: r.technical,
      variantNotes: r.variantNotes,
      referencePrice: r.referencePrice,
    }),
    rating: null,
  });
  evidence.push({
    id: fitId,
    subjectType: "product",
    subjectId: id,
    source:
      "Authored demo suitability hypothesis, not measured dictation performance",
    sourceType: "fixture",
    classification: "proxy",
    capturedAt: r.checkedOn,
    claim: r.authoredFit.assessment,
    rating: null,
  });
  if (r.customerReviews.source) {
    p.evidenceIds.push(reviewId);
    evidence.push({
      id: reviewId,
      subjectType: "product",
      subjectId: id,
      source: r.customerReviews.scope,
      sourceUrl: r.customerReviews.source,
      sourceType: "review",
      classification: "snapshot",
      capturedAt: r.checkedOn,
      claim: r.customerReviews.feedback,
      rating: {
        value: r.customerReviews.value,
        count: r.customerReviews.count,
      },
    });
  }
  products.push(p);
  addDemoOffers(p, r.referencePrice.amountMinor);
}
const lamps = [
  ["LAMP-001", "Cloud Dome", "blue", "rounded dome", 32, 700, 9900],
  ["LAMP-002", "Pebble Table", "ivory", "soft oval", 28, 550, 8900],
  ["LAMP-003", "Arc Sculptural", "terracotta", "curved arch", 40, 800, 11900],
  ["LAMP-004", "Mushroom Mini", "blue", "rounded mushroom", 24, 400, 6900],
  ["LAMP-005", "Orb Accent", "sage", "sphere", 30, 500, 10900],
  ["LAMP-006", "Folded Shade", "white", "angular folded", 38, 900, 12900],
] as const;
for (const [id, name, color, shape, height, lumens, price] of lamps) {
  const evId = `ev-${id}-spec`;
  const p: Product = {
    id,
    category: "home-lighting",
    brand: "Demo Atelier",
    name,
    variant: `${color} / standard`,
    description:
      "Synthetic sculptural table lamp for the guided-narrowing demo",
    specifications: {
      color,
      shape,
      heightCm: height,
      lightOutputLumens: lumens,
      power: "USB-C demo fixture",
      dimmable: true,
      designerAttribution: null,
    },
    strengths: [
      `${shape} silhouette; ${lumens} lm stated in synthetic specification`,
    ],
    limitations: [
      "Illustrated finish and dimensions are synthetic; no real product quality or designer attribution is established.",
    ],
    evidenceIds: [evId],
    media: [
      {
        url: `/reference/lamp-${color}.svg`,
        alt: `Synthetic ${color} lamp illustration; not a real product photograph`,
        classification: "proxy",
      },
    ],
    buyerSignals: {
      averageRating: null,
      ratingCount: null,
      writtenReviewCount: null,
      purchaseCount: null,
      purchasePeriod: null,
      reviewSummary: null,
    },
    videos: [],
  };
  products.push(p);
  evidence.push({
    id: evId,
    subjectType: "product",
    subjectId: id,
    source: "Authored lighting demonstration fixture",
    sourceType: "fixture",
    classification: "proxy",
    capturedAt: null,
    claim: JSON.stringify(p.specifications),
    rating: null,
  });
  addDemoOffers(p, price);
}
for (const id of ["economy", "express"])
  evidence.push({
    id: `ev-demo-seller-${id}`,
    subjectType: "seller",
    subjectId: id,
    source: "Synthetic seller fulfillment fixture",
    sourceType: "fixture",
    classification: "proxy",
    capturedAt: null,
    claim:
      "Demonstration prices and delivery timing only. No real seller performance rating is available.",
    rating: null,
  });
// Keep an incomplete offer to demonstrate transparent blocked checkout.
offers.find((o) => o.id === "LAMP-006-economy")!.otherFees = null;
export const voiceProfile: CatalogProfile = {
  catalog: {
    version: "2",
    currency: "USD",
    notice:
      "Lighting products and all checkout offers are synthetic demo fixtures. Audio identity/specifications/reviews come from team-supplied research snapshots; reference USD prices are not real payable offers. No currency conversion or live inventory claim is made.",
    products,
    offers,
    evidence,
  },
  destination: "Demo destination, Singapore",
  scenarios: [
    {
      id: "inspired-lighting",
      title: "Find this sculptural look",
      openingRequest:
        "I love this lamp. Can you find something similar under 150 dollars?",
      constraints: {
        category: "home-lighting",
        currency: "USD",
        budgetMinor: 15000,
      },
      anchorProductId: "LAMP-001",
      plannedChange:
        "Prefer softer shape, then ask for delivery by a stated deadline.",
      expectedOutcome:
        "Two close matches and three discoveries narrow to three ranked alternatives. Preserve budget and explain the cheaper-late versus eligible-express offer.",
    },
    {
      id: "cafe-dictation",
      title: "Clearer dictation in noisy cafés",
      openingRequest:
        "I dictate into my computer, but cafés are too noisy. I want something discreet and easy to carry.",
      constraints: { category: "audio-accessories", currency: "USD" },
      anchorProductId: "MIC-019",
      plannedChange:
        "Choose lowest-cost suitable, then require arrival tomorrow under USD 120 total.",
      expectedOutcome:
        "Clarify setup and category, compare priorities, then rank three suitable products with supported evidence. MIC-019 economy is late; express is USD 119.99. Never claim measured dictation improvements.",
    },
  ],
  preparedImages: [
    {
      id: "sculptural-blue-lamp",
      url: "/reference/lamp-blue.svg",
      classification: "proxy",
      description:
        "Prepared synthetic blue dome lamp inspiration. Shape and color are visible; designer, dimensions and material cannot be inferred.",
      correctionExample:
        "I like the rounded shape, not necessarily the blue color.",
    },
  ],
};
validateCatalog(voiceProfile.catalog);
