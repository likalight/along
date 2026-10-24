import { productImage } from "../canvas/product-media";
import { audioSolution } from "../canvas/product-presentation";
import { AUDIO_SOLUTION_CHOICES } from "../canvas/solution-choices";
import {
  acceptedDeliveryLabel,
  purchaseConfirmation,
} from "../canvas/customer-copy";
import { turnHeadings } from "./activity";
import { agreedCatalog as catalog } from "@coupang/contract";
import { getRuntime, narrationSegments } from "./runtime";
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
    image: productImage(p.id, p.model, p.image),
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
    classification: p.provenance?.kind === "synthetic" ? "proxy" : "snapshot",
    solution: audioSolution(p.category, p.title, p.specs),
  })),
  evidence: catalog.evidence.map((e: any) => ({
    ...e,
    sourceUrl: e.sourceUrl ?? null,
    media: undefined,
  })),
  offers: catalog.offers.map((o: any) => {
    const setup = Array.isArray(o.setupHardware) ? o.setupHardware : [];
    const setupPriced = setup.every(
      (h: { priceMinor?: number | null }) =>
        typeof h?.priceMinor === "number" && h.priceMinor >= 0,
    );
    return {
      ...o,
      otherFeesMinor: o.otherFeesMinor + o.taxMinor,
      // Empty setupHardware → 0; unknown/unpriced audio adapters stay null.
      requiredSetupMinor:
        setup.length === 0 || setupPriced
          ? setup.reduce(
              (sum: number, h: { priceMinor?: number | null }) =>
                sum + (h.priceMinor ?? 0),
              0,
            )
          : null,
      deliveryWindow: {
        latestOffsetDays: Math.round(
          (Date.parse(o.deliveryWindow.latest.slice(0, 10)) -
            Date.parse(catalog.scenarioNow.slice(0, 10))) /
            86400000,
        ),
      },
    };
  }),
};
export const messages = new Map<string, string>();

function summaryStatus(
  approvalStatus: Session["approvalStatus"],
  raw: {
    playback?: string;
    displayed?: boolean;
  } | null,
  hasReceipt: boolean,
): Summary["status"] {
  if (hasReceipt) return "confirmed";
  if (approvalStatus === "blocked" || raw?.playback === "interrupted")
    return "invalidated";
  if (approvalStatus === "eligible") return "eligible";
  return "presenting";
}

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
        deliveryWindow: acceptedDeliveryLabel(
          raw.deliveryWindow as Record<string, unknown>,
        ),
        conditions: raw.conditions!,
        uncertainties: raw.uncertainties!,
        presentationMode: raw.presentationMode!,
        status: summaryStatus(
          s.approvalStatus as Session["approvalStatus"],
          raw,
          Boolean(c.receipt),
        ),
        spokenText: raw.spokenText,
        textHash: raw.textHash,
        responseTurnId: raw.responseTurnId,
      }
    : null;
  // Cancellation/interrupt invalidates the summary without discarding the shortlist.
  // Never leave the shopper on an empty confirmation screen for a missing summary.
  let view: View =
    s.view === "summary" && !summary
      ? s.displayOrder.length
        ? "shortlist"
        : "understanding"
      : (s.view as View);
  if (
    (c.lastOutcome === "summary_interrupted" ||
      s.approvalStatus === "blocked") &&
    !c.receipt &&
    view === "summary"
  ) {
    view = "recovery";
  }
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
    recovery: "Let’s pick up where you left off.",
  };
  const displayHeading =
    ["receipt", "recovery"].includes(view) ||
    (view === "summary" && summary?.responseTurnId === c.turn?.id)
      ? heading[view]
      : (turnHeadings.get(id) ?? heading[view] ?? "Let’s explore.");
  const message =
    view === "recovery"
      ? "Narration or confirmation was interrupted. Your selection is still here. Review the summary again, or explicitly choose text mode for a fresh confirmation."
      : c.lastOutcome === "cancelled" && !c.receipt
        ? "Stopped. No purchase was made. Your choices are still here when you’re ready."
        : view === "summary" && summary && summary.responseTurnId === c.turn?.id
          ? summary.spokenText!
          : view === "receipt"
            ? purchaseConfirmation(
                category(
                  catalog.products.find(
                    (product: any) => product.id === summary?.productId,
                  )?.category,
                ),
                summary?.deliveryWindow ?? "Delivery estimate unavailable",
              )
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
  // Quote only products represented in this accepted session. Catalogue-wide
  // fulfilment checks are unnecessary when a shopper sees a handful of items.
  const selectedProductId = catalog.offers.find(
    (offer: any) => offer.id === s.selectedOfferId,
  )?.productId;
  const relevantProductIds = new Set([
    ...s.displayOrder,
    ...s.comparisonIds,
    ...s.savedItems.map((item) => item.productId),
    ...(s.focusedProductId ? [s.focusedProductId] : []),
    ...(selectedProductId ? [selectedProductId] : []),
  ]);
  const quotes = new Map(
    [...relevantProductIds]
      .flatMap((productId) => store.quotes(id, productId))
      .map((quote) => [quote.offer.id, quote]),
  );
  const assistantNote = messages.get(id);
  const history: Session["history"] = [
    ...c.history.map((h) => ({
      role: "user" as const,
      text: h.text ?? `Shared ${h.modality} reference`,
    })),
    ...(assistantNote
      ? [{ role: "assistant" as const, text: assistantNote }]
      : []),
  ];
  const narration = narrationSegments.get(id);
  const acceptedSegments =
    narration?.turnId === c.turn?.id &&
    narration?.revision === s.revision &&
    !summary &&
    !c.receipt &&
    narration.segments.map((segment) => segment.text).join(" ") === message
      ? narration.segments
      : undefined;
  return {
    ...s,
    productVideoRequest:
      !s.discoveryReference &&
      !summary &&
      !c.receipt &&
      c.turn?.status === "active"
        ? getRuntime().orch.getProductVideoRequest(id, c.turn.id)
        : undefined,
    conversationMode: c.presentationMode,
    narrationSegments: acceptedSegments,
    focusedProductId:
      s.focusedProductId ??
      catalog.offers.find((o: any) => o.id === s.selectedOfferId)?.productId ??
      null,
    // Preserve blocked so the shell can show invalidated eligibility — do not collapse to not_prepared.
    approvalStatus: s.approvalStatus as Session["approvalStatus"],
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
    history,
    savedItems: s.savedItems.map((x) => ({
      id: x.productId,
      rationale: x.rationale,
    })),
    view,
    category:
      category(c.constraints.category) ??
      (view === "solution_types" ? "audio" : null) ??
      category(
        catalog.products.find((p: any) => s.displayOrder.includes(p.id))
          ?.category,
      ),
    heading: displayHeading,
    message,
    cards: [],
    summary,
    receipt:
      c.receipt && summary
        ? {
            id: c.receipt.id,
            simulated: true,
            acceptedOrder: { ...summary, status: "confirmed" },
          }
        : null,
    canvas: {
      heading: displayHeading,
      message,
      solution:
        s.preferences.audioDirectionPending === true
          ? undefined
          : AUDIO_SOLUTION_CHOICES.find(
              (choice) => choice.solutionType === s.preferences.solutionType,
            )?.id,
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
