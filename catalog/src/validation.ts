import type { Catalog, Constraints, Metrics, Offer, Product } from "./types.ts";
import { activeAudioIds } from "./microphones.ts";
import { buildKnownLinks } from "./media.ts";
const fail = (message: string): never => { throw new Error(message); };
const requireValue = (condition: unknown, message: string) => { if (!condition) fail(message); };
const validDate = (value: string) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const minor = (value: number) => Number.isSafeInteger(value) && value >= 0;
function finiteNumbers(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (value && typeof value === "object") return Object.values(value).every(finiteNumbers);
  return true;
}
function metricsValid(m: Metrics) {
  requireValue(m.rating === null || (typeof m.rating === "number" && Number.isFinite(m.rating) && m.rating >= 0 && m.rating <= 5), "INVALID_RATING");
  for (const key of ["ratingCount", "writtenReviewCount", "purchaseCount"] as const)
    requireValue(m[key] === null || minor(m[key]), `INVALID_${key}`);
  requireValue(m.reviewScope === null || typeof m.reviewScope === "string", "INVALID_REVIEW_SCOPE");
  requireValue((m.purchaseCount === null && m.purchaseCountPeriod === null) ||
    (m.purchaseCount !== null && typeof m.purchaseCountPeriod === "string" && m.purchaseCountPeriod.length > 0), "PURCHASE_PERIOD_MISMATCH");
}
export function validateCatalog(data: Catalog): void {
  requireValue(data.currency === "USD" && data.checkedOn === "2026-10-24", "INVALID_CATALOG_PROVENANCE");
  requireValue(validDate(data.scenarioNow) && data.timezone === "Asia/Singapore", "INVALID_SCENARIO_CLOCK");
  const unique = <T extends {id: string}>(rows: T[], name: string) => {
    requireValue(rows.every(row => typeof row.id === "string" && row.id.length > 0), `MISSING_${name}_ID`);
    requireValue(new Set(rows.map(row => row.id)).size === rows.length, `DUPLICATE_${name}_ID`);
    return new Map(rows.map(row => [row.id, row]));
  };
  const products = unique(data.products, "PRODUCT"), offers = unique(data.offers, "OFFER");
  const evidence = unique(data.evidence, "EVIDENCE"), sellers = unique(data.sellers, "SELLER");
  unique(data.scenarios, "SCENARIO"); unique(data.imageFixtures, "IMAGE");
  requireValue(data.products.length === 24, "EXPECTED_24_ACTIVE_PRODUCTS");
  requireValue(data.products.filter(p => p.category === "audio-accessories").length === 12 &&
    activeAudioIds.every(id => products.has(id)) &&
    data.products.filter(p => p.category === "everyday-bags").length === 6 &&
    data.products.filter(p => p.category === "bedsheet-sets").length === 6, "INVALID_CATEGORY_COUNTS");
  requireValue(new Set(data.products.map(p => p.variantId)).size === data.products.length, "DUPLICATE_VARIANT_ID");
  const references = (ids: string[], type: "product" | "seller", subjectId: string) => {
    requireValue(ids.length > 0 && new Set(ids).size === ids.length, "MISSING_OR_DUPLICATE_EVIDENCE");
    for (const id of ids) {
      const e = evidence.get(id);
      requireValue(e && e.subjectType === type && e.subjectId === subjectId, "INVALID_EVIDENCE_ASSOCIATION");
    }
  };
  for (const e of data.evidence) {
    requireValue(e.subjectType === "product" ? products.has(e.subjectId) : e.subjectType === "seller" && sellers.has(e.subjectId), "ORPHAN_EVIDENCE");
    requireValue(e.checkedOn === data.checkedOn && ["observed", "snapshot", "proxy"].includes(e.classification), "INVALID_EVIDENCE_PROVENANCE");
    requireValue(e.claim.length > 0, "MISSING_EVIDENCE_CLAIM");
    metricsValid(e);
    if (e.classification !== "proxy") {
      requireValue(e.sourceUrl !== null, "MISSING_SOURCE_URL");
      const source = new URL(e.sourceUrl!);
      requireValue(source.protocol === "https:" && !source.username && !source.password, "INVALID_SOURCE_URL");
      if (e.subjectType === "product") requireValue(products.get(e.subjectId)!.sourceUrls.includes(e.sourceUrl!), "UNASSOCIATED_SOURCE_URL");
    }
    if (e.media) requireValue(e.media.creator && e.media.topic && e.media.permission &&
      e.media.kind === "video" && /^https:\/\//.test(e.media.url), "INCOMPLETE_MEDIA_PROVENANCE");
  }
  for (const p of data.products) {
    requireValue(finiteNumbers(p.specs), "NONFINITE_SPECIFICATION");
    references(p.evidenceIds, "product", p.id); metricsValid(p.buyerMetrics);
    requireValue(p.checkedOn === data.checkedOn && p.sourceUrls.length > 0, "MISSING_PRODUCT_PROVENANCE");
    requireValue(p.referencePrice.currency === "USD" && p.referencePrice.payableTotalMinor === null &&
      (p.referencePrice.amountMinor === null || minor(p.referencePrice.amountMinor)), "INVALID_REFERENCE_PRICE");
    requireValue(p.image.url.startsWith("/catalog/images/") && p.image.alt && p.image.source && p.image.classification === "proxy", "INVALID_IMAGE");
    requireValue(p.video.status === "missing" ? !!p.video.reason :
      p.evidenceIds.includes(p.video.evidenceId) && !!evidence.get(p.video.evidenceId)?.media, "INVALID_VIDEO");
    if (p.authoredFit) requireValue(p.authoredFit.measuredPerformance === false &&
      [p.authoredFit.demo_cafe_fit, p.authoredFit.demo_office_fit].every(n => Number.isInteger(n) && n >= 1 && n <= 5), "INVALID_AUTHORED_FIT");
    const keys = p.category === "everyday-bags"
      ? ["dimensions", "capacityLitres", "weightGrams", "material", "compartments", "laptopFitInches"]
      : p.category === "bedsheet-sets"
        ? ["fittedWidthInches", "fittedLengthInches", "maxMattressDepthInches", "composition", "includedPieces", "care"] : [];
    requireValue(keys.every(key => Object.hasOwn(p.specs, key)), "MISSING_SPEC_FIELD");
    const productOffers = data.offers.filter(o => o.productId === p.id);
    requireValue(productOffers.length === 2, "EXPECTED_TWO_OFFERS");
    if (["out_of_stock", "unavailable", "discontinued", "discontinued_at_seller"].includes(p.sourceAvailability))
      requireValue(productOffers.every(o => o.availability !== "in_stock"), "NEGATIVE_STOCK_OVERWRITTEN");
  }
  for (const seller of data.sellers) references(seller.evidenceIds, "seller", seller.id);
  for (const o of data.offers) {
    const p = products.get(o.productId);
    requireValue(p && o.variantId === p.variantId && sellers.has(o.sellerId), "INVALID_OFFER_REFERENCE");
    references(o.evidenceIds, "seller", o.sellerId);
    requireValue(o.evidenceIds.some(id => evidence.get(id)?.sourceType === "fixture"), "MISSING_OFFER_FIXTURE_EVIDENCE");
    requireValue(o.currency === "USD" && o.classification === "proxy" && o.destination === data.destination, "INVALID_OFFER_SCOPE");
    requireValue([o.unitPriceMinor, o.shippingMinor, o.otherFeesMinor, o.taxMinor, o.totalMinor].every(minor), "INCOMPLETE_OR_INVALID_TOTAL");
    requireValue(o.unitPriceMinor + o.shippingMinor + o.otherFeesMinor + o.taxMinor === o.totalMinor, "TOTAL_MISMATCH");
    requireValue(["in_stock", "out_of_stock", "unavailable"].includes(o.availability), "INVALID_STOCK");
    requireValue(validDate(o.deliveryWindow.earliest) && validDate(o.deliveryWindow.latest) && validDate(o.orderCutoff) &&
      o.deliveryWindow.timezone === data.timezone &&
      Date.parse(o.orderCutoff) >= Date.parse(data.scenarioNow) &&
      Date.parse(o.deliveryWindow.earliest) >= Date.parse(o.orderCutoff) &&
      Date.parse(o.deliveryWindow.latest) >= Date.parse(o.deliveryWindow.earliest), "INVALID_DELIVERY_WINDOW");
    requireValue(o.returnTerms.length > 0 && o.conditions.length > 0, "MISSING_COMMERCIAL_CONDITIONS");
    requireValue(o.setupHardware.every(h => h.id && h.description && minor(h.priceMinor) && h.included), "INVALID_HARDWARE");
    requireValue(new Set(o.setupHardware.map(h => h.id)).size === o.setupHardware.length, "DUPLICATE_HARDWARE");
    requireValue(o.setupHardware.reduce((sum, h) => sum + h.priceMinor, 0) === o.otherFeesMinor, "HARDWARE_TOTAL_MISMATCH");
    const required = (p!.specs.compatibilityFixture as { requiredHardwareIds?: string[] } | undefined)?.requiredHardwareIds ?? [];
    requireValue(required.every(id => o.setupHardware.some(h => h.id === id)), "MISSING_SETUP_HARDWARE");
  }
  requireValue(data.scenarios.length === 3, "EXPECTED_THREE_SCENARIOS");
  for (const s of data.scenarios) {
    requireValue(products.has(s.anchorProductId) && s.now === data.scenarioNow && s.timezone === data.timezone && s.destination === data.destination, "INVALID_SCENARIO");
    for (const change of s.changes) requireValue(change.expectedOfferIds.every(id => offers.has(id)), "INVALID_SCENARIO_OFFER");
  }
  for (const fixture of data.imageFixtures) requireValue(fixture.productIds.length > 0 && fixture.productIds.every(id => products.has(id)), "INVALID_IMAGE_ASSOCIATION");
  requireValue(new Set(data.knownLinks.map(l => l.url)).size === data.knownLinks.length, "DUPLICATE_KNOWN_LINK");
  const canonicalLinks = buildKnownLinks(data.products);
  requireValue(data.knownLinks.length === canonicalLinks.length && data.knownLinks.every(link =>
    canonicalLinks.some(expected => expected.url === link.url && expected.productId === link.productId)), "INVALID_LINK_ASSOCIATION");
}

/** Selection helper only. Does not authorize a purchase or create a receipt. */
export function quoteOffer(data: Catalog, offerId: string, constraints: Constraints = {}, options: { now?: string; destination?: string; quantity?: number } = {}) {
  const offer = data.offers.find(o => o.id === offerId);
  if (!offer) throw new Error("UNKNOWN_OFFER");
  const product = data.products.find(p => p.id === offer.productId);
  if (!product || product.variantId !== offer.variantId) throw new Error("INVALID_OFFER_REFERENCE");
  const conflicts: string[] = [];
  const now = options.now ?? data.scenarioNow;
  if (!validDate(now)) conflicts.push("INVALID_CLOCK");
  if (!validDate(offer.orderCutoff) || !validDate(offer.deliveryWindow.earliest) ||
    !validDate(offer.deliveryWindow.latest) || offer.deliveryWindow.timezone !== data.timezone ||
    Date.parse(offer.deliveryWindow.earliest) < Date.parse(offer.orderCutoff) ||
    Date.parse(offer.deliveryWindow.latest) < Date.parse(offer.deliveryWindow.earliest)) conflicts.push("INVALID_DELIVERY_WINDOW");
  if ((options.quantity ?? 1) !== 1) conflicts.push("UNSUPPORTED_QUANTITY");
  if ((options.destination ?? data.destination) !== offer.destination) conflicts.push("UNSUPPORTED_DESTINATION");
  if ((constraints.currency ?? "USD") !== offer.currency) conflicts.push("CURRENCY_CONFLICT");
  const fields = [offer.unitPriceMinor, offer.shippingMinor, offer.otherFeesMinor, offer.taxMinor, offer.totalMinor];
  const complete = fields.every(minor) && offer.unitPriceMinor + offer.shippingMinor + offer.otherFeesMinor + offer.taxMinor === offer.totalMinor;
  if (!complete) conflicts.push("INCOMPLETE_TOTAL");
  if (offer.availability !== "in_stock") conflicts.push("UNAVAILABLE");
  if (validDate(now) && Date.parse(now) > Date.parse(offer.orderCutoff)) conflicts.push("CUTOFF_PASSED");
  if (constraints.budgetMinor !== undefined && (!minor(constraints.budgetMinor) || !complete || offer.totalMinor > constraints.budgetMinor)) conflicts.push("BUDGET_CONFLICT");
  if (constraints.deadline !== undefined && (!validDate(constraints.deadline) || Date.parse(offer.deliveryWindow.latest) > Date.parse(constraints.deadline))) conflicts.push("DELIVERY_CONFLICT");
  if (constraints.category && constraints.category !== product.category) conflicts.push("CATEGORY_CONFLICT");
  if (constraints.productId && constraints.productId !== product.id) conflicts.push("PRODUCT_CONFLICT");
  if (constraints.variantId && constraints.variantId !== offer.variantId) conflicts.push("VARIANT_CONFLICT");
  const atLeast = (requested: number | undefined, key: string, code: string) => {
    if (requested === undefined) return;
    const actual = product.specs[key];
    if (!Number.isFinite(requested) || requested <= 0 || typeof actual !== "number" || !Number.isFinite(actual) || actual < requested) conflicts.push(code);
  };
  atLeast(constraints.laptopInches, "laptopFitInches", "LAPTOP_FIT_UNKNOWN_OR_INCOMPATIBLE");
  atLeast(constraints.minimumCapacityL, "capacityLitres", "CAPACITY_CONFLICT");
  atLeast(constraints.mattressDepthIn, "maxMattressDepthInches", "MATTRESS_DEPTH_UNKNOWN_OR_INCOMPATIBLE");
  for (const [requested, key] of [[constraints.bedWidthIn, "fittedWidthInches"], [constraints.bedLengthIn, "fittedLengthInches"]] as const)
    if (requested !== undefined && product.specs[key] !== requested) conflicts.push("BED_DIMENSION_CONFLICT");
  if (constraints.separateShoeCompartment !== undefined && product.specs.separateShoeCompartment !== constraints.separateShoeCompartment) conflicts.push("SHOE_COMPARTMENT_UNKNOWN_OR_INCOMPATIBLE");
  if (constraints.composition && constraints.composition !== product.specs.compositionLabel) conflicts.push("COMPOSITION_CONFLICT");
  if (product.category === "audio-accessories") {
    const path = product.specs.compatibilityFixture as {supportedHostConnections: string[]; requiredHardwareIds: string[]};
    if (!constraints.hostConnection) conflicts.push("HOST_CONNECTION_REQUIRED");
    else if (!path.supportedHostConnections.includes(constraints.hostConnection)) conflicts.push("INCOMPATIBLE_HARDWARE");
    if (path.requiredHardwareIds.some(id => !offer.setupHardware.some(h => h.id === id && h.included))) conflicts.push("MISSING_SETUP_HARDWARE");
  }
  if (product.category === "bedsheet-sets") {
    if (constraints.bedWidthIn === undefined || constraints.bedLengthIn === undefined || constraints.mattressDepthIn === undefined) conflicts.push("BED_MEASUREMENTS_REQUIRED");
    if (product.specs.includedPieces === null || product.specs.care === null) conflicts.push("ESSENTIAL_PRODUCT_DETAILS_UNKNOWN");
  }
  return { offerId, productId: product.id, totalMinor: complete ? offer.totalMinor : null, currency: offer.currency,
    eligible: conflicts.length === 0, conflicts, classification: "proxy" as const };
}
export function eligibleOffers(data: Catalog, constraints: Constraints, options: Parameters<typeof quoteOffer>[3] = {}) {
  return data.offers.map(o => quoteOffer(data, o.id, constraints, options)).filter(q => q.eligible);
}
