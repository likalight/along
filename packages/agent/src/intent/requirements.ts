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
