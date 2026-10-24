import type { Scenario } from "./types.ts";
import { destination, scenarioNow, timezone, resolveDelivery } from "./offers.ts";
const base = { now: scenarioNow, timezone, destination };
export const scenarios: Scenario[] = [
  { ...base, id: "cafe-dictation", title: "Noisy-café dictation",
    opening: "I dictate into my computer, but cafés are too noisy. What could help?",
    anchorProductId: "MIC-044",
    constraints: { category: "audio-accessories", currency: "USD", budgetMinor: 16000, hostConnection: "usb-c", productId: "MIC-044" },
    changes: [
      { utterance: "Compare the offers for this directional USB microphone, with its required setup hardware.",
        constraints: {}, expectedOfferIds: ["MIC-044-A", "MIC-044-B"] },
      { utterance: "I need it tomorrow.", constraints: { deadline: resolveDelivery(1) }, expectedOfferIds: ["MIC-044-B"] },
      { utterance: "Keep tomorrow, but the whole setup must cost no more than 140 dollars.",
        constraints: { budgetMinor: 14000 }, expectedOfferIds: [] },
    ] },
  { ...base, id: "work-gym", title: "Bag inspiration / work and gym",
    opening: "I like this bag's shape. I need a bag for work and gym under 150 dollars.",
    anchorProductId: "BAG-001",
    constraints: { category: "everyday-bags", currency: "USD", budgetMinor: 15000, laptopInches: 14, separateShoeCompartment: true },
    changes: [
      { utterance: "Show offers with verified separate shoe storage and laptop support.",
        constraints: {}, expectedOfferIds: ["BAG-001-A", "BAG-001-B"] },
      { utterance: "I need it tomorrow.", constraints: { deadline: resolveDelivery(1) }, expectedOfferIds: ["BAG-001-B"] },
      { utterance: "Keep everything else, but at most 100 dollars.", constraints: { budgetMinor: 10000 }, expectedOfferIds: [] },
    ] },
  { ...base, id: "warm-room", title: "Bedsheets for a warm room",
    opening: "My room gets hot at night; help me choose bedsheets.",
    anchorProductId: "BED-003",
    constraints: { category: "bedsheet-sets", currency: "USD", budgetMinor: 7000, bedWidthIn: 60, bedLengthIn: 80, mattressDepthIn: 12 },
    changes: [
      { utterance: "Compare sets that fit my 12-inch-deep US Queen mattress.",
        constraints: {}, expectedOfferIds: ["BED-002-A", "BED-003-A", "BED-003-B"] },
      { utterance: "I prefer the cotton-lyocell percale blend.",
        constraints: { productId: "BED-003" }, expectedOfferIds: ["BED-003-A", "BED-003-B"] },
      { utterance: "I need it tomorrow.", constraints: { deadline: resolveDelivery(1) }, expectedOfferIds: ["BED-003-B"] },
      { utterance: "Actually, keep these constraints but require 100% cotton.",
        constraints: { composition: "100% cotton" }, expectedOfferIds: [] },
    ] },
];
