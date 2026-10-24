import { describe, expect, it } from "vitest";
import { agreedCatalog } from "@coupang/contract";
import {
  acceptedDeliveryLabel,
  customerCopy,
  customerDestinationLabel,
  customerNotes,
  customerSellerLabel,
  purchaseConfirmation,
} from "@/lib/canvas/customer-copy";
import { consumerDetails } from "@/lib/canvas/consumer-details";

describe("customer-facing labels without changing accepted source data", () => {
  it("uses readable labels while preserving real seller and destination names", () => {
    expect(customerSellerLabel("DEMO-VALUE")).toBe("Value option");
    expect(customerSellerLabel("DEMO-EXPRESS")).toBe("Express option");
    expect(customerSellerLabel("Example Shop")).toBe("Example Shop");
    expect(
      customerDestinationLabel(
        "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)",
      ),
    ).toBe("Selected delivery destination");
    expect(customerDestinationLabel("Singapore")).toBe("Singapore");
  });

  it("keeps actual return restrictions, costs, quantity and hardware requirements", () => {
    expect(
      customerCopy(
        "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
      ),
    ).toBe(
      "return unused/unwashed in original packaging within 14 days of delivery; item price refunded, outbound shipping excluded, USD 5 return postage.",
    );
    expect(
      customerNotes([
        "Simulated purchase only; no payment, order or shipment.",
        "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
        "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
        "Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary.",
      ]),
    ).toEqual([
      "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
      "Required setup hardware is included in the fees shown.",
    ]);
  });

  it("preserves unresolved compatibility, stock and recall risks", () => {
    const recalled = agreedCatalog.products.find(
      (product: { limitations: string[] }) =>
        product.limitations.some((text) => /battery fire risk/i.test(text)),
    )!;
    const warnings = customerNotes(recalled.limitations);
    expect(warnings.join(" ")).toContain("battery fire risk");
    expect(warnings.join(" ")).toContain("serial");
    expect(warnings.join(" ")).toContain("unavailable until verification");
    expect(warnings.join(" ")).not.toMatch(/\b(demo|simulated)\b/i);
    expect(
      customerCopy(
        "Host paths are bounded simulation fixtures; real compatibility is unverified.",
      ),
    ).toBe("Compatibility with your device still needs checking.");
    expect(
      customerCopy(
        "Synthetic offer; real seller stock, destination service, fees and fulfillment have not been verified.",
      ),
    ).toContain("still need verification");
  });

  it("does not mutate raw offer IDs, classifications, source terms or markers", () => {
    const before = JSON.stringify(agreedCatalog.offers);
    for (const offer of agreedCatalog.offers) {
      const labels = [
        customerSellerLabel(offer.sellerId),
        customerDestinationLabel(offer.destination),
        customerCopy(offer.returnTerms),
        ...customerNotes(offer.conditions),
      ];
      expect(labels.join(" ")).not.toMatch(
        /\b(demo|simulated|fictional|synthetic|hypothetical)\b/i,
      );
    }
    expect(JSON.stringify(agreedCatalog.offers)).toBe(before);
    expect(agreedCatalog.offers[0].sellerId).toBe("DEMO-VALUE");
    expect(agreedCatalog.offers[0].classification).toBe("proxy");
    for (const product of agreedCatalog.products) {
      const text = [
        ...customerNotes(product.limitations),
        ...consumerDetails(product.specs).map((row) => row.value),
      ].join(" ");
      expect(text, product.id).not.toMatch(
        /\b(demo|simulated|fictional|hypothetical)\b/i,
      );
    }
  });

  it("keeps consumer meaning such as synthetic fabric and cleans setup field copy", () => {
    expect(
      consumerDetails({
        material: "Synthetic leather",
        "Setup check": "Unknown — see separately labelled simulated setup",
      }),
    ).toEqual([
      { label: "Material", value: "Synthetic leather" },
      {
        label: "Before you buy",
        value: "Setup requirements still need checking.",
      },
    ]);
  });
});

describe("receipt copy uses only the accepted delivery estimate", () => {
  it("formats exact accepted timestamps instead of inferring tomorrow or shipping status", () => {
    const delivery = acceptedDeliveryLabel({
      latestAt: "2026-10-28T18:00:00+08:00",
      timeZone: "Asia/Singapore",
    });
    expect(delivery).toBe("By 28 Oct 2026, 6:00 pm SGT");
    const message = purchaseConfirmation("audio", delivery);
    expect(message).toBe(
      "Your order is confirmed. Expected delivery: by 28 Oct 2026, 6:00 pm SGT. Enjoy your new setup.",
    );
    expect(message).not.toMatch(
      /tomorrow|shipped|on (?:its|the) way|simulat|demo/i,
    );
    expect(customerCopy("28 Oct 2026, 6:00 pm SGT (simulated)")).toBe(
      "28 Oct 2026, 6:00 pm SGT",
    );
  });

  it("preserves a supplied range and makes no delivery promise when unavailable", () => {
    expect(
      acceptedDeliveryLabel({
        earliest: "2026-10-28T09:00:00+08:00",
        latest: "2026-10-28T18:00:00+08:00",
      }),
    ).toBe("28 Oct 2026, 9:00 am – 28 Oct 2026, 6:00 pm SGT");
    expect(acceptedDeliveryLabel({ latestOffsetDays: 1 })).toBe("Within 1 day");
    expect(purchaseConfirmation("bags", acceptedDeliveryLabel({}))).toBe(
      "Your order is confirmed. Your delivery estimate is not available yet. Hope it makes your everyday carry a little easier.",
    );
  });
});
