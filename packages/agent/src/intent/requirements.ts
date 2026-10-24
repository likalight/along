/** Bounded parser for deterministic integration rehearsal, not the live AI extractor. */
export function parseBudget(text: string): number | undefined {
  const m =
    text.match(
      /(?:under|budget(?: of)?|no more than|at most|less than|cost(?:s)?(?: no more than)?|up to)\s*(?:USD\s*|\$)?(\d+(?:\.\d{1,2})?)/i,
    ) ??
    text.match(/\$(\d+(?:\.\d{1,2})?)/) ??
    text.match(/(\d+(?:\.\d{1,2})?)\s*(?:dollars|USD)\b/i);
  return m ? Math.round(Number(m[1]) * 100) : undefined;
}

const smallNumbers = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const tens = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const numberWords = [...smallNumbers, ...tens, "hundred", "thousand", "and", "a"].join("|");
const amountNumber = `(?:\\d+(?:\\.\\d{1,2})?|(?:${numberWords})(?:[ -]+(?:${numberWords}))*)`;
const currency = "(?:dollars?|bucks|USD)";
const amount = `(?:(?:USD\\s*|\\$\\s*)?${amountNumber}(?:\\s*${currency})?)`;
const currencyAmount = `(?:(?:USD\\s*|\\$\\s*)${amountNumber}(?:\\s*${currency})?|${amountNumber}\\s+${currency})`;
const approximate = "(?:(?:around|about|roughly|approximately|under|up to|at most|no more than)\\s+)?";

function spokenWholeNumber(text: string): number | undefined {
  const words = text.split(/[ -]+/);
  const underHundred = (part: string[]): number | undefined => {
    if (!part.length) return 0;
    const small = smallNumbers.indexOf(part[0]!);
    if (part.length === 1 && small !== -1) return small;
    const ten = tens.indexOf(part[0]!);
    if (ten === -1 || part.length > 2) return undefined;
    const unit = part.length === 2 ? smallNumbers.indexOf(part[1]!) : 0;
    return unit >= (part.length === 2 ? 1 : 0) && unit <= 9 ? (ten + 2) * 10 + unit : undefined;
  };
  const underThousand = (part: string[]): number | undefined => {
    const hundred = part.indexOf("hundred");
    if (hundred === -1) return underHundred(part);
    if (hundred !== 1) return undefined;
    const multiplier = part[0] === "a" ? 1 : smallNumbers.indexOf(part[0]!);
    const remainder = part.slice(part[2] === "and" ? 3 : 2);
    if (multiplier < 1 || multiplier > 9 || part.at(-1) === "and") return undefined;
    const rest = underHundred(remainder);
    return rest === undefined ? undefined : multiplier * 100 + rest;
  };
  const thousand = words.indexOf("thousand");
  if (thousand === -1) return underThousand(words);
  const leading = words.slice(0, thousand);
  const multiplier = leading.length === 1 && leading[0] === "a" ? 1 : underThousand(leading);
  const rest = underThousand(words.slice(words[thousand + 1] === "and" ? thousand + 2 : thousand + 1));
  if (!multiplier || rest === undefined || words.at(-1) === "and") return undefined;
  return multiplier * 1000 + rest;
}

function amountMinor(text: string): number | undefined {
  const number = text.replace(/^(?:USD\s*|\$\s*)/i, "").replace(/\s*(?:dollars?|bucks|USD)$/i, "").trim();
  const value = /^\d/.test(number) ? Number(number) : spokenWholeNumber(number);
  if (value === undefined) return undefined;
  const minor = Math.round(value * 100);
  return Number.isSafeInteger(minor) ? minor : undefined;
}

/**
 * A bounded consent check for a budget increase, not a price extractor. Match a
 * shopper's own amount or explicit correction, never an incidental product price.
 * Speech transcripts commonly contain number words instead of currency digits.
 */
