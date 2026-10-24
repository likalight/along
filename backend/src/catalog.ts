import type { CatalogData, CatalogProfile } from "./contracts.ts";
import type {
  Product,
  Offer,
  Evidence,
  Scenario,
  Constraints,
  Quote,
} from "./contracts.ts";

// All names, offers, ratings and fulfillment details below are openly labelled fixtures.
const bagRows = [
  ["commuter-tote", "Commuter Tote", 24, 650, "nylon", true, 6900],
  ["metro-backpack", "Metro Backpack", 22, 780, "polyester", true, 7900],
  ["studio-duffel", "Studio Duffel", 32, 820, "nylon", true, 5900],
  ["canvas-carryall", "Canvas Carryall", 20, 910, "cotton", false, 4900],
  ["light-daypack", "Light Daypack", 18, 430, "polyester", false, 3900],
  ["weekend-convertible", "Weekend Convertible", 30, 1050, "nylon", true, 9900],
] as const;
const beddingRows = [
  ["cotton-percale", "Cotton Percale Set", "cotton", "percale", 35, 8900],
  ["cotton-sateen", "Cotton Sateen Set", "cotton", "sateen", 40, 9900],
  ["linen-blend", "Linen Blend Set", "linen/cotton", "plain", 35, 12900],
  ["lyocell-set", "Lyocell Set", "lyocell", "sateen", 40, 13900],
  ["microfiber-set", "Microfiber Set", "polyester", "microfiber", 30, 4900],
  ["cotton-basic", "Cotton Everyday Set", "cotton", "plain", 30, 6900],
] as const;
const products: Product[] = [];
const offers: Offer[] = [];
const evidence: Evidence[] = [];
function add(p: Product, price: number) {
  p.evidenceIds = [`ev-${p.id}-spec`, `ev-${p.id}-review`];
  products.push(p);
  evidence.push(
    {
      id: p.evidenceIds[0],
      subjectType: "product",
      subjectId: p.id,
      source: "Prepared demo specification sheet",
      sourceType: "fixture",
      classification: "proxy",
      capturedAt: null,
      claim: JSON.stringify(p.specifications),
      rating: null,
    },
    {
      id: p.evidenceIds[1],
      subjectType: "product",
      subjectId: p.id,
      source: "Synthetic demonstration review",
      sourceType: "fixture",
      classification: "proxy",
      capturedAt: null,
      claim: `Fixture feedback: ${p.strengths[0]}. ${p.limitations[0]}. Not actual customer feedback.`,
      rating: { value: 4.2, count: 12 },
    },
  );
  for (const [sellerId, sellerName, premium, days] of [
    ["value", "Value Demo Store", 0, 4],
    ["express", "Express Demo Store", 1500, 1],
  ] as const) {
    offers.push({
      id: `${p.id}-${sellerId}`,
      productId: p.id,
      sellerId,
      sellerName,
      currency: "SGD",
      unitPrice: price + premium,
      shipping: 500,
      otherFees: 0,
      available: true,
      stock: 8,
      deliveryDays: days,
      deliveryConditions: `Proxy estimate: ${days} calendar day(s) after the demo order; no real fulfillment.`,
      returnConditions:
        "Proxy policy: unused items within 14 days; buyer pays return shipping.",
      conditions: ["Demonstration only; no real payment or shipment."],
      uncertainties: [],
      evidenceIds: [`ev-seller-${sellerId}`],
      classification: "proxy",
    });
  }
}
for (const [
  id,
  name,
  capacity,
  weight,
  material,
  compartment,
  price,
] of bagRows)
  add(
    {
      id,
      category: "bags",
      name,
      variant: "Charcoal / standard",
      specifications: {
        capacityLitres: capacity,
        weightGrams: weight,
        material,
        separateGymCompartment: compartment,
        laptopFit: null,
        waterResistance: null,
      },
      strengths: [`${capacity} L stated fixture capacity`],
      limitations: ["Laptop fit and water resistance are unverified"],
      evidenceIds: [],
      media: [
        {
          url: "/reference/bag-style.svg",
          alt: "Synthetic bag style reference; not a product photograph",
          classification: "proxy",
        },
      ],
    },
    price,
  );
