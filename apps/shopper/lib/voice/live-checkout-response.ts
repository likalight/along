import type { Quote } from "@concierge/backend/contracts";
import type { Summary } from "../session/contract";
import { customerCopy, customerSellerLabel } from "../canvas/customer-copy";
import { ORDER_APPROVAL_QUESTION } from "./live-approval-context";

/** A spoken review of the accepted order; the exact server review remains on screen. */
export function compactLiveOrderReview(summary: Summary, quote: Quote): string {
  const product = customerCopy(quote.product.name);
  const variant = /^[A-Z]+-\d+-DEMO$/i.test(quote.product.variant)
    ? String(
        quote.product.specifications.sourceVariant ??
          quote.product.canonical?.model ??
          "",
      )
    : customerCopy(quote.product.variant);
  const variantLabel =
    variant && !product.toLowerCase().includes(variant.toLowerCase())
      ? `, ${variant}`
      : "";
  const seller = /^DEMO[-_]/i.test(quote.offer.sellerId ?? "")
    ? customerSellerLabel(quote.offer.sellerId!)
    : customerCopy(quote.offer.sellerName);
  // These describe the fixture implementation, not additional order terms.
  // Quantity and priced setup are already stated in this review.
  const boilerplate =
    /^(?:Simulated purchase only|Demonstration only|All offer prices|All prices, stock, tax|Tax is explicitly zero|All current catalog records|Known negative source availability|Synthetic offer; real seller stock|Quantity one only;|Required demo setup hardware)/i;
  const setupText =
    quote.offer.setupConditions &&
    !/^No additional setup hardware/i.test(quote.offer.setupConditions)
      ? customerCopy(
          quote.offer.setupConditions.replace(/^[a-z0-9-]+:\s*/i, ""),
        )
      : "";
  const setup =
    quote.offer.canonical?.setupHardware?.length &&
    typeof quote.setupCost === "number" &&
    quote.setupCost > 0 &&
    /; [A-Z]{3} \d+\.\d{2} included in the total\.$/.test(setupText)
      ? `${quote.currency} ${(quote.setupCost / 100).toFixed(2)} setup included.`
      : setupText;
  const returns = customerCopy(quote.offer.returnConditions).replace(
    /^return (unused\/unwashed|unused) in original packaging within (\d+) days of delivery; item price refunded, outbound shipping excluded, ([A-Z]{3} [\d.]+) return postage\.$/i,
    "Returns within $2 days, $1 in original packaging; item price refunded, outbound shipping excluded and $3 return postage.",
  );
  const alreadyCovered = (note: string) =>
    /^No measured .+ performance evidence\.$/i.test(note) ||
    note === "Included magnetic desk stand; optional boom" ||
    (Boolean(setup) &&
      /USB.+data cables?/i.test(setupText) &&
      note ===
        "Requires a compatible USB data cable; a charge-only cable will not carry microphone audio.");
  const terms = [
    ...new Set(
      [
        setup,
        returns,
        ...quote.offer.conditions
          .filter((note) => !boilerplate.test(note))
          .map(customerCopy),
        ...quote.offer.uncertainties
          .filter((note) => !boilerplate.test(note) && !alreadyCovered(note))
          .map(customerCopy),
      ].filter(Boolean),
    ),
  ].map((note) => (/[.!?]$/.test(note) ? note : `${note}.`));
  return `Here's your order: ${quote.quantity} ${product}${variantLabel}, from ${seller}, for ${quote.currency} ${(quote.total! / 100).toFixed(2)} in total. Expected delivery: ${summary.deliveryWindow}. ${terms.join(" ")} ${ORDER_APPROVAL_QUESTION}`;
}
