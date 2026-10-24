import type { Attachment, Evidence, Offer, Product } from "@coupang/contract";

/** Bounded demo fixtures — 12 audio + 6 bags + 6 bedding ≈ contract target. */

export const PRODUCTS: Product[] = [
  // Audio — headset
  p("MIC-001", "audio", "Acme", "FocusBuds Pro", "black", "FocusBuds Pro", "headset", 78),
  p("MIC-003", "audio", "North", "OfficeClip", "graphite", "OfficeClip Graphite", "clip_on", 72),
  p("MIC-009", "audio", "DeskTone", "Beam Mic", "usb-c", "DeskTone Beam", "directional_desktop", 80),
  p("MIC-015", "audio", "Acme", "FocusBuds Lite", "white", "FocusBuds Lite", "headset", 65),
  p("MIC-020", "audio", "CafeClear", "TalkClip", "silver", "TalkClip Silver", "clip_on", 74),
  p("MIC-022", "audio", "DeskTone", "Beam Mini", "usb-a", "Beam Mini", "directional_desktop", 60),
  p("MIC-025", "audio", "Harbor", "MeetHeadset", "navy", "MeetHeadset Navy", "headset", 70),
  p("MIC-037", "audio", "CafeClear", "TalkClip Pro", "black", "TalkClip Pro", "clip_on", 82),
  p("MIC-038", "audio", "North", "OfficeClip Air", "rose", "OfficeClip Air", "clip_on", 58),
  p("MIC-040", "audio", "DeskTone", "Beam Pro", "usb-c", "Beam Pro", "directional_desktop", 88),
  p("MIC-044", "audio", "Harbor", "MeetHeadset ANC", "black", "MeetHeadset ANC", "headset", 84, {
    notes: "Hearing-side ANC; does not prove café dictation WER.",
  }),
  p("MIC-047", "audio", "Acme", "FocusBuds Pro", "unavailable", "FocusBuds Pro (OOS seed)", "headset", 50, {
    unavailable: true,
  }),
  // Bags
  p("BAG-001", "bags", "Trail", "CityPack 20", "navy", "CityPack 20 Navy", undefined, 75, {
    shape: "backpack",
    color: "navy",
    capacityL: 20,
  }),
  p("BAG-002", "bags", "Trail", "CityPack 20", "olive", "CityPack 20 Olive", undefined, 72, {
    shape: "backpack",
    color: "olive",
    capacityL: 20,
  }),
  p("BAG-003", "bags", "Stride", "GymTote", "black", "GymTote Black", undefined, 68, {
    shape: "tote",
    color: "black",
    capacityL: 18,
  }),
  p("BAG-004", "bags", "Stride", "Commute Sling", "slate", "Commute Sling Slate", undefined, 70, {
    shape: "sling",
    color: "slate",
    capacityL: 12,
  }),
  p("BAG-005", "bags", "Harbor", "Weekender Duo", "khaki", "Weekender Duo", undefined, 66, {
    shape: "duffel",
    color: "khaki",
    capacityL: 35,
  }),
  p("BAG-006", "bags", "Trail", "CityPack Slim", "navy", "CityPack Slim Navy", undefined, 71, {
    shape: "backpack",
    color: "navy",
    capacityL: 16,
  }),
  // Bedding
  p("BED-001", "bedding", "CottonCo", "Percale Set", "queen-white", "Percale Queen White", undefined, 77, {
    size: "queen",
    material: "cotton-percale",
    pieces: 4,
  }),
  p("BED-002", "bedding", "CottonCo", "Percale Set", "king-white", "Percale King White", undefined, 76, {
    size: "king",
    material: "cotton-percale",
    pieces: 4,
  }),
  p("BED-003", "bedding", "LinenLab", "Washed Linen", "queen-sand", "Washed Linen Queen Sand", undefined, 73, {
    size: "queen",
    material: "linen",
    pieces: 3,
  }),
  p("BED-004", "bedding", "LinenLab", "Washed Linen", "queen-sage", "Washed Linen Queen Sage", undefined, 72, {
    size: "queen",
    material: "linen",
    pieces: 3,
  }),
  p("BED-005", "bedding", "SoftWeave", "Bamboo Blend", "queen-grey", "Bamboo Blend Queen", undefined, 69, {
    size: "queen",
    material: "bamboo-blend",
    pieces: 4,
    care: "gentle wash",
  }),
  p("BED-006", "bedding", "SoftWeave", "Cotton Sateen", "full-white", "Cotton Sateen Full", undefined, 64, {
    size: "full",
    material: "cotton-sateen",
    pieces: 4,
  }),
];

function p(
  id: string,
  category: Product["category"],
  brand: string,
  model: string,
  variantId: string,
  title: string,
  solutionType?: Product["solutionType"],
  authoredFitScore?: number,
  extra: Record<string, unknown> = {},
): Product {
  const { unavailable, notes, ...specs } = extra;
  return {
    id,
    category,
    brand,
    model,
    variantId,
    title,
    image: {
      url: `https://fixtures.local/${id}.jpg`,
      alt: title,
      classification: "proxy",
    },
    specs: {
      ...specs,
      ...(unavailable ? { availabilitySeed: "unavailable" } : {}),
      ...(notes ? { limitationNote: notes } : {}),
    },
    limitations: notes ? [String(notes)] : [],
    evidenceIds: [`ev-${id}-product`],
    solutionType,
    authoredFitScore,
  };
}

