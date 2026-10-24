import type { Constraints, Quote } from "@concierge/backend/contracts";
import type { DiscoveryAssessment, DiscoveryReference } from "@coupang/contract";
import { getProduct } from "../fixtures/catalog.js";

const number = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const money = (amount: number, currency: string) => `${currency} ${amount.toFixed(2)}`;

/** External labels never become specifications, constraints, or checkout identity. */
export function assessDiscovery(
  reference: DiscoveryReference,
  context: { constraints: Constraints; needs: string[]; quotes: (category: string) => Iterable<Quote> },
): DiscoveryAssessment {
  const { constraints: c } = context;
  const candidate = reference.candidate;
  const product = reference.mode === "demo" && candidate.catalogProductId
    ? getProduct(candidate.catalogProductId) : undefined;
  const specs = product?.specs ?? {};
  const checks: DiscoveryAssessment["checks"] = [];
  const requirements = [...context.needs];
  const questions: string[] = [];
  const add = (key: string, label: string, status: "match" | "conflict" | "unknown", detail: string, source: "catalog" | "listing" | "unknown" = "unknown") =>
    checks.push({ key, label, status, detail, source });
  const compareNumber = (key: string, label: string, wanted: number | undefined, actual: unknown, unit: string, question: string, direction: "minimum" | "equal" = "minimum") => {
    if (wanted === undefined) return;
    requirements.push(`${label}: ${wanted}${unit}`);
    const value = number(actual);
    if (value === undefined) {
      add(key, label, "unknown", `Your requirement is ${wanted}${unit}; the exact external item's ${label.toLowerCase()} is unverified.`);
      questions.push(question);
    } else {
      const fits = direction === "equal" ? value === wanted : value >= wanted;
      add(key, label, fits ? "match" : "conflict", `Demo catalog ${product!.id} states ${value}${unit}; your requirement is ${wanted}${unit}. This is not verification of the external listing.`, "catalog");
      if (!fits) questions.unshift(question);
    }
  };

  compareNumber("laptop", "Laptop support", c.laptopInches ?? c.compatibility?.laptopInches,
    specs.laptopFitInches, " inches", "Can you check the exact bag's usable laptop compartment dimensions against your laptop's width, height and thickness?");
  compareNumber("capacity", "Minimum capacity", c.minimumCapacityL, specs.capacityLitres, " L",
    "Does the exact listing state its usable capacity in litres?");
  compareNumber("bed_width", "Fitted sheet width", c.bedWidthIn ?? c.compatibility?.bedWidthInches,
    specs.fittedWidthInches, " inches", "Does the exact fitted sheet's width and length match your mattress measurements?", "equal");
  compareNumber("bed_length", "Fitted sheet length", c.bedLengthIn ?? c.compatibility?.bedLengthInches,
    specs.fittedLengthInches, " inches", "Does the exact fitted sheet's width and length match your mattress measurements?", "equal");
  compareNumber("mattress_depth", "Mattress depth support", c.mattressDepthIn ?? c.compatibility?.mattressDepthInches,
    specs.maxMattressDepthInches, " inches", "Does the exact fitted sheet's pocket depth cover your mattress depth?");
  if (c.separateShoeCompartment) {
    requirements.push("Separate shoe compartment");
    const actual = specs.separateShoeCompartment;
    add("shoe_compartment", "Separate shoe compartment", typeof actual === "boolean" ? actual ? "match" : "conflict" : "unknown",
      typeof actual === "boolean" ? `Demo catalog ${product!.id} ${actual ? "has" : "does not have"} a separate shoe compartment; this is not verification of the external item.` : "The exact external item's compartment layout is unverified.",
      typeof actual === "boolean" ? "catalog" : "unknown");
    if (actual !== true) questions.push("Does the exact bag have a separate compartment for your shoes?");
  }
  if (c.composition) {
    requirements.push(`Composition: ${c.composition}`);
    const actual = typeof specs.compositionLabel === "string" ? specs.compositionLabel : undefined;
    add("composition", "Composition", actual ? actual.toLowerCase() === c.composition.toLowerCase() ? "match" : "conflict" : "unknown",
      actual ? `Demo catalog ${product!.id} states ${actual}; your exact saved composition requirement is ${c.composition}. This does not verify the external item.` : `Your requirement is ${c.composition}; the exact external item's fibre composition is unverified.`, actual ? "catalog" : "unknown");
    if (!actual) questions.push("Does the exact listing state the full fibre composition?");
  }
  const host = c.hostConnection ?? c.compatibility?.hostConnection;
  if (host) {
    requirements.push(`Computer connection: ${host}`);
    add("connection", "Connection setup", "unknown", `Your computer connection is ${host}; the external product's connector and required adapters are unverified.`);
    questions.push("Does the exact product list a compatible connector and any required adapter?");
  }
  if (c.bagMaxDimensionsCm || c.requiredSpecifications) {
    for (const [key, value] of Object.entries({ ...(c.bagMaxDimensionsCm ? { bagMaxDimensionsCm: c.bagMaxDimensionsCm } : {}), ...c.requiredSpecifications })) {
      const required = `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`;
      requirements.push(required);
      add(`spec_${key}`, key, "unknown", `Saved requirement ${required}; this reference does not verify it.`);
    }
  }
  if (c.budgetMinor !== undefined) {
    const currency = c.currency ?? "USD", budget = c.budgetMinor / 100;
    requirements.push(`Budget: ${money(budget, currency)}`);
    const price = candidate.price;
    if (!price) add("budget", "Complete cost", "unknown", `Your budget is ${money(budget, currency)}. The external price, delivery costs and taxes are unknown.`);
    else if (price.currency !== currency) add("budget", "Complete cost", "unknown", `The reported ${money(price.amount, price.currency)} cannot be compared with your ${money(budget, currency)} budget without a current exchange rate and delivered total. No currency conversion was assumed.`, "listing");
    else if (price.amount > budget) add("budget", "Complete cost", "conflict", `The reported item price of ${money(price.amount, currency)} already exceeds your ${money(budget, currency)} budget before delivery and taxes. Recheck the exact listing's current price.`, "listing");
    else add("budget", "Complete cost", "unknown", `The reported item price is ${money(price.amount, currency)} against your ${money(budget, currency)} budget; delivery and taxes are missing, so affordability is not confirmed.`, "listing");
    if (!questions.length) questions.push("What is the exact listing's delivered total, including taxes, in your budget currency?");
  }
  if (c.deliveryWithinDays !== undefined || c.deadline) {
    const target = c.deliveryWithinDays !== undefined ? `${c.deliveryWithinDays} days` : c.deadline!;
    requirements.push(`Delivery: ${target}`);
    add("delivery", "Delivery", "unknown", `You need delivery within/by ${target}; the external item's delivery to your destination is unverified.`);
    if (!questions.length) questions.push("Does the exact seller show delivery to your destination before your deadline?");
  }
  add("identity", "Exact item", "unknown", candidate.linkKind === "search"
    ? "This is a search destination, not a verified product listing. Similar appearance does not prove the same model or variant."
    : "The reported match has not independently verified the exact model, variant, seller or availability.");

  // Only accepted category or a demo catalog bridge selects the comparison pool.
  // A social caption/title cannot silently set a shopper requirement.
  const category = c.category ?? (product?.category === "bags" ? "everyday-bags" : product?.category === "bedding" ? "bedsheet-sets" : product?.category === "audio" ? "audio-accessories" : undefined);
  const cheapest = new Map<string, Quote>();
  if (category) for (const quote of context.quotes(category)) {
    if (quote.product.category !== category || !quote.eligible || quote.total === null) continue;
    const previous = cheapest.get(quote.product.id);
    if (!previous || quote.total < previous.total!) cheapest.set(quote.product.id, quote);
  }
  const alternatives = [...cheapest.values()].sort((a, b) => a.total! - b.total! || a.product.id.localeCompare(b.product.id)).slice(0, 3).map(quote => ({
    productId: quote.product.id, title: quote.product.name, offerId: quote.offer.id,
    total: { amount: quote.total! / 100, currency: quote.currency },
    reason: "Passes the current catalog offer checks for your saved hard requirements; free-form needs still need discussion.",
    compromises: [...quote.product.limitations, ...quote.offer.uncertainties].slice(0, 3),
  }));
  return {
    requirements: [...new Set(requirements)], checks,
    nextQuestion: questions[0] ?? (requirements.length ? "Can you open the exact listing so its model, variant and seller can be checked?" : "What matters most for this item: fit, complete cost, or something else?"),
    alternatives,
    alternativesNotice: "These are separate catalog products with simulated offers, not verified Coupang matches or live prices. Nothing is selected. Explicitly return to the catalog to choose one.",
  };
}
