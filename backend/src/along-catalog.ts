import { getCatalog } from "../../catalog/src/index.ts";
import { quoteOffer as quoteCanonical, validateCatalog as validateCanonical } from "../../catalog/src/validation.ts";
import type { Catalog, Constraints as CanonicalConstraints, Product as CanonicalProduct, Offer as CanonicalOffer } from "../../catalog/src/types.ts";
import type { CatalogData, CatalogProfile, Constraints, Product, Offer, Quote } from "./contracts.ts";

const minor = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const category = (value: string | undefined) => value === "bags" ? "everyday-bags" : value === "bedding" ? "bedsheet-sets" : value;
/** USB names an interface family; it does not establish the host's connector. */
export function normalizeHostConnection(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized && /^usb(?:\s*[234](?:\.\d+)?)?(?: (?:ports?|connection|interface))?$/.test(normalized)) return undefined;
  const usbConnector = normalized?.match(/^usb[ -]?(?:type[ -]?)?([ac])(?: port)?$/);
  return usbConnector ? `usb-${usbConnector[1]}` : normalized;
}
const host = normalizeHostConnection;

/** Legacy aliases are presentation adapters only. Canonical source fields remain lossless. */
function adaptProduct(product: CanonicalProduct, data: Catalog): Product {
  const specifications: Product["specifications"] = {};
  for (const [key, value] of Object.entries(product.specs)) {
    if (value === null || ["string", "number", "boolean"].includes(typeof value))
      specifications[key] = value as string | number | boolean | null;
  }
  if (product.category === "everyday-bags") {
    specifications.laptopMaxInches = specifications.laptopFitInches;
    specifications.separateGymCompartment = specifications.separateShoeCompartment;
  }
  if (product.category === "bedsheet-sets") {
    specifications.widthInches = specifications.fittedWidthInches;
    specifications.lengthInches = specifications.fittedLengthInches;
    specifications.cotton100Percent = specifications.compositionLabel === "100% cotton";
    specifications.includedPieces = product.specs.includedPieces === null ? null : JSON.stringify(product.specs.includedPieces);
  }
  const path = product.specs.compatibilityFixture as { supportedHostConnections: string[] } | undefined;
  const reviews = data.evidence.filter(e => product.evidenceIds.includes(e.id) && e.sourceType === "review" && e.classification !== "proxy");
  return {
    canonical: product,
    id: product.id, category: product.category, brand: product.brand, name: product.title,
    variantId: product.variantId, variant: product.variantId,
    description: product.model, specifications,
    ...(product.referencePrice.amountMinor === null ? {} : { referencePrice: {
      amountMinor: product.referencePrice.amountMinor, currency: product.referencePrice.currency, kind: product.referencePrice.price_kind,
    } }),
    compatibility: {
      kind: product.category === "audio-accessories" ? "audio" : product.category === "everyday-bags" ? "bag" : "bedding",
      requiresKnownHost: product.category === "audio-accessories",
      ...(path ? { hostConnections: path.supportedHostConnections } : {}),
    },
    // Authored suitability remains in canonical.authoredFit, never a customer rating or measured benefit.
    strengths: [], limitations: product.limitations, evidenceIds: product.evidenceIds,
    media: [{ url: product.image.url, alt: product.image.alt, classification: product.image.classification === "observed" ? "real" : product.image.classification }],
    buyerSignals: {
      averageRating: product.buyerMetrics.rating, ratingCount: product.buyerMetrics.ratingCount,
      writtenReviewCount: product.buyerMetrics.writtenReviewCount, purchaseCount: product.buyerMetrics.purchaseCount,
      purchasePeriod: product.buyerMetrics.purchaseCountPeriod, reviewSummary: reviews.map(e => e.claim).join(" ") || null,
    },
    videos: [],
  };
}

function dayOffset(now: string, latest: string) {
  return Math.round((Date.parse(latest.slice(0, 10)) - Date.parse(now.slice(0, 10))) / 86400000);
}

