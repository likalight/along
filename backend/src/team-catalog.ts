/** Current agreed three-category fixture, issue #2. Source snapshots are not executable offers. */
import { readFileSync } from "node:fs";
import { buildVoiceProfile } from "./voice-catalog.ts";
import { validateCatalog } from "./catalog.ts";
import type { CatalogProfile, Product, Evidence, Offer } from "./contracts.ts";
const data = JSON.parse(
  readFileSync(
    new URL("../data/nontech-reference.json", import.meta.url),
    "utf8",
  ),
);
export const teamProfile: CatalogProfile = buildVoiceProfile(
  [
    "MIC-001",
    "MIC-003",
    "MIC-009",
    "MIC-015",
    "MIC-020",
    "MIC-022",
    "MIC-025",
    "MIC-037",
    "MIC-038",
    "MIC-040",
    "MIC-044",
    "MIC-047",
  ],
  false,
);
const { products, offers, evidence } = teamProfile.catalog;
const clock = "2026-10-24T10:00:00+08:00";
const arrival = (days: number) =>
  `2026-10-${String(24 + days).padStart(2, "0")}T18:00:00+08:00`;
teamProfile.catalog.version = "3";
teamProfile.catalog.notice =
  "24 active products in USD. Product facts are team-supplied snapshots, not independently reverified here. All seller offers, stock, taxes, delivery and destination are explicitly synthetic. Missing source facts remain unknown. No real purchase, currency conversion or Singapore availability claim.";
teamProfile.destination = "DEMO-DESTINATION";
teamProfile.clock = { now: clock, timeZone: "Asia/Singapore" };
for (const p of products) {
  const connection = String(p.specifications.connection);
  p.compatibility = {
    kind: "audio",
    hostConnections: connection.includes("USB-C")
      ? ["USB-C"]
      : connection.includes("USB-A")
        ? ["USB-A"]
        : connection.includes("TRS")
          ? ["TRS-mic"]
          : [],
    requiresKnownHost: true,
  };
  p.referencePrice = {
    amountMinor: Math.round(Number(p.specifications.referencePriceUSD) * 100),
    currency: "USD",
    kind: String(p.specifications.referencePriceKind),
  };
  p.variantId = p.id + "-DEMO";
}
for (const o of offers) {
  const p = products.find((p) => p.id === o.productId)!;
  if (
    ["unavailable", "out_of_stock", "discontinued"].includes(
      String(p.specifications.sourceAvailability),
    )
  ) {
    o.available = false;
    o.stock = 0;
  }
  o.variantId = p.variantId;
  o.destination = teamProfile.destination;
  o.deliveryWindow = {
    latestOffsetDays: o.deliveryDays!,
    latestAt: arrival(o.deliveryDays!),
    scenarioNow: clock,
    timeZone: "Asia/Singapore",
  };
  o.deliveryConditions = `Synthetic arrival ${o.deliveryWindow.latestAt}; fixed scenario clock ${clock}, order before 12:00 SGT. No shipment.`;
  // Source package requirements are surfaced; only explicitly complete USB packages get a zero setup fixture.
  const complete = [
    "MIC-001",
    "MIC-003",
    "MIC-009",
    "MIC-015",
    "MIC-020",
    "MIC-022",
  ].includes(p.id);
  o.setupCost = complete ? 0 : null;
  o.setupConditions = complete
    ? "Synthetic package includes cables/stand stated in source; direct compatible host required. No adapter or interface assumed."
    : "Required mount, cable, interface or adapter cost is unverified. Resolve setup before checkout.";
}
const capacity = [26, 20, 12, 30, 26, 20],
  weights = [0.722, 0.534, null, 0.55, 0.84, 0.61],
  laptop = [16, 14, 14, null, null, 14],
  depth = [10, 15, 14.625, 10, 16, null];
