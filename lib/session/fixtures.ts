import type { Session, StageCard } from "./contract";
export const initialSession = (sessionId: string): Session => ({
  sessionId,
  epoch: 1,
  revision: 0,
  needs: [],
  hardConstraints: {},
  preferences: [],
  exclusions: [],
  shortlistIds: [],
  displayOrder: [],
  focusedProductId: null,
  comparisonIds: [],
  savedItems: [],
  history: [],
  selectedOfferId: null,
  view: "opening",
  evidenceIds: [],
  attachmentIds: [],
  summaryId: null,
  approvalStatus: "not_prepared",
  heading: "A little conversation.\nA better choice.",
  message:
    "Tell me what you’re looking for, or start with a problem you’d like to solve.",
  cards: [],
  summary: null,
  receipt: null,
  category: null,
});
export const solutions: StageCard[] = [
  {
    id: "headset",
    kind: "solution",
    title: "A close-talking headset",
    subtitle: "Speech pickup, close to you",
    detail:
      "A boom keeps the microphone near your mouth. The compromise: you need to wear it.",
    command: "Choose headset",
  },
  {
    id: "clip",
    kind: "solution",
    title: "A discreet clip-on",
    subtitle: "Small enough to take anywhere",
    detail: "Clips to clothing. Placement and fabric noise need care.",
    command: "Choose clip-on",
  },
  {
    id: "desktop",
    kind: "solution",
    title: "A directional desk mic",
    subtitle: "Keep your ears free",
    detail:
      "Aims pickup at your voice. Distance and surrounding café noise still matter.",
    command: "Choose desktop",
  },
];
export const products = (category: Session["category"]): StageCard[] =>
  ["01", "02", "03"].map((n, i) => ({
    id: `${category === "bags" ? "BAG" : category === "bedsheets" ? "BED" : "AUDIO"}-${n}`,
    kind: "product",
    title:
      category === "bags"
        ? ["Everyday carry", "Lightweight weekender", "Structured work tote"][i]
        : category === "bedsheets"
          ? ["Cotton percale set", "Linen blend set", "Cotton sateen set"][i]
          : ["Close-talk travel kit", "Compact voice kit", "Desk voice kit"][i],
    subtitle: ["Top recommendation", "Strong alternative", "Third choice"][i],
    detail:
      category === "bags"
        ? "Synthetic navy fixture. Room for a laptop and gym kit; check capacity before deciding."
        : category === "bedsheets"
          ? "Synthetic queen fixture. Exact dimensions and mattress depth must be checked; no cooling guarantee."
          : "Synthetic shell fixture. Compatibility and transmitted speech performance are unverified.",
    command: `Show option ${i + 1}`,
    price: ["USD 79 reference", "USD 99 reference", "USD 119 reference"][i],
  }));
export const offers: StageCard[] = [
  {
    id: "cheap",
    kind: "offer",
    title: "Lower price",
    subtitle: "USD 84 delivered",
    detail:
      "USD 79 + USD 5 shipping + USD 0 fees. Demo arrival 27 Oct 2026. 14-day demo returns. Synthetic seller A.",
    command: "Choose cheaper offer",
  },
  {
    id: "fast",
    kind: "offer",
    title: "Earlier arrival",
    subtitle: "USD 99 delivered",
    detail:
      "USD 89 + USD 10 shipping + USD 0 fees. Demo arrival 25 Oct 2026. 14-day demo returns. Synthetic seller B.",
    command: "Choose faster offer",
  },
];
export const preparedImage: Omit<import("./contract").Attachment, "id"> = {
  kind: "image",
  name: "Prepared navy bag",
  url: "/fixtures/navy-bag.svg",
  classification: "proxy",
  status: "ready",
};
export const supportedLinks = {
  "https://demo.example/bags/navy": {
    ...preparedImage,
    kind: "link" as const,
    name: "Prepared navy bag reference",
  },
};
