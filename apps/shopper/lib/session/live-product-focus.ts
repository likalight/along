import type { Session } from "./contract";

const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[øØ]/g, "o")
    .replace(/\+/g, " plus ")
    .replace(/([a-z])([0-9])/gi, "$1 $2")
    .replace(/([0-9])([a-z])/gi, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

type Mention = { id: string; start: number; end: number };

/** Presentation only: these matches cannot change accepted selections or approvals. */
export function mentionedProduct(
  caption: string,
  snapshot: Pick<Session, "catalog" | "displayOrder">,
): string | null {
  const text = ` ${normalize(caption)} `;
  const visible = new Set(snapshot.displayOrder);
  const aliases = new Map<string, Set<string>>();
  for (const product of snapshot.catalog?.products ?? []) {
    if (!visible.has(product.id)) continue;
    const model = product.model.replace(/\([^)]*\)/g, " ").trim();
    for (const value of [
      product.title,
      product.model,
      model,
      `${product.brand} ${model}`,
    ]) {
      const alias = normalize(value);
      // An adjective alone is not a defensible product identity.
      if (
        !alias ||
        /^(mini|pro|plus|max|black|white|wireless|usb|desktop|headset)$/.test(
          alias,
        )
      )
        continue;
      const ids = aliases.get(alias) ?? new Set<string>();
      ids.add(product.id);
      aliases.set(alias, ids);
    }
  }
  const mentions: Mention[] = [];
  for (const [alias, ids] of aliases) {
    if (ids.size !== 1) continue;
    const id = [...ids][0];
    const needle = ` ${alias} `;
    let start = text.indexOf(needle);
    while (start !== -1) {
      const end = start + needle.length - 1;
      // Wait for a disambiguating word when a streamed name is also the prefix
      // of another visible model (for example "Wireless Go" / "Wireless Go II").
      const trailing = text.slice(end).trim();
      const unfinishedVariant = [...aliases].some(
        ([other, otherIds]) =>
          other.startsWith(`${alias} `) &&
          other.slice(alias.length + 1).startsWith(trailing) &&
          [...otherIds].some((otherId) => otherId !== id),
      );
      if (!unfinishedVariant) mentions.push({ id, start, end });
      start = text.indexOf(needle, start + 1);
    }
  }
  const numbers = [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
  ];
  const ordinals = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
  ];
  const option =
    /\b(?:option|choice|pick|number) (\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|\b(?:the )?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) (?:option|choice|pick|one)\b/g;
  for (const match of text.matchAll(option)) {
    const index = match[2]
      ? ordinals.indexOf(match[2])
      : /^\d+$/.test(match[1])
        ? Number(match[1]) - 1
        : numbers.indexOf(match[1]);
    const id = snapshot.displayOrder[index];
    if (id && snapshot.catalog?.products.some((product) => product.id === id))
      mentions.push({
        id,
        start: match.index,
        end: match.index + match[0].length,
      });
  }
  // The latest complete identity is the subject currently being discussed.
  // Prefer the full name over a shorter overlapping model alias.
  mentions.sort((a, b) => b.end - a.end || a.start - b.start);
  const latest = mentions[0];
  if (!latest) return null;
  if (
    mentions.some(
      (mention) =>
        mention.end === latest.end &&
        mention.start === latest.start &&
        mention.id !== latest.id,
    )
  )
    return null;
  return latest.id;
}

/** Tracks cumulative captions without replaying names from a superseded canvas. */
export class LiveProductFocus {
  private caption = "";
  private boundary = 0;
  private blocked = false;
  productId: string | null = null;

  clear(blocked = false) {
    this.boundary = this.caption.length;
    this.productId = null;
    this.blocked = blocked;
  }

  /** The adapter has drained interrupted audio and begun a fresh output window. */
  beginOutput() {
    this.caption = "";
    this.boundary = 0;
    this.productId = null;
    this.blocked = false;
  }

  accept(text: string, snapshot: Session | null) {
    if (!text.startsWith(this.caption)) {
      // The adapter caps caption history. Preserve the reset boundary when the
      // same utterance rolls forward, rather than replaying the retained prefix.
      let overlap = -1;
      if (text.length >= 32) {
        let start = this.caption.indexOf(text.slice(0, 32), 1);
        while (start !== -1) {
          if (text.startsWith(this.caption.slice(start))) {
            overlap = start;
            break;
          }
          start = this.caption.indexOf(text.slice(0, 32), start + 1);
        }
      }
      this.boundary = overlap < 0 ? 0 : Math.max(0, this.boundary - overlap);
    }
    this.caption = text;
    if (this.blocked) {
      this.boundary = text.length;
      return null;
    }
    if (!snapshot) return null;
    const productId = mentionedProduct(text.slice(this.boundary), snapshot);
    if (productId) this.productId = productId;
    return this.productId;
  }
}