for (const r of data.products) {
  const n = Number(r.id.slice(-3)) - 1,
    bag = r.category === "bags",
    spec = r.specificationRow;
  const specifications: Product["specifications"] = bag
    ? {
        capacityLiters: capacity[n],
        expandableCapacityLiters: n === 4 ? 32 : null,
        weightKg: weights[n],
        material: spec[2],
        compartments: spec[3],
        laptopMaxInches: laptop[n],
        separateShoeCompartment: n === 0 ? true : null,
        dimensions: null,
      }
    : {
        widthInches: 60,
        lengthInches: 80,
        maxMattressDepthInches: depth[n],
        minMattressDepthInches: n === 4 ? 12 : 0,
        composition: spec[0],
        threadCount: spec[1] === "null" ? null : Number(spec[1]),
        includedPieces: n < 4 ? 4 : null,
        care: n < 4 ? "Wash max 60°C; tumble medium" : null,
        cotton100Percent: n === 0 || n === 3 || n === 4,
        fitNotes: spec[3],
        packageNotes: spec[4],
      };
  const p: Product = {
    id: r.id,
    category: r.category,
    brand: r.brand,
    name: r.brand + " " + r.model,
    variant: r.id + "-DEMO",
    variantId: r.id + "-DEMO",
    description: r.description,
    specifications: {
      ...specifications,
      sourceAvailability: r.realAvailability,
    },
    referencePrice: r.referencePrice,
    strengths: bag ? [spec[4]] : [spec[0]],
    limitations: bag
      ? [
          "Laptop diagonal is a screening limit, not a guarantee of physical fit; exact sleeve dimensions are unknown.",
        ]
      : [
          "No cooling or health guarantee. Confirm exact mattress dimensions/depth and package contents.",
        ],
    evidenceIds: [`ev-${r.id}-spec`],
    media: [
      {
        url: bag ? "/reference/bag-style.svg" : "/reference/bedding-style.svg",
        alt: "Generic category illustration, not a photograph of this model",
        classification: "proxy",
      },
    ],
    videos: [],
    buyerSignals: {
      averageRating: r.reviewRow[0] === "null" ? null : Number(r.reviewRow[0]),
      ratingCount: r.reviewRow[1] === "null" ? null : Number(r.reviewRow[1]),
      writtenReviewCount: null,
      purchaseCount: null,
      purchasePeriod: null,
      reviewSummary: r.reviewRow[0] === "null" ? null : r.reviewRow[2],
    },
    compatibility: { kind: bag ? "bag" : "bedding", requiresKnownHost: false },
  };
  if (!bag && n >= 4)
    p.limitations.push(
      "White/four-piece package assumed only for the simulated variant; actual contents and care are unverified.",
    );
  evidence.push({
    id: p.evidenceIds[0],
    subjectType: "product",
    subjectId: p.id,
    source:
      "Team-supplied product page snapshot; not independently reverified by backend",
    sourceUrl: r.sourceUrl,
    sourceType: "merchant",
    classification: "snapshot",
    capturedAt: "2026-10-24",
    claim: JSON.stringify({
      specifications,
      referencePrice: r.referencePrice,
      realAvailability: r.realAvailability,
    }),
    rating: null,
  });
  if (p.buyerSignals!.averageRating !== null) {
    const id = `ev-${r.id}-reviews`;
    p.evidenceIds.push(id);
    evidence.push({
      id,
      subjectType: "product",
      subjectId: p.id,
      source:
        "Product-page aggregate across grouped variants; paraphrased team research",
      sourceUrl: r.sourceUrl,
      sourceType: "review",
      classification: "snapshot",
      capturedAt: "2026-10-24",
      claim: r.reviewRow[2],
      rating: {
        value: p.buyerSignals!.averageRating,
        count: p.buyerSignals!.ratingCount,
      },
    });
  }
  products.push(p);
}
for (const sellerId of ["DEMO-VALUE", "DEMO-EXPRESS"])
  evidence.push({
    id: `ev-${sellerId}`,
    subjectType: "seller",
    subjectId: sellerId,
    source: "Synthetic seller fixture; reputation unknown",
    sourceType: "fixture",
    classification: "proxy",
    capturedAt: null,
    claim:
      "Fictional seller and fulfillment terms; no reputation rating established.",
    rating: null,
  });