function adaptOffer(offer: CanonicalOffer, data: Catalog): Offer {
  const setupCost = offer.setupHardware.reduce((sum, item) => sum + item.priceMinor, 0);
  return {
    canonical: offer, id: offer.id, productId: offer.productId, variantId: offer.variantId,
    sellerId: offer.sellerId, sellerName: data.sellers.find(s => s.id === offer.sellerId)!.name,
    currency: offer.currency, unitPrice: offer.unitPriceMinor, shipping: offer.shippingMinor,
    // Hardware is already included in canonical otherFeesMinor. Expose it separately without double counting.
    setupCost, otherFees: offer.otherFeesMinor - setupCost + offer.taxMinor,
    setupConditions: offer.setupHardware.length
      ? offer.setupHardware.map(item => `${item.id}: ${item.description}; USD ${(item.priceMinor / 100).toFixed(2)} included in the total.`).join(" ")
      : "No additional setup hardware is required by this declared fixture.",
    available: offer.availability === "in_stock", stock: offer.availability === "in_stock" ? 1 : 0,
    destination: offer.destination, deliveryDays: dayOffset(data.scenarioNow, offer.deliveryWindow.latest),
    deliveryWindow: { latestOffsetDays: dayOffset(data.scenarioNow, offer.deliveryWindow.latest), latestAt: offer.deliveryWindow.latest, scenarioNow: data.scenarioNow, timeZone: offer.deliveryWindow.timezone },
    deliveryConditions: `Synthetic window ${offer.deliveryWindow.earliest} to ${offer.deliveryWindow.latest} (${offer.deliveryWindow.timezone}); order cutoff ${offer.orderCutoff}.`,
    returnConditions: offer.returnTerms, conditions: offer.conditions,
    uncertainties: ["Synthetic offer; real seller stock, destination service, fees and fulfillment have not been verified.", ...data.products.find(p => p.id === offer.productId)!.limitations],
    evidenceIds: offer.evidenceIds, classification: offer.classification,
  };
}

export function buildAlongProfile(): CatalogProfile {
  const canonical = getCatalog();
  const catalog: CatalogData = {
    canonical, version: canonical.version, currency: canonical.currency,
    notice: "Prepared Along catalog: attributed research snapshots and explicit synthetic USD checkout offers. Reference prices are not payable totals; no live inventory or Singapore stock is asserted.",
    products: canonical.products.map(p => adaptProduct(p, canonical)),
    offers: canonical.offers.map(o => adaptOffer(o, canonical)),
    evidence: canonical.evidence.map(e => ({
      canonical: e, id: e.id, subjectType: e.subjectType, subjectId: e.subjectId,
      source: e.sourceUrl ?? (e.sourceType === "authored" ? "Authored demo hypothesis; not measured performance" : "Explicit synthetic fixture"),
      sourceUrl: e.sourceUrl, sourceType: e.sourceType === "manufacturer" ? "merchant" : e.sourceType === "authored" ? "fixture" : e.sourceType,
      classification: e.classification === "observed" ? "real" : e.classification, capturedAt: e.checkedOn, claim: e.claim,
      rating: e.rating === null && e.ratingCount === null ? null : { value: e.rating, count: e.ratingCount },
    })),
  };
  return {
    catalog, destination: canonical.destination, clock: { now: canonical.scenarioNow, timeZone: canonical.timezone },
    knownLinks: Object.fromEntries(canonical.knownLinks.map(link => [link.url, link.productId])),
    scenarios: canonical.scenarios.map(s => ({
      id: s.id, title: s.title, openingRequest: s.opening, anchorProductId: s.anchorProductId,
      constraints: { ...s.constraints, currency: canonical.currency }, plannedChange: s.changes.map(change => change.utterance).join(" "),
      expectedOutcome: "Preserve accepted constraints; explain any conflict instead of silently relaxing it. " + s.changes.map(change => `${change.utterance} → ${change.expectedOfferIds.join(", ") || "no eligible offers"}`).join("; "),
    })),
    preparedImages: canonical.imageFixtures.map(fixture => ({
      id: fixture.id, url: fixture.image.url, classification: fixture.image.classification,
      description: fixture.description, correctionExample: fixture.correctionExample,
    })),
  };
}

export const alongProfile = buildAlongProfile();

