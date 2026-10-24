/** Presentation labels only. Keep canonical IDs, offers, terms, and receipt
 * metadata intact for quote validation and accepted-order verification. */
export function customerSellerLabel(id: string): string {
  if (/^(?:DEMO[-_])?VALUE$/i.test(id)) return "Value option";
  if (/^(?:DEMO[-_])?EXPRESS$/i.test(id)) return "Express option";
  return customerCopy(id.replace(/[-_]/g, " "));
}

export function customerDestinationLabel(destination: string): string {
  return /^(?:DEMO[-_ ]DESTINATION|Demo destination)/i.test(destination)
    ? "Selected delivery destination"
    : destination;
}

export function customerCopy(text: string): string {
  const value = text.trim();
  if (!value) return "";
  // The persistent catalog/receipt notices disclose the simulation. Product
  // notes keep the concrete uncertainty without repeating that global notice.
  if (
    /^(?:Simulated purchase only;|All offer prices, destination eligibility|Tax is explicitly zero in this fictional scenario)/i.test(
      value,
    )
  )
    return "";
  if (/^Known negative source availability is retained;/i.test(value))
    return "Availability must be checked before purchase.";
  if (/^Synthetic offer; real seller stock/i.test(value))
    return "Seller stock, delivery service, fees and fulfillment still need verification.";
  if (/^Required demo setup hardware is included/i.test(value))
    return "Required setup hardware is included in the fees shown.";
  if (/^Host paths are bounded simulation fixtures;/i.test(value))
    return "Compatibility with your device still needs checking.";
  if (/^Unknown [—–-] see separately labelled simulated setup/i.test(value))
    return "Setup requirements still need checking.";
  if (/^Neutral demo color is not a verified retail SKU/i.test(value))
    return "Colour availability needs confirmation.";
  if (/^Demo color differs from the linked retail variant/i.test(value))
    return "The colour shown may differ from the linked product variant.";
  if (/^Demo color, seller, price and delivery are authored fixtures, not verified retail offers\.$/i.test(value))
    return "Colour availability, seller pricing and delivery still need verification.";
  if (
    /^Demo package assumptions are separate from sourced specifications/i.test(
      value,
    )
  )
    return "Confirm the package contents before purchase.";
  return value
    .replace(/^DEMO:\s*/i, "")
    .replace(/\s*\((?:simulated|hypothetical|demo)\)/gi, "")
    .replace(/\bsimulated delivery\b/gi, "delivery")
    .replace(/\b(?:simulated|demo) offers?\b/gi, (match) =>
      match.endsWith("s") ? "offers" : "offer",
    )
    .replace(/\b(?:demo|simulated) setup hardware\b/gi, "setup hardware")
    .replace(/\bSynthetic window\b/g, "Delivery window")
    .replace(/\bProxy estimate:\s*/gi, "Delivery estimate: ")
    .replace(/\bthe demo order\b/gi, "the order")
    .replace(/; no real fulfillment\.?/gi, "")
    .replace(/\bthis (?:declared|synthetic) fixture\b/gi, "this configuration")
    .replace(
      /\bthis fixture's documented hardware path\b/gi,
      "the documented connection options",
    )
    .replace(
      /\bThese shipping and hardware fixtures support\b/g,
      "This offer supports",
    )
    .replace(
      /The demo has no unit serial number, so its offers are withheld pending verification\./g,
      "A unit serial number is needed to check this recall. Offers remain unavailable until verification.",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function customerNotes(notes: readonly string[]): string[] {
  return [...new Set(notes.map(customerCopy).filter(Boolean))];
}

export function acceptedDeliveryLabel(window: Record<string, unknown>): string {
  const latest = window.latestAt ?? window.latest;
  const earliest = window.earliestAt ?? window.earliest;
  const zone =
    typeof window.timeZone === "string"
      ? window.timeZone
      : typeof window.timezone === "string"
        ? window.timezone
        : "Asia/Singapore";
  const suffix = zone === "Asia/Singapore" ? " SGT" : ` ${zone}`;
  if (typeof latest === "string" && Number.isFinite(Date.parse(latest))) {
    const format = new Intl.DateTimeFormat("en-SG", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zone,
    });
    if (
      typeof earliest === "string" &&
      Number.isFinite(Date.parse(earliest)) &&
      Date.parse(earliest) <= Date.parse(latest)
    )
      return `${format.format(new Date(earliest))} – ${format.format(new Date(latest))}${suffix}`;
    return `By ${format.format(new Date(latest))}${suffix}`;
  }
  const days = window.latestOffsetDays;
  return typeof days === "number" && Number.isInteger(days) && days >= 0
    ? `Within ${days} day${days === 1 ? "" : "s"}`
    : "Delivery estimate unavailable";
}

export function purchaseConfirmation(
  category: string | null,
  delivery: string,
): string {
  const encouragement =
    category === "audio"
      ? "Enjoy your new setup."
      : category === "bags"
        ? "Hope it makes your everyday carry a little easier."
        : category === "bedsheets"
          ? "Hope it helps you settle in comfortably."
          : "Hope you enjoy it.";
  const estimate =
    delivery === "Delivery estimate unavailable"
      ? "Your delivery estimate is not available yet."
      : `Expected delivery: ${delivery.charAt(0).toLowerCase()}${delivery.slice(1)}.`;
  return `Your order is confirmed. ${estimate} ${encouragement}`;
}