for (const [id, name, material, weave, depth, price] of beddingRows)
  add(
    {
      id,
      category: "bedding",
      name,
      variant: "Queen 152 × 190 cm / ivory",
      specifications: {
        material,
        weave,
        widthCm: 152,
        lengthCm: 190,
        maxMattressDepthCm: depth,
        pieces: 4,
        care: "Machine wash cold; follow the supplied care label",
      },
      strengths: [`${material} composition stated in fixture`],
      limitations: ["No cooling or health benefit has been verified"],
      evidenceIds: [],
      media: [
        {
          url: "/reference/bedding-style.svg",
          alt: "Synthetic bedding style reference; not a product photograph",
          classification: "proxy",
        },
      ],
    },
    price,
  );
for (const sellerId of ["value", "express"])
  evidence.push({
    id: `ev-seller-${sellerId}`,
    subjectType: "seller",
    subjectId: sellerId,
    source: "Synthetic seller-feedback fixture",
    sourceType: "fixture",
    classification: "proxy",
    capturedAt: null,
    claim: "Prepared seller feedback for demo; not actual customer feedback.",
    rating: { value: 4.4, count: 20 },
  });
// Explicitly incomplete price and absent product review, for recoverable demo paths.
offers.find((o) => o.id === "microfiber-set-value")!.otherFees = null;
evidence.splice(
  evidence.findIndex((e) => e.id === "ev-cotton-basic-review"),
  1,
);
products.find((p) => p.id === "cotton-basic")!.evidenceIds = [
  "ev-cotton-basic-spec",
];
export const catalog: CatalogData = {
  version: "1",
  currency: "SGD",
  notice:
    "All current catalog records are synthetic proxy data, not live merchant offers.",
  products,
  offers,
  evidence,
};
export const preparedImages = [
  {
    id: "bag-style",
    url: "/reference/bag-style.svg",
    classification: "proxy",
    description:
      "Prepared charcoal tote style illustration. Does not establish product identity, laptop fit, size or water resistance.",
    correctionExample: "I meant a backpack, not a tote.",
  },
  {
    id: "bedding-style",
    url: "/reference/bedding-style.svg",
    classification: "proxy",
    description:
      "Prepared ivory bedding illustration. Does not establish material, dimensions or cooling properties.",
    correctionExample:
      "The mattress is 35 cm deep; do not infer it from the image.",
  },
];
export const scenarios: Scenario[] = [
  {
    id: "work-gym",
    title: "Work and gym bag",
    openingRequest: "I need a bag for work that also fits my gym clothes.",
    constraints: { category: "bags", budgetMinor: 10000 },
    anchorProductId: "commuter-tote",
    plannedChange: "Require a separate gym compartment.",
    expectedOutcome:
      "Explain evidence and revise eligible offers without losing budget.",
  },
  {
    id: "warm-room",
    title: "Bedding for a warm room",
    openingRequest: "My room gets hot at night; help me choose bedsheets.",
    constraints: { category: "bedding", budgetMinor: 15000 },
    anchorProductId: "cotton-percale",
    plannedChange: "Require cotton and a 35 cm mattress depth.",
    expectedOutcome:
      "Clarify exact dimensions; explain composition without promising cooling.",
  },
  {
    id: "urgent-bag",
    title: "Bag needed tomorrow",
    openingRequest: "I need this commuter tote for a trip tomorrow.",
    constraints: {
      category: "bags",
      budgetMinor: 10000,
      deliveryWithinDays: 1,
    },
    anchorProductId: "commuter-tote",
    plannedChange: "Reduce total budget to SGD 75.",
    expectedOutcome:
      "Cheaper offer is late; express offer costs SGD 89. Revised budget produces a conflict, not silent relaxation.",
  },
];
export function quoteOffer(
  offerId: string,
  quantity: number,
  constraints: Constraints = {},
  excluded: string[] = [],
  data: CatalogData = catalog,
  destination = "Demo destination, Singapore",
): Quote {
  const { products, offers } = data;
  const offer = offers.find((o) => o.id === offerId);
  if (!offer) throw new Error("UNKNOWN_OFFER");
  const product = products.find((p) => p.id === offer.productId)!;
  const subtotal = offer.unitPrice * quantity;
  const total =
    offer.shipping === null || offer.otherFees === null
      ? null
      : subtotal + offer.shipping + offer.otherFees;
  const conflicts: Quote["conflicts"] = [];
  const conflict = (code: string, message: string, field?: string) =>
    conflicts.push({ code, message, field, offerId });
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99)
    conflict(
      "INVALID_QUANTITY",
      "Quantity must be an integer from 1 to 99.",
      "quantity",
    );
  if (!offer.available || quantity > offer.stock)
    conflict("UNAVAILABLE", "Requested quantity is unavailable.", "quantity");
  if ((constraints.currency ?? data.currency) !== offer.currency)
    conflict(
      "CURRENCY_CONFLICT",
      "Offer currency differs from the budget currency.",
      "currency",
    );
  if (total === null)
    conflict(
      "UNKNOWN_TOTAL",
      "A mandatory fee is unknown; approval is blocked.",
      "total",
    );
  if (
    total !== null &&
    constraints.budgetMinor !== undefined &&
    total > constraints.budgetMinor
  )
    conflict(
      "OVER_BUDGET",
      "Complete payable total exceeds the stated budget.",
      "budgetMinor",
    );
  if (
    constraints.deliveryWithinDays !== undefined &&
    (offer.deliveryDays === null ||
      offer.deliveryDays > constraints.deliveryWithinDays)
  )
    conflict(
      "DELIVERY_CONFLICT",
      "Delivery cannot meet the stated deadline.",
      "deliveryWithinDays",
    );
  if (constraints.category && constraints.category !== product.category)
    conflict(
      "CATEGORY_CONFLICT",
      "Product is outside the required category.",
      "category",
    );
  if (excluded.includes(product.id))
    conflict("EXCLUDED", "Shopper excluded this product.");
  for (const [key, value] of Object.entries(
    constraints.requiredSpecifications ?? {},
  ))
    if (product.specifications[key] !== value)
      conflict(
        "SPECIFICATION_CONFLICT",
        `Required ${key} is unmatched or unknown.`,
        key,
      );
  return structuredClone({
    product,
    offer,
    quantity,
    currency: offer.currency,
    destination,
    subtotal,
    shipping: offer.shipping,
    otherFees: offer.otherFees,
    total,
    eligible: conflicts.length === 0,
    conflicts,
  });
}
export function eligibleOffers(
  constraints: Constraints = {},
  quantity = 1,
  excluded: string[] = [],
  data: CatalogData = catalog,
  destination = "Demo destination, Singapore",
) {
  return data.offers.map((o) =>
    quoteOffer(o.id, quantity, constraints, excluded, data, destination),
  );
}
export function validateCatalog(data: CatalogData = catalog) {
  const { products, offers, evidence } = data;
  const unique = (items: { id: string }[]) => {
    if (new Set(items.map((x) => x.id)).size !== items.length)
      throw new Error("Duplicate catalog ID");
  };
  unique(products);
  unique(offers);
  unique(evidence);
  if (products.length > 50) throw new Error("Catalog exceeds demo cap");
  for (const p of products)
    for (const id of p.evidenceIds)
      if (
        !evidence.some(
          (e) =>
            e.id === id && e.subjectId === p.id && e.subjectType === "product",
        )
      )
        throw new Error("Invalid product evidence");
  for (const o of offers) {
    if (o.currency !== data.currency)
      throw new Error(
        "Mixed currencies in purchase catalog; do not silently convert budgets",
      );
    if (!products.some((p) => p.id === o.productId))
      throw new Error("Invalid offer product");
    for (const amount of [o.unitPrice, o.shipping, o.otherFees])
      if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0))
        throw new Error("Invalid money");
    for (const id of o.evidenceIds)
      if (
        !evidence.some(
          (e) =>
            e.id === id &&
            e.subjectType === "seller" &&
            e.subjectId === o.sellerId,
        )
      )
        throw new Error("Invalid seller evidence");
  }
}
validateCatalog();

export const nonTechProfile: CatalogProfile = {
  catalog,
  scenarios,
  preparedImages,
  destination: "Demo destination, Singapore",
};
