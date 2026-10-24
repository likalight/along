const small = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const number = `(?:\\d+(?:\\.\\d+)?|(?:${small.join("|")})|(?:${tens.join("|")})(?:[ -](?:${small.slice(1, 10).join("|")}))?)`;
const days = `(${number})\\s*(?:[- ]\\s*)?days?`;
const litres = `(${number})\\s*(?:[- ]\\s*)?(?:litres?|liters?|l)\\b`;
const shoe = "(?:a |the |my )?(?:separate )?shoe compartment";

function quantity(value: string) {
  if (/^\d/.test(value)) return Number(value);
  const words = value.split(/[ -]/);
  const single = small.indexOf(words[0]!);
  if (single >= 0) return single;
  return (tens.indexOf(words[0]!) + 2) * 10 +
    (words.length === 2 ? small.indexOf(words[1]!) : 0);
}

/** This checks the shopper's current request, never a model's proposed rewrite.
 * Bounded request forms allow explicit relaxations without treating product
 * descriptions, quotes, or hypothetical alternatives as permission. */
function statement(text: string): string | undefined {
  if (typeof text !== "string" || text.length > 4000 || /["“”`]/.test(text)) return;
  let value = text.toLowerCase().replace(/’/g, "'").replace(/\bi'm\b/g, "i am").trim();
  if (/(?:^|\s)'[^']+'(?:\s|$)|\b(?:what if|if|maybe|perhaps|hypothetically|suppose|for example)\b/.test(value)) return;
  value = value.replace(/^(?:(?:actually|okay|ok|yes|sorry)[,\s]+|no,\s*)+/, "");
  // A routine request to show the resulting options is independent of consent.
  value = value.replace(
    /(?:[.,;]\s*|\s+(?:and|then)\s+)(?:please\s+)?show(?: me)?(?: (?:some|the|matching|other))? (?:options|products|bags)[.!?]*$/,
    "",
  );
  const directQuestion = /^(?:(?:can|could|would) you|(?:can|could) we)\s+/.test(value);
  if (value.includes("?") && !directQuestion) return;
  return value
    .replace(/^(?:(?:can|could|would) you|(?:can|could) we)\s+/, "")
    .replace(/^please\s+/, "")
    .replace(/[.!?]+$/, "")
    .replace(/,?\s+please$/, "")
    .trim();
}

function matchesQuantity(text: string, proposed: number, patterns: string[]) {
  if (!Number.isFinite(proposed) || proposed <= 0) return false;
  const value = statement(text);
  if (!value) return false;
  return patterns.some((pattern) => {
    const match = value.match(new RegExp(`^(?:${pattern})(?: instead| now)?$`));
    return Boolean(match && quantity(match[1]!) === proposed);
  });
}

/** Accept a named new delivery allowance only when the shopper requests it. */
export function allowsDeliveryExtension(text: string, proposedDays: number): boolean {
  return matchesQuantity(text, proposedDays, [
    `i (?:can|am (?:happy|willing) to) wait (?:up to |for )?${days}`,
    `(?:delivery |shipping )?(?:within |in |up to )?${days} (?:is|would be) (?:fine|okay|ok|acceptable)(?: (?:for|with) me)?`,
    `(?:change|set|extend|increase|update|make) (?:the |my )?(?:delivery(?: deadline| allowance| window)?|shipping(?: deadline)?|deadline) (?:to |at |within )?${days}`,
    // Only the destination amount authorizes the new value.
    `(?:change|extend|increase|update) (?:the |my )?(?:delivery(?: deadline| allowance| window)?|shipping(?: deadline)?|deadline) from (?:${number})\\s*days? to ${days}`,
  ]);
}

/** Accept a named smaller minimum; an item's advertised capacity is not consent. */
export function allowsCapacityReduction(text: string, proposedLitres: number): boolean {
  return matchesQuantity(text, proposedLitres, [
    `(?:a minimum of |a |minimum (?:capacity )?(?:of )?)?${litres} (?:is|would be) (?:enough|fine|okay|ok|sufficient)(?: for me)?`,
    `(?:a |an )?${litres} bag (?:is|would be) (?:enough|fine|okay|ok|sufficient)(?: for me)?`,
    `i (?:only )?(?:need|want) (?:a minimum of |at least )?${litres}`,
    `i can (?:manage|make do) with (?:a |an )?${litres}(?: bag)?`,
    `(?:change|set|lower|reduce|update|make) (?:the |my )?(?:minimum(?: capacity)?|capacity(?: minimum)?|minimum size) (?:to |at )?${litres}`,
    `(?:change|lower|reduce|update) (?:the |my )?(?:minimum(?: capacity)?|capacity(?: minimum)?) from (?:${number})\\s*(?:litres?|liters?|l) to ${litres}`,
  ]);
}

/** Removing a hard feature requirement needs the shopper's own explicit request. */
export function allowsRemovingShoeCompartment(text: string): boolean {
  const value = statement(text);
  if (!value) return false;
  const patterns = [
    `i (?:do not|don't|no longer) need ${shoe}`,
    `${shoe} (?:is not|isn't|is no longer) (?:necessary|required|essential|a must)`,
    `(?:remove|drop) (?:the |my )?(?:separate )?shoe compartment requirement`,
    `(?:remove|drop) (?:the |my )?requirement for ${shoe}`,
    `make ${shoe} optional`,
    `(?:a bag|bags|options|products) without ${shoe} (?:is|are) (?:fine|okay|ok|acceptable)(?: (?:for|with) me)?`,
    `i (?:can (?:go|manage)|am (?:fine|okay|ok)) without ${shoe}`,
  ];
  return patterns.some((pattern) => new RegExp(`^(?:${pattern})(?: now| anymore)?$`).test(value));
}