export function parseBudgetUpdate(text: string): number | undefined {
  if (/["“”‘]/.test(text) || /(?:^|\s)'[^']+'(?:\s|[.,!?]|$)/.test(text) || /\b(?:what if|if|suppose|hypothetically|for example)\b/i.test(text)) return undefined;
  const statements = text.trim().toLowerCase().replace(/’/g, "'").split(/(?<=[.!?])\s+(?=[a-z])/);
  let latest: number | undefined;
  for (const statement of statements) {
    const direct = parseBudgetStatement(statement);
    if (direct !== undefined) {
      latest = direct;
      continue;
    }
    // An ordinary sentence can contain a budget clause alongside a product
    // request. Only explicit budget clauses qualify here, not isolated prices.
    for (const clause of statement.split(/[,;]/)) {
      if (!/^\s*(?:(?:actually|please)\s+)?(?:(?:my|the) budget|(?:set|change|raise|increase|update|make)(?: my| the)? budget)\b/.test(clause)) continue;
      const value = parseBudgetStatement(clause);
      if (value !== undefined) latest = value;
    }
  }
  return latest;
}

function parseBudgetStatement(text: string): number | undefined {
  const statement = text.trim()
    .replace(/^(?:can|could|would) you (?:please )?(?=(?:set|change|raise|increase|update|make)(?: my| the)? budget\b)(.*)\?$/, "$1")
    .replace(/[.!]+$/, "")
    .replace(/^(?:(?:actually|sorry|okay|ok|yes)[,\s]+|no,\s*)+/, "")
    .replace(/^please\s+/, "")
    .replace(/,?\s+actually$/, "")
    .replace(/,?\s+please$/, "")
    .replace(/(?:[,;]\s*(?:and\s+)?|\s+(?:and|then)\s+)(?:please\s+)?show(?: me)?(?: (?:some|the))? (?:options|products)$/, "")
    .trim();
  const patterns = [
    // The new amount is the destination, not the first amount in the transcript.
    `^(?:(?:change|raise|increase|update)(?: it| my budget| the budget)? )?from ${amount} to (${amount})$`,
    `^not ${amount},?\\s+(?:but\\s+)?(${amount})$`,
    `^(?:${approximate})(${currencyAmount})(?:,?\\s+not ${amount})?$`,
    `^(?:(?:my|the) )?budget(?: is(?: now)?| should be| of|:)?\\s+${approximate}(${amount})(?:,?\\s+not ${amount})?$`,
    `^(?:set|change|raise|increase|update|make)(?: my| the)? budget (?:to|at) ${approximate}(${amount})$`,
    `^(?:i (?:can spend|can afford|want to spend|meant|mean)|(?:i think )?i can go up to|let's (?:do|make it|say)) ${approximate}(${amount})(?:,?\\s+not ${amount})?$`,
  ];
  for (const pattern of patterns) {
    const matched = statement.match(new RegExp(pattern, "i"));
    if (matched) return amountMinor(matched[1]!);
  }
  return undefined;
}
export function parseCompatibility(text: string) {
  const c: Record<string, unknown> = {};
  const host = text.match(/\b(usb[- ]?[ac])\b/i);
  if (host)
    c.hostConnection = host[1]!
      .toLowerCase()
      .replace(" ", "-")
      .replace(/^usb([ac])$/, "usb-$1");
  const lap = text.match(/(\d+(?:\.\d+)?)\s*[- ]?inch\s+laptop/i);
  if (lap) c.laptopInches = Number(lap[1]);
  const bed = text.match(
    /(\d+(?:\.\d+)?)\s*(?:by|x|×)\s*(\d+(?:\.\d+)?)\s*(?:inch|inches)/i,
  );
  if (bed) {
    c.bedWidthInches = Number(bed[1]);
    c.bedLengthInches = Number(bed[2]);
  }
  const depth = text.match(
    /(\d+(?:\.\d+)?)\s*[- ]?inch(?:es)?\s*(?:deep|mattress)/i,
  );
  if (depth) c.mattressDepthInches = Number(depth[1]);
  return c;
}