for (const r of data.offers) {
  const express = r.sellerId === "DEMO-EXPRESS";
  offers.push({
    id: r.id,
    productId: r.productId,
    variantId: r.productId + "-DEMO",
    sellerId: r.sellerId,
    sellerName: express
      ? "Demo Express Seller — fictional"
      : "Demo Value Seller — fictional",
    currency: "USD",
    unitPrice: r.unitPrice,
    shipping: r.shipping,
    otherFees: 0,
    setupCost: 0,
    setupConditions:
      "No additional setup hardware required for this bag/bedding fixture.",
    available: true,
    stock: 8,
    destination: teamProfile.destination,
    deliveryDays: r.deliveryDays,
    deliveryWindow: {
      latestOffsetDays: r.deliveryDays,
      latestAt: arrival(r.deliveryDays),
      scenarioNow: clock,
      timeZone: "Asia/Singapore",
    },
    deliveryConditions: `Synthetic arrival ${arrival(r.deliveryDays)}; fixed clock ${clock}, before noon cutoff.`,
    returnConditions: `Within ${express ? 30 : 14} days of simulated delivery, unused/unwashed in original packaging. Item price refunded, outbound shipping excluded; return shipping USD ${express ? "0" : "5"}.`,
    conditions: [
      "Synthetic zero-additional-tax/fees fixture; not a jurisdiction tax claim.",
      "Neutral bag color / stated bedding demo variant; no real retail SKU or inventory guarantee.",
    ],
    uncertainties: [
      "Real availability, tax and destination fulfillment not verified.",
    ],
    evidenceIds: [`ev-${r.sellerId}`],
    classification: "proxy",
  });
}
teamProfile.scenarios = [
  {
    id: "cafe-dictation",
    title: "Noisy-café dictation",
    openingRequest:
      "I dictate into my computer in noisy cafés. What would help?",
    constraints: { category: "audio-accessories", currency: "USD" },
    anchorProductId: "MIC-020",
    plannedChange:
      "Clarify host connection and portability, choose priority, then compare grounded options.",
    expectedOutcome:
      "Unknown host/setup blocks checkout; unavailable rows remain unavailable. No invented dictation accuracy.",
  },
  {
    id: "work-gym-bag",
    title: "Bag inspiration for work and gym",
    openingRequest:
      "I want a bag for a 14-inch laptop and separate gym shoes, under 150 dollars.",
    constraints: { category: "bags", currency: "USD", budgetMinor: 15000 },
    anchorProductId: "BAG-001",
    plannedChange: "Need it tomorrow; then lower total budget to USD 100.",
    expectedOutcome:
      "BAG-001-A is USD 104 but late; BAG-001-B is USD 119 by tomorrow. New USD 100 constraint cannot silently be relaxed.",
  },
  {
    id: "warm-room-bedding",
    title: "Bedsheets for a warm room",
    openingRequest:
      "I need white sheets for a 60 by 80 inch bed with a 12 inch mattress, under 70 dollars.",
    constraints: {
      category: "bedding",
      currency: "USD",
      budgetMinor: 7000,
      compatibility: {
        bedWidthInches: 60,
        bedLengthInches: 80,
        mattressDepthInches: 12,
      },
    },
    anchorProductId: "BED-003",
    plannedChange:
      "Compare percale versus sateen; then require 100 percent cotton.",
    expectedOutcome:
      "BED-003-A USD 54.99 or BED-002-A USD 64.99 fit. Shallow sheets and expensive alternatives excluded. Cotton-only produces no match.",
  },
];
teamProfile.preparedImages = [
  {
    id: "bag-inspiration",
    url: "/reference/bag-style.svg",
    classification: "proxy",
    description:
      "Illustrative tote inspiration, not a product photograph. Shape is visible; capacity and fabric are unknown.",
    correctionExample: "I like the shape, not the color.",
  },
  {
    id: "bedroom-inspiration",
    url: "/reference/bedding-style.svg",
    classification: "proxy",
    description:
      "Synthetic bedroom illustration. Cannot infer mattress dimensions or material.",
    correctionExample: "My mattress is 12 inches deep.",
  },
];
teamProfile.knownLinks = Object.fromEntries(
  evidence
    .filter((e) => e.subjectType === "product" && e.sourceUrl)
    .map((e) => [e.sourceUrl!, e.subjectId]),
);
validateCatalog(teamProfile.catalog);