export const OFFERS: Offer[] = [
  // MIC-040 competing offers — cheap/late vs dearer/fast
  offer("mic-040-cheap", "MIC-040", "usb-c", "demo-seller-a", 7900, 500, 3),
  offer("mic-040-fast", "MIC-040", "usb-c", "demo-seller-b", 9900, 0, 1),
  offer("mic-003-std", "MIC-003", "graphite", "demo-seller-a", 5900, 800, 2),
  offer("mic-020-std", "MIC-020", "silver", "demo-seller-b", 6400, 600, 2),
  offer("mic-037-std", "MIC-037", "black", "demo-seller-a", 8900, 0, 1),
  offer("mic-001-std", "MIC-001", "black", "demo-seller-b", 11900, 0, 2),
  offer("mic-009-std", "MIC-009", "usb-c", "demo-seller-a", 7200, 900, 3),
  offer("mic-044-std", "MIC-044", "black", "demo-seller-b", 12900, 0, 1),
  // Bags — tomorrow trade-off on BAG-001
  offer("bag-01-late", "BAG-001", "navy", "demo-seller-a", 7900, 500, 3),
  offer("bag-01-fast", "BAG-001", "navy", "demo-seller-b", 8900, 1000, 1),
  offer("bag-02-std", "BAG-002", "olive", "demo-seller-a", 7900, 800, 2),
  offer("bag-03-std", "BAG-003", "black", "demo-seller-b", 5400, 700, 2),
  offer("bag-06-std", "BAG-006", "navy", "demo-seller-a", 6900, 600, 2),
  // Bedding
  offer("bed-01-std", "BED-001", "queen-white", "demo-seller-a", 8900, 1000, 3),
  offer("bed-03-std", "BED-003", "queen-sand", "demo-seller-b", 12900, 0, 2),
  offer("bed-05-std", "BED-005", "queen-grey", "demo-seller-a", 9900, 800, 2),
];

function offer(
  id: string,
  productId: string,
  variantId: string,
  sellerId: string,
  unit: number,
  ship: number,
  days: number,
): Offer {
  return {
    id,
    productId,
    variantId,
    sellerId,
    currency: "USD",
    unitPriceMinor: unit,
    shippingMinor: ship,
    otherFeesMinor: 0,
    availability: productId === "MIC-047" ? "unavailable" : "in_stock",
    destination: "DEMO-DESTINATION",
    deliveryWindow: { latestOffsetDays: days },
    returnTerms: "14-day demo returns",
    conditions: ["Synthetic fulfillment fixture"],
    evidenceIds: [`ev-${sellerId}`],
    classification: "proxy",
  };
}

export const EVIDENCE: Evidence[] = [
  ...PRODUCTS.filter((x) => x.id !== "MIC-047").map(
    (prod): Evidence => ({
      id: `ev-${prod.id}-product`,
      subjectType: "product",
      subjectId: prod.id,
      sourceType: "curated_review_synthesis",
      checkedOn: "2026-10-01",
      classification: "proxy",
      claim:
        prod.category === "audio"
          ? "Callers report clearer voice on quiet calls; café dictation accuracy is not measured here."
          : prod.category === "bags"
            ? "Shoppers like the structure for daily commute; laptop fit is not guaranteed from photos."
            : "Percale/linen feel is supported by care notes; no cooling or health claims.",
      excerpt: "Useful for the stated need with clear trade-offs.",
      rating: 4.2,
      ratingCount: 128,
      writtenReviewCount: 40,
      purchaseCount: null,
      purchaseCountPeriod: null,
      reviewScope: "product family proxy",
      media:
        prod.id === "MIC-040" || prod.id === "BAG-001"
          ? {
              id: `vid-${prod.id}`,
              url: `https://fixtures.local/video/${prod.id}.mp4`,
              creator: "Demo Creator",
              platform: "fixture",
              date: "2026-09-01",
              topic: "product overview",
              playable: true,
            }
          : undefined,
    }),
  ),
  {
    id: "ev-demo-seller-a",
    subjectType: "seller",
    subjectId: "demo-seller-a",
    sourceType: "seller_feedback",
    checkedOn: "2026-10-01",
    classification: "proxy",
    claim: "Seller A is usually on-time for standard shipping in fixtures.",
    rating: 4.0,
    ratingCount: 80,
    reviewScope: "seller",
  },
  {
    id: "ev-demo-seller-b",
    subjectType: "seller",
    subjectId: "demo-seller-b",
    sourceType: "seller_feedback",
    checkedOn: "2026-10-01",
    classification: "proxy",
    claim: "Seller B prioritizes faster demo delivery windows.",
    rating: 4.4,
    ratingCount: 55,
    reviewScope: "seller",
  },
];

export const PREPARED_ATTACHMENTS: Attachment[] = [
  {
    id: "att-bag-navy-ref",
    kind: "prepared_image",
    preparedKey: "bag-navy-backpack",
    url: "https://fixtures.local/prepared/bag-navy.jpg",
    status: "ready",
  },
];

export const KNOWN_LINKS: Record<
  string,
  { productId?: string; note: string; status: "ready" | "unavailable" }
> = {
  "https://fixtures.local/ref/bag-001": {
    productId: "BAG-001",
    note: "Curated reference for CityPack 20 Navy",
    status: "ready",
  },
  "https://fixtures.local/ref/mic-040": {
    productId: "MIC-040",
    note: "Curated reference for DeskTone Beam Pro",
    status: "ready",
  },
};

export function completeTotalMinor(o: Offer): number | null {
  if (
    o.unitPriceMinor == null ||
    o.shippingMinor == null ||
    o.otherFeesMinor == null
  ) {
    return null;
  }
  return o.unitPriceMinor + o.shippingMinor + o.otherFeesMinor;
}

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((x) => x.id === id);
}

export function getOffer(id: string): Offer | undefined {
  return OFFERS.find((x) => x.id === id);
}

export function offersForProduct(productId: string): Offer[] {
  return OFFERS.filter(
    (o) => o.productId === productId && o.availability === "in_stock",
  );
}
