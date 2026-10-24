import { expect, it } from "vitest";
import { AuthoritativeSessionStore } from "@coupang/agent";
import type { Summary } from "@/lib/session/contract";
import { compactLiveOrderReview } from "@/lib/voice/live-checkout-response";

function order() {
  const store = new AuthoritativeSessionStore();
  const session = store.create();
  const quote = structuredClone(store.quotes(session.sessionId, "MIC-022")[0]!);
  const summary: Summary = {
    id: "current-review",
    revision: 1,
    productId: quote.product.id,
    variantId: quote.offer.variantId!,
    offerId: quote.offer.id,
    sellerId: quote.offer.sellerId!,
    quantity: quote.quantity,
    currency: "USD",
    lineItemsMinor: {
      items: quote.subtotal,
      shipping: quote.shipping!,
      otherFees: quote.otherFees!,
    },
    totalMinor: quote.total!,
    destination: quote.destination,
    deliveryWindow: "Within 4 days",
    conditions: quote.offer.conditions,
    uncertainties: quote.offer.uncertainties,
    presentationMode: "voice",
    status: "presenting",
  };
  return { summary, quote };
}

it("reviews the accepted seller, variant, quantity, complete total, delivery and material terms once", () => {
  const { summary, quote } = order();
  quote.product.variant = "Black";
  quote.offer.sellerId = "seller-1";
  quote.offer.sellerName = "Microphone Shop";
  quote.offer.conditions.push("Signature required on delivery.");
  quote.offer.uncertainties.push("Opened items cannot be returned.");
  const before = structuredClone({ summary, quote });
  const speech = compactLiveOrderReview(summary, quote);
  expect(speech).toContain("1 RØDE NT-USB Mini, Black, from Microphone Shop");
  expect(speech).toContain("USD 119.00 in total");
  expect(speech).toContain("Within 4 days");
  expect(speech).toContain("USD 5.00 setup included");
  expect(speech).toContain("USD 5 return postage");
  expect(speech).toContain("Signature required on delivery");
  expect(speech).toContain("Opened items cannot be returned");
  expect(speech.match(/Would you like me to place this order\?/g)).toHaveLength(
    1,
  );
  expect({ summary, quote }).toEqual(before);
});

it("uses readable catalog identity and omits repetitive fixture bookkeeping from speech", () => {
  const { summary, quote } = order();
  const speech = compactLiveOrderReview(summary, quote);
  expect(speech).toContain("RØDE NT-USB Mini, from Value option");
  expect(speech).not.toMatch(
    /MIC-022-DEMO|otherFeesMinor|simulated|synthetic|fictional|verified retail|stock.*verification/i,
  );
  expect(speech).not.toContain("Quantity one only");
  expect(speech).not.toContain("usb-a-and-c-data-cable-kit:");
  expect(speech).not.toContain("USB-A");
  expect(speech).not.toContain("No measured");
  expect(speech).toContain(
    "Returns within 14 days, unused/unwashed in original packaging",
  );
  expect(speech).toContain(
    "outbound shipping excluded and USD 5 return postage",
  );
  expect(speech.split(/\s+/).length).toBeLessThanOrEqual(80);
  expect(speech.length).toBeLessThan(1500);
});

it("preserves bespoke setup and return restrictions instead of shortening unknown terms", () => {
  const { summary, quote } = order();
  quote.offer.setupConditions =
    "Installation requires an electrician; the installation fee is not refundable.";
  quote.offer.returnConditions =
    "Custom engraved items cannot be returned except for defects.";
  const speech = compactLiveOrderReview(summary, quote);
  expect(speech).toContain(quote.offer.setupConditions);
  expect(speech).toContain(quote.offer.returnConditions);
});