function deadlineForDays(data: Catalog, days: number): string {
  // Calendar-day delivery means 18:00 in the explicit Asia/Singapore fixture timezone, not a rolling 24 hours.
  const date = new Date(`${data.scenarioNow.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.toISOString().slice(0, 10)}T18:00:00+08:00`;
}

const conflictFields: Record<string, string> = {
  BUDGET_CONFLICT: "budgetMinor", DELIVERY_CONFLICT: "deadline", CATEGORY_CONFLICT: "category",
  PRODUCT_CONFLICT: "productId", VARIANT_CONFLICT: "variantId", CURRENCY_CONFLICT: "currency",
  HOST_CONNECTION_REQUIRED: "hostConnection", INCOMPATIBLE_HARDWARE: "hostConnection",
  LAPTOP_FIT_UNKNOWN_OR_INCOMPATIBLE: "laptopInches", CAPACITY_CONFLICT: "minimumCapacityL",
  SHOE_COMPARTMENT_UNKNOWN_OR_INCOMPATIBLE: "separateShoeCompartment", COMPOSITION_CONFLICT: "composition",
  BED_DIMENSION_CONFLICT: "bedWidthIn/bedLengthIn", MATTRESS_DEPTH_UNKNOWN_OR_INCOMPATIBLE: "mattressDepthIn",
  BED_MEASUREMENTS_REQUIRED: "bedWidthIn/bedLengthIn/mattressDepthIn", UNSUPPORTED_DESTINATION: "destination",
  UNSUPPORTED_QUANTITY: "quantity", INCOMPLETE_TOTAL: "total", MISSING_SETUP_HARDWARE: "setupHardware",
};
const conflictMessages: Record<string, string> = {
  BUDGET_CONFLICT: "The complete payable total exceeds the accepted budget, or the total is unknown.",
  DELIVERY_CONFLICT: "This offer cannot arrive by the accepted deadline.",
  HOST_CONNECTION_REQUIRED: "Confirm the host connection before checkout; no adapter compatibility is assumed.",
  INCOMPATIBLE_HARDWARE: "The accepted host connector is outside this fixture's documented hardware path.",
  BED_MEASUREMENTS_REQUIRED: "Confirm exact mattress width, length and depth before checkout.",
  ESSENTIAL_PRODUCT_DETAILS_UNKNOWN: "Included pieces or care are unverified; checkout is blocked.",
  UNSUPPORTED_QUANTITY: "These shipping and hardware fixtures support exactly one bundle; other quantities cannot be priced or approved.",
  MISSING_SETUP_HARDWARE: "Required setup hardware is missing; checkout is blocked.",
  INCOMPLETE_TOTAL: "A mandatory price, fee or tax is missing or inconsistent; checkout is blocked.",
};

/** Canonical validation is authoritative; an explicit shopper choice can cover routine USB cabling for a proxy offer. */
export function quoteAlongOffer(offerId: string, quantity: number, constraints: Constraints, excluded: string[], data: CatalogData, destination: string): Quote {
  const canonical = data.canonical!;
  const offer = data.offers.find(o => o.id === offerId);
  const sourceOffer = canonical.offers.find(o => o.id === offerId);
  if (!offer || !sourceOffer) throw new Error("UNKNOWN_OFFER");
  const product = data.products.find(p => p.id === sourceOffer.productId);
  const sourceProduct = canonical.products.find(p => p.id === sourceOffer.productId);
  if (!product || !sourceProduct) throw new Error("INVALID_OFFER_REFERENCE");
  const conflicts: Quote["conflicts"] = [];
  const conflict = (code: string, message = conflictMessages[code] ?? `Accepted constraint is unmatched or unknown: ${code}.`, field = conflictFields[code]) => {
    if (!conflicts.some(existing => existing.code === code && existing.field === field)) conflicts.push({ code, message, field, offerId });
  };
  let canonicalValid = true;
  try { validateCanonical(canonical); } catch (error) {
    canonicalValid = false;
    conflict("INVALID_CATALOG", `Catalog integrity failed: ${error instanceof Error ? error.message : "unknown data error"}. Approval is blocked.`);
  }
  const expectedProduct = adaptProduct(sourceProduct, canonical);
  let expectedOffer: Offer | undefined;
  try { expectedOffer = adaptOffer(sourceOffer, canonical); } catch { conflict("INVALID_CATALOG", "Required offer details are missing."); }
  // Compare every adapted field, including commercial wording and evidence, before it enters a summary.
  if (!same(product, expectedProduct) || (expectedOffer && !same(offer, expectedOffer)))
    conflict("CATALOG_ALIAS_MISMATCH", "Catalog display fields differ from their authoritative source. Refresh the catalog before checkout.");

  const fit = constraints.compatibility ?? {};
  const mapped: CanonicalConstraints = {
    ...(constraints as CanonicalConstraints),
    category: category(constraints.category) as CanonicalConstraints["category"],
    hostConnection: host(constraints.hostConnection) ?? host(fit.hostConnection),
    laptopInches: constraints.laptopInches ?? fit.laptopInches,
    bedWidthIn: constraints.bedWidthIn ?? fit.bedWidthInches,
    bedLengthIn: constraints.bedLengthIn ?? fit.bedLengthInches,
    mattressDepthIn: constraints.mattressDepthIn ?? fit.mattressDepthInches,
  };
  // A shopper can take care of ordinary USB cabling without identifying each
  // connector. This does not assert manufacturer compatibility or rewrite the
  // known host, and cannot bypass an analogue/Bluetooth mismatch or setup cost.
  const shopperHandlesUsbConnection =
    sourceOffer.classification === "proxy" &&
    sourceProduct.category === "audio-accessories" &&
    constraints.shopperHandledConnectionFor?.includes(sourceProduct.id) &&
    expectedProduct.compatibility?.hostConnections?.some(connection => connection === "usb-a" || connection === "usb-c") &&
    [host(constraints.hostConnection), host(fit.hostConnection)]
      .every(connection => connection === undefined || connection === "usb-a" || connection === "usb-c");
  for (const [flat, nested] of [[constraints.hostConnection && host(constraints.hostConnection), fit.hostConnection && host(fit.hostConnection)],
    [constraints.laptopInches, fit.laptopInches], [constraints.bedWidthIn, fit.bedWidthInches],
    [constraints.bedLengthIn, fit.bedLengthInches], [constraints.mattressDepthIn, fit.mattressDepthInches]])
    if (flat !== undefined && nested !== undefined && flat !== nested) conflict("CONFLICTING_COMPATIBILITY", "Flat and nested compatibility requirements disagree; clarify them without dropping either.", "compatibility");
  if (constraints.deliveryWithinDays !== undefined) {
    if (!Number.isSafeInteger(constraints.deliveryWithinDays) || constraints.deliveryWithinDays < 0 || constraints.deliveryWithinDays > 365)
      conflict("INVALID_DEADLINE", "Relative deadline must be an integer number of calendar days from 0 to 365.", "deliveryWithinDays");
    else {
      const relativeDeadline = deadlineForDays(canonical, constraints.deliveryWithinDays);
      if (!mapped.deadline || Date.parse(relativeDeadline) < Date.parse(mapped.deadline)) mapped.deadline = relativeDeadline;
    }
  }
  let total: number | null = null;
  try {
    const result = quoteCanonical(canonical, offerId, mapped, { destination, quantity });
    total = result.totalMinor;
    result.conflicts.forEach(code => {
      if (shopperHandlesUsbConnection && (code === "HOST_CONNECTION_REQUIRED" || code === "INCOMPATIBLE_HARDWARE")) return;
      conflict(code);
    });
  } catch (error) {
    conflict(error instanceof Error ? error.message : "INVALID_CATALOG", "The offer has an invalid product/variant reference or incomplete compatibility data.");
  }
  if (!Number.isSafeInteger(quantity) || quantity < 1) conflict("INVALID_QUANTITY", "Quantity must be a positive integer.", "quantity");
  if (quantity !== 1) total = null;
  if (!canonicalValid) total = null;
  if (excluded.includes(sourceProduct.id)) conflict("EXCLUDED", "The shopper excluded this product.", "excludedProductIds");
  for (const [key, value] of Object.entries(constraints.requiredSpecifications ?? {})) {
    if (expectedProduct.specifications[key] !== value)
      conflict("SPECIFICATION_CONFLICT", `Required ${key} is unmatched or unknown.`, `requiredSpecifications.${key}`);
  }
  if (constraints.bagMaxDimensionsCm) {
    const dimensions = sourceProduct.specs.dimensions as { unit?: string; height?: number; width?: number; depth?: number } | undefined;
    for (const [axis, limit] of Object.entries(constraints.bagMaxDimensionsCm)) {
      const measurement = dimensions?.[axis as "height" | "width" | "depth"];
      const cm = typeof measurement === "number" ? measurement * (dimensions?.unit === "in" ? 2.54 : 1) : null;
      if (sourceProduct.category !== "everyday-bags" || sourceProduct.specs.dimensionCaveat || !["cm", "in"].includes(dimensions?.unit ?? "") || cm === null)
        conflict("BAG_DIMENSIONS_UNKNOWN", "Supported exterior bag dimensions are unknown or have ambiguous axes; clarify fit.", `bagMaxDimensionsCm.${axis}`);
      else if (!Number.isFinite(limit) || limit! <= 0 || cm > limit!)
        conflict("BAG_DIMENSIONS_CONFLICT", `Documented exterior ${axis} ${cm} cm exceeds the accepted ${limit} cm limit.`, `bagMaxDimensionsCm.${axis}`);
    }
  }
  const hardware = Array.isArray(sourceOffer.setupHardware) ? sourceOffer.setupHardware : [];
  const setupCost = hardware.every(item => minor(item.priceMinor)) ? hardware.reduce((sum, item) => sum + item.priceMinor, 0) : null;
  return structuredClone({ product, offer, quantity, currency: sourceOffer.currency, destination,
    subtotal: minor(sourceOffer.unitPriceMinor) && Number.isSafeInteger(quantity) && quantity > 0 ? sourceOffer.unitPriceMinor * quantity : 0,
    setupCost, shipping: minor(sourceOffer.shippingMinor) ? sourceOffer.shippingMinor : null,
    tax: minor(sourceOffer.taxMinor) ? sourceOffer.taxMinor : null,
    otherFees: setupCost !== null && minor(sourceOffer.otherFeesMinor)
      ? sourceOffer.otherFeesMinor - setupCost : null,
    total, eligible: conflicts.length === 0, conflicts });
}
