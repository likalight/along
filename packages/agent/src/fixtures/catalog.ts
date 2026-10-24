/** Canonical curated snapshots + explicitly synthetic offers, shared with backend. */
import {
  agreedCatalog as c,
  type Product,
  type Offer,
  type Evidence,
  type Attachment,
} from "@coupang/contract";
export const PRODUCTS: Product[] = c.products.map((p: any) => ({
  ...p,
  category:
    p.category === "audio-accessories"
      ? "audio"
      : p.category === "everyday-bags"
        ? "bags"
        : "bedding",
  specs: {
    ...p.specs,
    size: p.specs.sizeMarket?.toLowerCase(),
    material: p.specs.material ?? p.specs.compositionLabel,
  },
  solutionType:
    p.category !== "audio-accessories"
      ? undefined
      : /headset|earpods/i.test(p.title)
        ? "headset"
        : /lavalier|clip|lav\b/i.test(p.title)
          ? "clip_on"
          : "directional_desktop",
  authoredFitScore: p.authoredFit
    ? p.authoredFit.demo_cafe_fit * 20
    : undefined,
}));
export const OFFERS: Offer[] = c.offers.map((o: any) => ({
  ...o,
  otherFeesMinor: o.otherFeesMinor + o.taxMinor,
  availability: o.availability === "in_stock" ? "in_stock" : "unavailable",
  deliveryWindow: {
    latestOffsetDays: Math.round(
      (Date.parse(o.deliveryWindow.latest.slice(0, 10)) -
        Date.parse(c.scenarioNow.slice(0, 10))) /
        86400000,
    ),
  },
}));
export const EVIDENCE: Evidence[] = c.evidence.map((e: any) => ({
  ...e,
  sourceUrl: e.sourceUrl ?? undefined,
  classification:
    e.classification === "observed" ? "snapshot" : e.classification,
  media: undefined,
}));
export const PREPARED_ATTACHMENTS: Attachment[] = c.imageFixtures.map(
  (x: any) => ({
    id: x.id,
    kind: "prepared_image",
    preparedKey: x.id,
    url: x.image.url,
    status: "ready",
  }),
);
export const KNOWN_LINKS: Record<
  string,
  { productId?: string; note: string; status: "ready" | "unavailable" }
> = Object.fromEntries(
  c.knownLinks.map((l: any) => [
    l.url,
    {
      productId: l.productId,
      note: "Curated source snapshot; no live fetch.",
      status: "ready",
    },
  ]),
);
export function completeTotalMinor(o: Offer): number | null {
  return o.unitPriceMinor === null ||
    o.shippingMinor === null ||
    o.otherFeesMinor === null
    ? null
    : o.unitPriceMinor + o.shippingMinor + o.otherFeesMinor;
}
export function getProduct(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}
export function getOffer(id: string) {
  return OFFERS.find((o) => o.id === id);
}
export function offersForProduct(id: string) {
  return OFFERS.filter(
    (o) => o.productId === id && o.availability === "in_stock",
  );
}
