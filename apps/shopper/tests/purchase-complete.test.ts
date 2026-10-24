import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PurchaseComplete } from "@/components/canvas/PurchaseComplete";
import type { Session } from "@/lib/session/contract";

const receipt: NonNullable<Session["receipt"]> = {
  id: "order-123",
  simulated: true,
  acceptedOrder: {
    id: "summary-123", revision: 7, productId: "MIC-001", variantId: "standard",
    offerId: "offer-1", sellerId: "seller-1", quantity: 1, currency: "USD",
    lineItemsMinor: { items: 9900, shipping: 500, otherFees: 0 }, totalMinor: 10400,
    destination: "Singapore", deliveryWindow: "28 Oct 2026, 6:00 pm SGT (simulated)",
    conditions: [], uncertainties: [], presentationMode: "text", status: "confirmed",
  },
};

describe("completed purchase presentation", () => {
  it("shows confirmation and the accepted order's estimate without inventing shipment progress", () => {
    const markup = renderToStaticMarkup(createElement(PurchaseComplete, { receipt }));
    expect(markup).toContain("Order confirmed");
    expect(markup).toContain("You’re all set.");
    expect(markup).toContain("USD 104.00");
    expect(markup).toContain("28 Oct 2026, 6:00 pm SGT");
    expect(markup).toContain("Singapore");
    expect(markup).not.toMatch(/tomorrow|shipped|on its way|simulated|hypothetical|demo/i);
  });

  it("keeps a missing delivery estimate explicit rather than supplying a date", () => {
    const markup = renderToStaticMarkup(createElement(PurchaseComplete, {
      receipt: { ...receipt, acceptedOrder: { ...receipt.acceptedOrder, deliveryWindow: "" } },
    }));
    expect(markup).toContain("Delivery estimate unavailable");
  });
});
