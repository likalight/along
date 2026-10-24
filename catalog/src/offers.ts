import type { Evidence, Offer, Product, Seller } from "./types.ts";
import { emptyMetrics } from "./types.ts";
import { microphoneArchive } from "./microphones.ts";
import { seededNonTechProducts } from "./seeded-nontech.ts";
export const scenarioNow = "2026-10-24T10:00:00+08:00";
export const timezone = "Asia/Singapore";
export const destination = "DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)";
export function resolveDelivery(offsetDays: number, hour = 18): string {
  if (!Number.isInteger(offsetDays) || offsetDays < 0 || offsetDays > 366 || !Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("INVALID_OFFSET");
  const date = new Date(Date.UTC(2026, 9, 24 + offsetDays)).toISOString().slice(0, 10);
  return `${date}T${String(hour).padStart(2, "0")}:00:00+08:00`;
}
// Explicit authored amounts, independent of reference prices (including estimates/range floors).
const prices: Record<string, [number, number]> = {
  "MIC-001": [1900, 2400], "MIC-003": [2200, 2900], "MIC-009": [27700, 28700],
  "MIC-015": [16900, 17900], "MIC-020": [5800, 6800], "MIC-022": [10900, 11900],
  "MIC-025": [5000, 6000], "MIC-037": [8900, 9900], "MIC-038": [5900, 6900],
  "MIC-040": [14900, 15900], "MIC-044": [10900, 11900], "MIC-047": [5000, 6000],
  "BAG-001": [9900, 11000], "BAG-002": [7900, 9500], "BAG-003": [6900, 8000],
  "BAG-004": [7500, 8500], "BAG-005": [9900, 11000], "BAG-006": [7500, 8500],
  "BED-001": [2999, 3499], "BED-002": [5999, 6499], "BED-003": [4999, 5499],
  "BED-004": [3999, 4499], "BED-005": [19900, 20900], "BED-006": [37900, 38900],
};
// Frozen seed calibration, separate from mutable product referencePrice. These are not retail offers.
for (const row of [...microphoneArchive.records.map(r => ({ id: r.id, amount: r.referencePrice.amountMinor })),
  ...seededNonTechProducts.map(p => ({ id: p.id, amount: p.referencePrice.amountMinor }))]) {
  if (!prices[row.id]) {
    const base = row.amount ?? 9900;
    prices[row.id] = [Math.max(100, Math.round(base * 0.94)), base + (base >= 20000 ? 1500 : 800)];
  }
}
const hardware: Record<string, { description: string; priceMinor: number }> = {
  "universal-usb-data-kit": { description: "Synthetic compatible USB data cable and host adapter kit", priceMinor: 1200 },
  "usb-c-xlr-audio-kit": { description: "Synthetic USB-C audio interface with XLR microphone input, XLR cable and switchable phantom power", priceMinor: 7900 },
  "usb-c-trrs-mic-interface": { description: "Synthetic USB-C CTIA headset microphone interface, not a headphone-only adapter", priceMinor: 1800 },
  "usb-a-to-c-data-cable": { description: "Synthetic USB-A host to USB-C device data cable; declared demo audio path", priceMinor: 500 },
  "usb-c-trs-mic-interface": { description: "Synthetic USB-C interface with powered 3.5mm TRS microphone input; not a headphone-only adapter", priceMinor: 2000 },
  "usb-c-data-cable": { description: "Synthetic compatible USB data cable (not charge-only)", priceMinor: 800 },
  "desktop-mic-stand": { description: "Synthetic compatible desktop microphone stand", priceMinor: 1200 },
};
export function buildOffers(products: Product[]) {
  const offers: Offer[] = [], evidence: Evidence[] = [];
  const sellers: Seller[] = [
    { id: "DEMO-VALUE", name: "Demo Value Seller — fictional", classification: "proxy", evidenceIds: ["SELLER-VALUE"] },
    { id: "DEMO-EXPRESS", name: "Demo Express Seller — fictional", classification: "proxy", evidenceIds: ["SELLER-EXPRESS"] },
  ];
  for (const seller of sellers) evidence.push({
    ...emptyMetrics(), id: seller.evidenceIds[0], subjectType: "seller", subjectId: seller.id,
    sourceUrl: null, sourceType: "fixture", checkedOn: "2026-10-24", classification: "proxy",
    claim: "Authored fulfillment fixture only. No real seller reviews, purchase counts, reputation or stock are asserted.",
  });
  for (const p of products) {
    if (!prices[p.id]) throw new Error(`NO_PROXY_PRICE:${p.id}`);
    const required = (p.specs.compatibilityFixture as { requiredHardwareIds?: string[] } | undefined)?.requiredHardwareIds ?? [];
    for (const [i, seller] of sellers.entries()) {
      const setupHardware = required.map(id => {
        if (!hardware[id]) throw new Error(`UNKNOWN_SETUP_HARDWARE:${id}`);
        return { id, ...hardware[id], included: true };
      });
      const otherFeesMinor = setupHardware.reduce((sum, item) => sum + item.priceMinor, 0);
      const unitPriceMinor = prices[p.id][i];
      const shippingMinor = i === 0 ? (["BED-005", "BED-006"].includes(p.id) ? 0 : 500) : 900;
      const id = `${p.id}-${i === 0 ? "A" : "B"}`;
      const availability = p.specs.demoPurchaseHold === true ? "unavailable" : ["out_of_stock", "unavailable", "discontinued", "discontinued_at_seller", "backordered", "special_order", "available_soon"].includes(p.sourceAvailability)
        ? (p.sourceAvailability === "out_of_stock" ? "out_of_stock" : "unavailable") : "in_stock";
      const offerEvidenceId = `FIXTURE-${id}`;
      evidence.push({ ...emptyMetrics(), id: offerEvidenceId, subjectType: "seller", subjectId: seller.id,
        sourceUrl: null, sourceType: "fixture", checkedOn: "2026-10-24", classification: "proxy",
        claim: `Authored ${id}: ${p.variantId}, USD ${unitPriceMinor} item cents + ${shippingMinor} shipping cents + ${otherFeesMinor} hardware cents; tax 0 in this fictional scenario. No live retail offer.` });
      offers.push({
        id, productId: p.id, variantId: p.variantId, sellerId: seller.id, currency: "USD",
        unitPriceMinor, shippingMinor, otherFeesMinor, taxMinor: 0,
        totalMinor: unitPriceMinor + shippingMinor + otherFeesMinor,
        availability, destination,
        deliveryWindow: { earliest: resolveDelivery(i === 0 ? 4 : 1, 9), latest: resolveDelivery(i === 0 ? 4 : 1), timezone },
        orderCutoff: "2026-10-24T12:00:00+08:00",
        returnTerms: i === 0
          ? "DEMO: return unused/unwashed in original packaging within 14 days of simulated delivery; item price refunded, outbound shipping excluded, USD 5 return postage."
          : "DEMO: return unused/unwashed in original packaging within 30 days of simulated delivery; item price refunded, outbound shipping excluded, USD 0 return postage.",
        conditions: ["Simulated purchase only; no payment, order or shipment.",
          "All offer prices, destination eligibility, fees and delivery windows are synthetic.",
          "Tax is explicitly zero in this fictional scenario, not a real tax assessment.",
          "Known negative source availability is retained; all other stock is an explicit proxy assumption.",
          ...(p.specs.demoPurchaseHold === true ? ["This simulated offer is withheld pending the manufacturer's recall serial-number verification. See the product source notice."] : []),
          "Quantity one only; shipping and setup hardware totals are defined for one bundle.",
          ...(setupHardware.length ? ["Required demo setup hardware is included in otherFeesMinor and must be shown in the purchase summary."] : [])],
        evidenceIds: [seller.evidenceIds[0], offerEvidenceId], classification: "proxy", setupHardware,
      });
    }
  }
  return { offers, sellers, evidence };
}
