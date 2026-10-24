import { agreedCatalog as catalog } from "@coupang/contract";
import { getRuntime } from "./runtime";
import type { Session, Summary, View } from "../session/contract";
import type { CanvasData, Category } from "../canvas/contracts";
export const category = (v: string | undefined): Category | null =>
  v === "audio-accessories"
    ? "audio"
    : v === "bags" || v === "everyday-bags"
      ? "bags"
      : v === "bedding" || v === "bedsheet-sets"
        ? "bedsheets"
        : null;
export const canvasData: CanvasData = {
  products: catalog.products.map((p: any) => ({
    ...p,
    category: category(p.category),
    specs: Object.fromEntries(
      Object.entries(p.specs)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [
          k,
          typeof v === "object" ? JSON.stringify(v) : String(v),
        ]),
    ),
    referencePriceMinor: p.referencePrice.amountMinor,
    availability: p.sourceAvailability,
    classification: "snapshot",
    solution:
      p.category !== "audio-accessories"
        ? undefined
        : /headset|earpods/i.test(p.title)
          ? "headset"
          : /lavalier|clip|lav\b/i.test(p.title)
            ? "clip"
            : "desktop",
  })),
  evidence: catalog.evidence.map((e: any) => ({
    ...e,
    sourceUrl: e.sourceUrl ?? null,
    media: undefined,
  })),
  offers: catalog.offers.map((o: any) => ({
    ...o,
    otherFeesMinor: o.otherFeesMinor + o.taxMinor,
    deliveryWindow: {
      latestOffsetDays: Math.round(
        (Date.parse(o.deliveryWindow.latest.slice(0, 10)) -
          Date.parse(catalog.scenarioNow.slice(0, 10))) /
          86400000,
      ),
    },
  })),
};
export const messages = new Map<string, string>();
export function project(id: string): Session {
  const { store } = getRuntime(),
    c = store.core.get(id),
    s = store.get(id)!;
  const raw = store.summaryDetails(id);
  // Explicit projection: internal approval nonces and access tokens never reach the browser.
  const summary: Summary | null = raw
    ? {
        id: raw.id!,
        revision: raw.revision!,
        productId: raw.productId!,
        variantId: raw.variantId!,
        offerId: raw.offerId!,
        sellerId: raw.sellerId!,
        quantity: raw.quantity!,
        currency: "USD",
        lineItemsMinor: raw.lineItemsMinor!,
        totalMinor: raw.totalMinor!,
        destination: raw.destination!,
        deliveryWindow: (() => {
          const w = raw.deliveryWindow as any;
          return w.latestAt || w.latest
            ? new Intl.DateTimeFormat("en-SG", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Singapore",
              }).format(new Date(w.latestAt ?? w.latest)) + " SGT (simulated)"
            : `Within ${w.latestOffsetDays} days (simulated)`;
        })(),
        conditions: raw.conditions!,
        uncertainties: raw.uncertainties!,
        presentationMode: raw.presentationMode!,
        status: s.approvalStatus === "eligible" ? "eligible" : "presenting",
        spokenText: raw.spokenText,
        textHash: raw.textHash,
        responseTurnId: raw.responseTurnId,
      }
    : null;
  const view = s.view as View;
  const heading: Record<string, string> = {
    opening: "A little conversation.\nA better choice.",
    understanding: "Let’s get the details right.",
    solution_types: "Find your direction.",
    buying_priorities: "What matters most?",
    shortlist: "A few thoughtful choices.",
    comparison: "The differences that matter.",
    evidence: "Look a little closer.",
    offers: "The complete cost.",
    saved_choice: "Keep a good idea.",
    summary: "Your choice, clearly.",
    receipt: "A choice made with confidence.",
  };
  const message =
    view === "summary" && summary
      ? summary.spokenText!
      : view === "receipt"
        ? "Simulated purchase complete. No payment or real order."
        : (messages.get(id) ??
          "Tell me what you’re looking for, or start with a problem you’d like to solve.");
  const constraints: Record<string, string> = Object.fromEntries(
    Object.entries(c.constraints).map(([k, v]) => [
      k,
      typeof v === "object" ? JSON.stringify(v) : String(v),
    ]),
  );
  if (c.constraints.deliveryWithinDays !== undefined)
    constraints.deadlineDays = String(c.constraints.deliveryWithinDays);
  const quotes = new Map(store.quotes(id).map((q) => [q.offer.id, q]));
  return {
    ...s,
    focusedProductId:
      s.focusedProductId ??
      catalog.offers.find((o: any) => o.id === s.selectedOfferId)?.productId ??
      null,
    approvalStatus:
      s.approvalStatus === "blocked" ? "not_prepared" : s.approvalStatus,
    needs: c.needs,
    hardConstraints: constraints,
    preferences: c.preferences.map((p) => {
      try {
        const [k, v] = JSON.parse(p);
        return `${k}: ${v}`;
      } catch {
        return p;
      }
    }),
    history: c.history.map((h) => ({
      role: "user" as const,
      text: h.text ?? `Shared ${h.modality} reference`,
    })),
    savedItems: s.savedItems.map((x) => ({
      id: x.productId,
      rationale: x.rationale,
    })),
    view,
    category:
      category(c.constraints.category) ??
      category(
        catalog.products.find((p: any) => s.displayOrder.includes(p.id))
          ?.category,
      ),
    heading: heading[view] ?? "Let’s explore.",
    message,
    cards: [],
    summary,
    receipt:
      c.receipt && summary
        ? { id: c.receipt.id, simulated: true, acceptedOrder: summary }
        : null,
    canvas: {
      heading: heading[view] ?? "Let’s explore.",
      message,
      annotations: Object.fromEntries(
        s.shortlistEntries.map((e, i) => [
          e.productId,
          {
            role: i === 0 ? "Top recommendation" : "Alternative",
            fitReason: e.fitReason,
            compromise: e.compromise,
            rank: (i + 1) as 1 | 2 | 3,
          },
        ]),
      ),
    },
    catalog: {
      ...canvasData,
      offers: canvasData.offers.map((o) => ({
        ...o,
        eligible: quotes.get(o.id)?.eligible ?? false,
        conflicts: quotes.get(o.id)?.conflicts.map((x) => x.message) ?? [],
      })),
    },
  };
}
