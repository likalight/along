import assert from "node:assert/strict";
import { test } from "node:test";
import type { InputEvent } from "@coupang/contract";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import { SessionThread } from "../thread/SessionThread.js";
import { PRODUCTS, OFFERS } from "../fixtures/catalog.js";
import {
  executeShoppingTool,
  shoppingTools,
  parseProductNavigation,
} from "./shoppingTools.js";
function setup() {
  const store = new AuthoritativeSessionStore();
  const snapshot = store.create();
  const thread = new SessionThread(snapshot);
  const input: InputEvent = {
    sessionId: snapshot.sessionId,
    epoch: snapshot.epoch,
    baseRevision: snapshot.revision,
    eventId: "test",
    turnId: "turn",
    modality: "text",
    text: "a bag",
    visibleRevision: snapshot.revision,
    visibleProductIds: [],
  };
  store.ingestInput(input);
  input.baseRevision = store.get(input.sessionId)!.revision;
  thread.snapshot = store.get(input.sessionId)!;
  return {
    store,
    thread,
    input,
    run: (name: string, args: unknown) =>
      executeShoppingTool({ name, arguments: args, store, thread, input }),
  };
}
const remember = (overrides: Record<string, unknown> = {}) => ({
  needs: [],
  preferences: [],
  exclusions: [],
  minimumCapacityL: null,
  separateShoeCompartment: null,
  budgetMinor: null,
  category: null,
  maxDeliveryDays: null,
  compatibility: {
    hostConnection: null,
    laptopInches: null,
    bedWidthInches: null,
    bedLengthInches: null,
    mattressDepthInches: null,
  },
  ...overrides,
});
test("a shopper handling the dongle reaches review without naming a host or authorizing purchase", () => {
  const { run, input, store } = setup();
  input.text = "I want the RODE NT-USB Mini. I've got a dongle, no worries.";
  assert.equal(run("prepare_summary", { productId: "MIC-022" }).ok, false);
  const saved = run("remember_connection_setup", { productId: "MIC-022", handled: true });
  assert.equal(saved.ok, true, saved.reason);
  assert.equal((saved.snapshot.hardConstraints.compatibility as { hostConnection?: string } | undefined)?.hostConnection, undefined);
  assert.deepEqual(saved.snapshot.hardConstraints.shopperHandledConnectionFor, ["MIC-022"]);
  assert.equal(run("remember_requirements", remember({ preferences: [{ key: "use", value: "podcasts" }] })).ok, true);
  const review = run("prepare_summary", { productId: "MIC-022" });
  assert.equal(review.ok, true, review.reason);
  assert.equal(review.snapshot.selectedOfferId, "MIC-022-A");
  assert.ok(review.snapshot.summaryId);
  assert.equal(store.core.get(input.sessionId).receipt, null);
  assert.equal(store.quotes(input.sessionId, "MIC-003").some((quote) => quote.eligible), false, "reassurance is specific to the chosen product");
});

test("retracting setup reassurance closes the review without inventing a port", () => {
  const { run, input } = setup();
  input.text = "I've got an adapter for the RODE";
  assert.equal(run("remember_connection_setup", { productId: "MIC-022", handled: true }).ok, true);
  assert.equal(run("prepare_summary", { productId: "MIC-022" }).ok, true);
  input.text = "Actually I don't have the adapter. Help me connect it.";
  const retracted = run("remember_connection_setup", { productId: "MIC-022", handled: false });
  assert.equal(retracted.ok, true, retracted.reason);
  assert.equal(retracted.snapshot.summaryId, null);
  assert.equal(run("prepare_summary", { productId: "MIC-022" }).ok, false);
});

test("automatic offer selection uses complete eligible totals and preserves firm requirements", () => {
  const { run, input, store } = setup();
  input.text = "My laptop has USB-C; I want the RODE NT-USB Mini";
  assert.equal(run("remember_requirements", remember({ compatibility: { ...remember().compatibility, hostConnection: "usb-c" } })).ok, true);
  const candidates = store.quotes(input.sessionId, "MIC-022").filter((quote) => quote.eligible);
  assert.ok(candidates.length > 1);
  const review = run("prepare_summary", { productId: "MIC-022" });
  assert.equal(review.ok, true, review.reason);
  const selected = candidates.find((quote) => quote.offer.id === review.snapshot.selectedOfferId)!;
  assert.equal(selected.total, Math.min(...candidates.map((quote) => quote.total!)));
  assert.equal(run("prepare_summary", { productId: "MIC-022", offerId: "MIC-003-A" }).ok, false);
  input.text = "My limit is fifty dollars";
  assert.equal(run("remember_requirements", remember({ budgetMinor: 5000 })).ok, true);
  assert.equal(run("remember_connection_setup", { productId: "MIC-022", handled: true }).ok, true);
  const blocked = run("prepare_summary", { productId: "MIC-022" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.snapshot.hardConstraints.budgetMinor, 5000);
  assert.equal(store.core.get(input.sessionId).receipt, null);
});

test("model tools reject purchase, unknown identities, extra metadata and unknown IDs", () => {
  const { run, store, input } = setup();
  for (const name of [
    "purchase",
    "approve",
    "propose_approval",
    "constructor",
    "__proto__",
  ])
    assert.equal(run(name, {}).ok, false);
  assert.equal(run("inspect_product", { productId: "invented" }).ok, false);
  assert.equal(run("select_offer", { offerId: "invented" }).ok, false);
  assert.equal(run("show_evidence", { evidenceIds: ["invented"] }).ok, false);
  assert.equal(
    run("prepare_summary", { sessionId: "another-session" }).ok,
    false,
  );
  assert.equal(store.get(input.sessionId)!.revision, 1);
  assert.ok(
    shoppingTools.every(
      (t) => t.strict && t.parameters.additionalProperties === false,
    ),
  );
});
test("opening seeded reviews focuses their product without a separate focus call", () => {
  const { run, store, input } = setup();
  assert.equal(run("shortlist", { entries: [{ productId: "BAG-024", fitReason: "Everyday carry", compromise: "No shoe compartment" }] }).ok, true);
  assert.equal(run("show_evidence", { evidenceIds: ["DEMO-REVIEWS-BAG-024"] }).ok, true);
  const snapshot = store.get(input.sessionId)!;
  assert.equal(snapshot.view, "evidence");
  assert.equal(snapshot.focusedProductId, "BAG-024");
  assert.ok(snapshot.evidenceIds.includes("DEMO-REVIEWS-BAG-024"));
});
test("remembering preferences retains budget; model cannot silently raise it", () => {
  const { run, input, store } = setup();
  const initial = run(
    "remember_requirements",
    remember({ budgetMinor: 15000 }),
  );
  assert.equal(initial.ok, true, initial.reason);
  assert.equal(
    run(
      "remember_requirements",
      remember({ preferences: [{ key: "bagPriority", value: "capacity" }] }),
    ).ok,
    true,
  );
  assert.equal(store.get(input.sessionId)!.hardConstraints.budgetMinor, 15000);
  assert.equal(
    run("remember_requirements", remember({ budgetMinor: 25000 })).ok,
    false,
  );
  input.text = "Actually my budget is USD250";
  assert.equal(
    run("remember_requirements", remember({ budgetMinor: 25000 })).ok,
    true,
  );
  assert.equal(store.get(input.sessionId)!.hardConstraints.budgetMinor, 25000);
});
test("a spoken correction replaces a one-dollar budget and immediately enables suitable products", () => {
  const { run, input, store, thread } = setup();
  input.text = "My budget is one dollar and I use USB-C";
  assert.equal(run("remember_requirements", remember({ budgetMinor: 100, category: "audio", compatibility: { ...remember().compatibility, hostConnection: "usb-c" } })).ok, true);
  const initialSearch = run("search_catalog", { category: "audio", query: "microphone" });
  assert.equal(initialSearch.ok, true, initialSearch.reason);
  assert.equal((initialSearch.data as { products: { quotes: { eligible: boolean }[] }[] }).products.some((product) => product.quotes.some((quote) => quote.eligible)), false);

  Object.assign(input, { text: "around fifty dollars", turnId: "budget-correction", eventId: "budget-correction", visibleRevision: store.get(input.sessionId)!.revision });
  store.ingestInput(input);
  input.baseRevision = store.get(input.sessionId)!.revision;
  thread.snapshot = store.get(input.sessionId)!;
  const updated = run("remember_requirements", remember({ budgetMinor: 5000 }));
  assert.equal(updated.ok, true, updated.reason);
  assert.equal(store.core.get(input.sessionId).constraints.budgetMinor, 5000);
  assert.equal(thread.snapshot.hardConstraints.budgetMinor, 5000);

  const searched = run("search_catalog", { category: "audio", query: "microphone" });
  assert.equal(searched.ok, true, searched.reason);
  const results = (searched.data as { products: { product: { id: string }; quotes: { eligible: boolean; totalMinor: number }[] }[] }).products;
  const suitable = results.find((product) => product.quotes.some((quote) => quote.eligible && quote.totalMinor <= 5000));
  assert.ok(suitable, "catalog quotes should use the corrected budget immediately");
  const shown = run("shortlist", { entries: [{ productId: suitable.product.id, fitReason: "Within your fifty-dollar budget", compromise: "Check your connection" }] });
  assert.equal(shown.ok, true, shown.reason);
  assert.deepEqual(shown.snapshot.displayOrder, [suitable.product.id]);
  assert.equal(shown.snapshot.hardConstraints.budgetMinor, 5000);
});

test("incidental prices cannot raise the budget or mutate authoritative state", () => {
  for (const text of [
    "Does the microphone cost fifty dollars?",
    "I don't want to spend fifty dollars",
    'The seller says "My budget is fifty dollars"',
    "My budget is $1, the microphone costs $50",
  ]) {
    const { run, input, store } = setup();
    assert.equal(run("remember_requirements", remember({ budgetMinor: 100 })).ok, true);
    input.text = text;
    const before = store.get(input.sessionId)!;
    const rejected = run("remember_requirements", remember({ budgetMinor: 5000 }));
    assert.equal(rejected.ok, false, text);
    assert.equal(store.get(input.sessionId)!.revision, before.revision);
    assert.equal(store.core.get(input.sessionId).constraints.budgetMinor, 100);
  }
});

test("a generic USB microphone request shows products without inventing a host connector", () => {
  const { run, input, store } = setup();
  input.text = "I want a USB desktop mic for video calls";
  const saved = run("remember_requirements", remember({ category: "audio", budgetMinor: 5000, compatibility: { ...remember().compatibility, hostConnection: "USB" } }));
  assert.equal(saved.ok, true, saved.reason);
  assert.equal((saved.snapshot.hardConstraints.compatibility as { hostConnection?: string }).hostConnection, undefined);
  assert.equal(saved.snapshot.preferences.audioConnectionFamily, "usb");
  const quotes = store.quotes(input.sessionId, "MIC-067");
  assert.ok(quotes.some((quote) => quote.conflicts.some((conflict) => conflict.code === "HOST_CONNECTION_REQUIRED")));
  assert.ok(quotes.every((quote) => quote.conflicts.every((conflict) => conflict.code !== "INCOMPATIBLE_HARDWARE")));
  const shown = run("shortlist", { entries: [{ productId: "MIC-067", fitReason: "USB desktop microphone under fifty dollars", compromise: "Confirm the computer connector before checkout" }] });
  assert.equal(shown.ok, true, shown.reason);
  assert.deepEqual(shown.snapshot.displayOrder, ["MIC-067"]);
  assert.equal(run("select_offer", { offerId: "MIC-067-A" }).ok, false, "Unknown hardware is still not checkout consent");
});

test("generic USB does not overwrite a shopper's specific accepted connector", () => {
  const { run, input } = setup();
  input.text = "My computer has USB A";
  const specific = run("remember_requirements", remember({ compatibility: { ...remember().compatibility, hostConnection: "USB A" } }));
  assert.equal(specific.ok, true, specific.reason);
  assert.equal((specific.snapshot.hardConstraints.compatibility as { hostConnection: string }).hostConnection, "usb-a");
  input.text = "Show me USB desktop microphones";
  const generic = run("remember_requirements", remember({ compatibility: { ...remember().compatibility, hostConnection: "USB" } }));
  assert.equal(generic.ok, true, generic.reason);
  assert.equal((generic.snapshot.hardConstraints.compatibility as { hostConnection: string }).hostConnection, "usb-a");
  input.text = "Actually, my computer has USB C";
  const corrected = run("remember_requirements", remember({ compatibility: { ...remember().compatibility, hostConnection: "USB C" } }));
  assert.equal(corrected.ok, true, corrected.reason);
  assert.equal((corrected.snapshot.hardConstraints.compatibility as { hostConnection: string }).hostConnection, "usb-c");
});

test("legacy generic USB constraints permit discovery but still require a connector for checkout", () => {
  const { run, input, store, thread } = setup();
  const seeded = store.apply({ sessionId: input.sessionId, epoch: input.epoch, turnId: input.turnId, baseRevision: input.baseRevision, eventId: "legacy-usb", action: "set_constraints", payload: { hardConstraints: { budgetMinor: 5000, compatibility: { hostConnection: "USB" } } }, evidenceIds: [] });
  assert.equal(seeded.ok, true, seeded.reason);
  input.baseRevision = seeded.snapshot.revision;
  thread.snapshot = seeded.snapshot;
  const shown = run("shortlist", { entries: [{ productId: "MIC-067", fitReason: "A USB microphone to explore", compromise: "Confirm the computer connector before checkout" }] });
  assert.equal(shown.ok, true, shown.reason);
  assert.deepEqual(shown.snapshot.displayOrder, ["MIC-067"]);
  assert.equal(run("select_offer", { offerId: "MIC-067-A" }).ok, false);
  input.text = "My computer has USB-C";
  assert.equal(run("remember_requirements", remember({ compatibility: { ...remember().compatibility, hostConnection: "usb-c" } })).ok, true);
  assert.equal(run("select_offer", { offerId: "MIC-067-A" }).ok, true);
});

for (const hostConnection of [null, "usb-c"]) test(`paged desktop search finds the affordable option with ${hostConnection ?? "unknown host"}`, () => {
  const { run } = setup();
  assert.equal(run("remember_requirements", remember({ category: "audio", budgetMinor: 5000, compatibility: { ...remember().compatibility, hostConnection } })).ok, true);
  type SearchPage = { nextOffset: number | null; note: string; products: { product: { id: string; solutionType: string }; quotes: { eligible: boolean; budgetStatus: string; totalMinor: number | null; conflicts: { code: string }[] }[] }[] };
  let page = run("search_catalog", { category: "audio", query: "USB desktop microphone" }).data as SearchPage;
  assert.equal(page.products.filter((entry) => entry.product.solutionType === "directional_desktop").some((entry) => entry.quotes.some((quote) => quote.budgetStatus === "within_budget")), false);
  assert.ok(page.products.some((entry) => entry.product.solutionType === "headset" && entry.quotes.some((quote) => quote.budgetStatus === "within_budget")), "A cheaper wrong-format result on page one is not evidence that the requested kind has no match");
  assert.notEqual(page.nextOffset, null);
  assert.match(page.note, /More products remain/);
  let pages = 1;
  let found: SearchPage["products"][number] | undefined;
  while (page.nextOffset !== null && !found) {
    page = run("search_catalog", { category: "audio", query: "USB desktop microphone", offset: page.nextOffset }).data as SearchPage;
    pages++;
    found = page.products.find((entry) => entry.product.solutionType === "directional_desktop" && entry.quotes.some((quote) => quote.budgetStatus === "within_budget" && quote.conflicts.every((conflict) => conflict.code === "HOST_CONNECTION_REQUIRED")));
  }
  assert.ok(found, "A later page contains the under-budget desk microphone");
  assert.equal(pages, 3);
  assert.equal(found.product.id, "MIC-027");
  const quote = found.quotes.find((entry) => entry.budgetStatus === "within_budget")!;
  assert.equal(quote.totalMinor, 4729);
  assert.equal(quote.eligible, hostConnection !== null, "Checkout eligibility changes only when the connector is confirmed");
  assert.deepEqual(quote.conflicts.map((conflict) => conflict.code), hostConnection ? [] : ["HOST_CONNECTION_REQUIRED"]);
  const shown = run("shortlist", { entries: [{ productId: found.product.id, fitReason: "A desk microphone within your fifty-dollar budget", compromise: "Confirm your computer connector before checkout" }] });
  assert.equal(shown.ok, true, shown.reason);
  assert.deepEqual(shown.snapshot.displayOrder, ["MIC-027"]);
});
test("offer selection and summary remain authoritative", () => {
  const { run, store, input, thread } = setup();
  assert.equal(run("prepare_summary", {}).ok, false);
  const cheap = run("remember_requirements", remember({ budgetMinor: 1 }));
  assert.equal(cheap.ok, true, cheap.reason);
  assert.equal(run("select_offer", { offerId: OFFERS[0]!.id }).ok, false);
  assert.equal(store.get(input.sessionId)!.selectedOfferId, null);
  assert.equal(store.get(input.sessionId)!.approvalStatus, "not_prepared");
  assert.ok(thread.events.some((e) => e.type === "tool_result" && !e.data.ok));
});
test("catalog exposes factual products and current authoritative quotes", () => {
  const { run } = setup();
  const result = run("search_catalog", { category: "bags", query: "capacity" });
  assert.equal(result.ok, true);
  const data = result.data as {
    products: {
      product: { id: string; category: string };
      quotes: unknown[];
    }[];
  };
  assert.ok(data.products.length > 0);
  assert.ok(
    data.products.every(
      (p) => p.product.category === "bags" && Array.isArray(p.quotes),
    ),
  );
  const inspected = run("inspect_product", { productId: PRODUCTS[0]!.id });
  assert.equal(inspected.ok, true);
});
test("successful summary returns exact canonical text without issuing a purchase", () => {
  const { run, store, input } = setup();
  const offer = PRODUCTS.flatMap((p) =>
    store.quotes(input.sessionId, p.id),
  ).find((q) => q.eligible);
  assert.ok(offer, "catalog should contain an initially eligible offer");
  const selected = run("select_offer", { offerId: offer.offer.id });
  assert.equal(selected.ok, true, selected.reason);
  const summary = run("prepare_summary", {});
  assert.equal(summary.ok, true, summary.reason);
  assert.equal(summary.canonicalSummary, true);
  assert.equal(
    summary.speakable!.content,
    store.core.get(input.sessionId).summary!.spokenText,
  );
  assert.notEqual(summary.snapshot.approvalStatus, "approved");
});

test("an exact offer can be validated and reviewed in one tool call without purchase authority", () => {
  const { run, store, input } = setup();
  const quote = store.quotes(input.sessionId).find((q) => q.eligible)!;
  const result = run("prepare_summary", { offerId: quote.offer.id });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.canonicalSummary, true);
  const state = store.core.get(input.sessionId);
  assert.equal(state.summary!.quote.offer.id, quote.offer.id);
  assert.equal(result.speakable!.content, state.summary!.spokenText);
  assert.equal(state.receipt, null);
});

test("combined offer review still rejects incompatible offers before changing selection", () => {
  const { run, store, input } = setup();
  const blocked = store.quotes(input.sessionId).find((q) => !q.eligible)!;
  assert.ok(blocked);
  const before = store.core.get(input.sessionId);
  const result = run("prepare_summary", { offerId: blocked.offer.id });
  assert.equal(result.ok, false);
  assert.deepEqual(store.core.get(input.sessionId), before);
});

test("blocked checkout distinguishes an unknown connector from a known incompatible connector", () => {
  const { run, store, input } = setup();
  const missing = run("prepare_summary", { offerId: "MIC-003-A" });
  assert.equal(missing.ok, false);
  const missingContext = (missing.data as { checkout: {
    hostConnection: string | null;
    needsHostConnection: boolean;
    conflicts: Array<{ code: string }>;
    nextStep: string;
  } }).checkout;
  assert.equal(missingContext.hostConnection, null);
  assert.equal(missingContext.needsHostConnection, true);
  assert.ok(missingContext.conflicts.some((conflict) => conflict.code === "HOST_CONNECTION_REQUIRED"));
  assert.match(missingContext.nextStep, /remember_connection_setup/);
  assert.match(missingContext.nextStep, /without demanding connector names/);

  const saved = run("remember_requirements", remember({
    compatibility: { ...remember().compatibility, hostConnection: "USB-C" },
  }));
  assert.equal(saved.ok, true, saved.reason);
  const mismatch = run("prepare_summary", { offerId: "MIC-003-A" });
  assert.equal(mismatch.ok, false);
  const knownContext = (mismatch.data as { checkout: typeof missingContext }).checkout;
  assert.equal(knownContext.hostConnection, "usb-c");
  assert.equal(knownContext.needsHostConnection, false);
  assert.ok(knownContext.conflicts.some((conflict) => conflict.code === "INCOMPATIBLE_HARDWARE"));
  assert.match(knownContext.nextStep, /do not ask for it again/);
  assert.equal((store.get(input.sessionId)!.hardConstraints.compatibility as { hostConnection: string }).hostConnection, "usb-c");
  assert.equal(store.core.get(input.sessionId).receipt, null);
});

test("remembered USB-C resumes the requested NT-USB Mini review without changing the shopper's connector", () => {
  const { run, store, input } = setup();
  input.text = "Yes, it is a USB-C to USB-C, which connects it to my laptop. Let's purchase.";
  const saved = run("remember_requirements", remember({
    category: "audio",
    compatibility: { ...remember().compatibility, hostConnection: "USB-C" },
  }));
  assert.equal(saved.ok, true, saved.reason);
  const result = run("prepare_summary", { offerId: "MIC-022-A" });
  assert.equal(result.ok, true, result.reason);
  assert.equal(result.canonicalSummary, true);
  const current = store.core.get(input.sessionId);
  assert.equal(current.summary!.quote.product.id, "MIC-022");
  assert.equal(current.constraints.compatibility!.hostConnection, "usb-c");
  assert.equal(current.receipt, null);
});

for (const proposedHost of ["USB-A to USB-C", "usb-a"]) test(`adapter correction preserves known host instead of storing ${proposedHost}`, () => {
  const { run, store, input } = setup();
  input.text = "My laptop has USB-C";
  assert.equal(run("remember_requirements", remember({
    compatibility: { ...remember().compatibility, hostConnection: "usb-c" },
  })).ok, true);
  input.text = "I have a USB-A to USB-C dongle";
  const saved = run("remember_requirements", remember({
    compatibility: { ...remember().compatibility, hostConnection: proposedHost },
  }));
  assert.equal(saved.ok, true, saved.reason);
  assert.equal((saved.snapshot.hardConstraints.compatibility as { hostConnection: string }).hostConnection, "usb-c");
  assert.equal(saved.snapshot.preferences.adapterConnection, "usb-a to usb-c");
  assert.equal(saved.snapshot.preferences.ownedAdapter, "usb-a to usb-c");
  const reviewed = run("prepare_summary", { offerId: "MIC-022-A" });
  assert.equal(reviewed.ok, true, reviewed.reason);
  assert.equal(store.core.get(input.sessionId).receipt, null);
});

test("adapter ends and an unspecified dongle do not establish an unknown computer port", () => {
  for (const text of ["USB-A to USB-C dongle", "Yes, I have a dongle for it"]) {
    const { run, input } = setup();
    input.text = text;
    const saved = run("remember_requirements", remember({
      compatibility: { ...remember().compatibility, hostConnection: "usb-a" },
    }));
    assert.equal(saved.ok, true, saved.reason);
    assert.equal((saved.snapshot.hardConstraints.compatibility as { hostConnection?: string }).hostConnection, undefined);
    assert.equal(saved.snapshot.preferences.ownedAdapter, undefined);
    assert.equal(saved.snapshot.preferences.adapterConnection, text.startsWith("USB") ? "usb-a to usb-c" : undefined);
    const review = run("prepare_summary", { offerId: "MIC-022-A" });
    assert.equal(review.ok, false);
    assert.equal((review.data as { checkout: { needsHostConnection: boolean } }).checkout.needsHostConnection, true);
  }
});

test("a separate explicit computer-port statement can accompany an adapter path", () => {
  const { run, input } = setup();
  input.text = "I have a USB-A to USB-C dongle. My laptop has USB-C.";
  const saved = run("remember_requirements", remember({
    compatibility: { ...remember().compatibility, hostConnection: "USB-A to USB-C" },
  }));
  assert.equal(saved.ok, true, saved.reason);
  assert.equal((saved.snapshot.hardConstraints.compatibility as { hostConnection: string }).hostConnection, "usb-c");
  assert.equal(saved.snapshot.preferences.adapterConnection, "usb-a to usb-c");
});

for (const text of [
  "I want to buy the RODE. My laptop has USB-C and I have a USB-A to USB-C dongle",
  "Do I need anything else? My laptop has USB-C and I have a USB-A to USB-C dongle",
  "I use USB-C and have a dongle",
]) test(`separate purchase/question wording does not erase an explicit computer connector: ${text}`, () => {
  const { run, input } = setup();
  input.text = text;
  const saved = run("remember_requirements", remember({
    compatibility: { ...remember().compatibility, hostConnection: "usb-c" },
  }));
  assert.equal(saved.ok, true, saved.reason);
  assert.equal((saved.snapshot.hardConstraints.compatibility as { hostConnection: string }).hostConnection, "usb-c");
  if (text.includes("USB-A to USB-C"))
    assert.equal(saved.snapshot.preferences.ownedAdapter, "usb-a to usb-c");
  const reviewed = run("prepare_summary", { offerId: "MIC-022-A" });
  assert.equal(reviewed.ok, true, reviewed.reason);
});

for (const text of [
  'The instructions say "My laptop has USB-C". I have a USB-A to USB-C dongle.',
  "My laptop does not have USB-C. I have a USB-A to USB-C dongle.",
  "If my laptop has USB-C and I have a USB-A to USB-C dongle, will it work?",
]) test(`quoted, negated and hypothetical connector statements do not establish the computer port: ${text}`, () => {
  const { run, input } = setup();
  input.text = text;
  const saved = run("remember_requirements", remember({
    compatibility: { ...remember().compatibility, hostConnection: "usb-c" },
  }));
  assert.equal(saved.ok, true, saved.reason);
  assert.equal((saved.snapshot.hardConstraints.compatibility as { hostConnection?: string }).hostConnection, undefined);
});

test("capacity and shoe compartment requirements survive later preferences", () => {
  const { run, store, input } = setup();
  assert.equal(
    run(
      "remember_requirements",
      remember({ minimumCapacityL: 30, separateShoeCompartment: true }),
    ).ok,
    true,
  );
  assert.equal(
    run(
      "remember_requirements",
      remember({ preferences: [{ key: "color", value: "black" }] }),
    ).ok,
    true,
  );
  const constraints = store.get(input.sessionId)!.hardConstraints;
  assert.equal(constraints.minimumCapacityL, 30);
  assert.equal(constraints.separateShoeCompartment, true);
  assert.equal(
    run("remember_requirements", remember({ minimumCapacityL: 10 })).ok,
    false,
  );
});
test("cancelled turns cannot use read-only catalog tools", () => {
  const { run, store, input } = setup();
  store.core.cancel(input.sessionId, input.turnId);
  input.baseRevision = store.get(input.sessionId)!.revision;
  assert.equal(
    run("search_catalog", { category: null, query: null }).ok,
    false,
  );
});

test("five-product shortlist uses only three ranked cards and compare rejects five", () => {
  const { run, store, input } = setup();
  const products = PRODUCTS.filter(
    (p) =>
      p.category === "bags" &&
      store.quotes(input.sessionId, p.id).some((q) => q.eligible),
  ).slice(0, 5);
  assert.equal(products.length, 5);
  const shown = run("shortlist", {
    entries: products.map((p) => ({
      productId: p.id,
      fitReason: "A bag option",
      compromise: "Check its dimensions",
    })),
  });
  assert.equal(shown.ok, true, shown.reason);
  assert.equal(shown.snapshot.shortlistIds.length, 5);
  assert.deepEqual(
    store.core.get(input.sessionId).view!.cards.map((c) => c.rank),
    [1, 2, 3, null, null],
  );
  assert.equal(
    run("compare", { productIds: products.map((p) => p.id) }).ok,
    false,
  );
  assert.equal(
    run("compare", { productIds: products.slice(0, 4).map((p) => p.id) }).ok,
    true,
  );
});

function carousel() {
  const context = setup();
  const products = PRODUCTS.filter(
    (p) =>
      p.category === "bags" &&
      context.store
        .quotes(context.input.sessionId, p.id)
        .some((q) => q.eligible),
  ).slice(0, 3);
  const result = context.run("shortlist", {
    entries: products.map((p) => ({
      productId: p.id,
      fitReason: "Work and gym option",
      compromise: "Check the fit",
    })),
  });
  assert.equal(result.ok, true, result.reason);
  return { ...context, ids: result.snapshot.displayOrder };
}
test("carousel navigation wraps without changing stable product order or purchasing", () => {
  const { run, ids } = carousel();
  const navigate = (direction: string, position: number | null = null) =>
    run("navigate_products", { direction, position });
  assert.equal(navigate("first").snapshot.focusedProductId, ids[0]);
  assert.equal(navigate("previous").snapshot.focusedProductId, ids.at(-1));
  assert.equal(navigate("next").snapshot.focusedProductId, ids[0]);
  assert.equal(navigate("next").snapshot.focusedProductId, ids[1]);
  assert.equal(navigate("position", 1).snapshot.focusedProductId, ids[0]);
  const last = navigate("last");
  assert.deepEqual(last.snapshot.displayOrder, ids);
  assert.equal(last.snapshot.selectedOfferId, null);
  assert.equal(last.snapshot.approvalStatus, "not_prepared");
  assert.equal(navigate("position", 5).ok, false);
  assert.equal(navigate("next", 2).ok, false);
});
test("carousel navigation handles empty, stale and cancelled turns safely", () => {
  const empty = setup();
  const missing = empty.run("navigate_products", {
    direction: "next",
    position: null,
  });
  assert.equal(missing.ok, false);
  assert.match(missing.reason!, /any products/);
  const { run, store, input } = carousel();
  input.baseRevision -= 1;
  assert.match(
    run("navigate_products", { direction: "next", position: null }).reason!,
    /Stale/,
  );
  store.core.cancel(input.sessionId, input.turnId);
  input.baseRevision = store.get(input.sessionId)!.revision;
  assert.match(
    run("navigate_products", { direction: "next", position: null }).reason!,
    /cancelled/,
  );
});
test("navigation shortcut recognizes standalone speech without swallowing requests", () => {
  for (const text of [
    "Next",
    "Show me the next one, please.",
    "Please go to the next product",
  ])
    assert.deepEqual(parseProductNavigation(text), {
      direction: "next",
      position: null,
    });
  assert.deepEqual(parseProductNavigation("Go back"), {
    direction: "previous",
    position: null,
  });
  assert.deepEqual(parseProductNavigation("Show me the last one"), {
    direction: "last",
    position: null,
  });
  assert.deepEqual(parseProductNavigation("Show me the second bag"), {
    direction: "position",
    position: 2,
  });
  for (const text of [
    "Show me the next one and buy it",
    "next cheapest bag",
    "go back to my previous budget",
    "Show me cheaper bags",
  ])
    assert.equal(parseProductNavigation(text), null);
});

test("an explicitly opened microphone chooser is authoritative and waits for the shopper", () => {
  const { run, input, store } = setup();
  input.text = "My calls sound bad in a noisy room. Show me some options.";
  const mic = PRODUCTS.find((product) => product.category === "audio" && product.solutionType === "clip_on")!;
  const entries = [{ productId: mic.id, fitReason: "A microphone to explore", compromise: "Check the connection" }];
  const directions = run("show_solution_types", { question: "Will you mostly sit at a desk, or move around?" });
  assert.equal(directions.ok, true, directions.reason);
  assert.equal(directions.snapshot.view, "solution_types");
  assert.deepEqual(directions.snapshot.displayOrder, []);
  assert.equal(directions.snapshot.preferences.audioDirectionPending, true);
  assert.equal(run("shortlist", { entries }).ok, false);
  assert.equal(run("choose_solution_type", { solutionType: "clip_on" }).ok, false, "showing choices is not the shopper choosing");
  assert.equal(run("remember_requirements", remember({ preferences: [{ key: "solutionType", value: "headset" }] })).ok, false);
  assert.equal(run("set_priority", { priority: "best_value" }).ok, true);
  assert.equal(run("shortlist", { entries }).ok, false, "changing priority must not bypass unresolved direction");

  input.turnId = "choose-direction";
  input.eventId = "choose-direction-input";
  input.text = "Okay, I want the lavalier";
  input.baseRevision = store.get(input.sessionId)!.revision;
  input.visibleRevision = input.baseRevision;
  store.ingestInput(input);
  input.baseRevision = store.get(input.sessionId)!.revision;
  const chosen = run("choose_solution_type", { solutionType: "clip_on" });
  assert.equal(chosen.ok, true, chosen.reason);
  assert.equal(chosen.snapshot.preferences.solutionType, "clip_on");
  assert.equal(chosen.snapshot.preferences.audioDirectionPending, false);
  const headset = PRODUCTS.find((product) => product.solutionType === "headset")!;
  assert.equal(run("shortlist", { entries: [{ ...entries[0], productId: headset.id }] }).ok, false, "chosen lavalier direction must not turn into headset recommendations");
  assert.equal(run("shortlist", { entries }).snapshot.view, "shortlist");
});

test("useful audio recommendations do not require a visual chooser or a formal kind selection", () => {
  const { run, input } = setup();
  input.text = "I sit at the same desk for calls, want my ears free, and can keep the mic close. Show me suitable options.";
  const mic = PRODUCTS.find((product) => product.solutionType === "directional_desktop")!;
  const shown = run("shortlist", { entries: [{ productId: mic.id, fitReason: "Works from a fixed desk position", compromise: "Keep it close to your mouth" }] });
  assert.equal(shown.ok, true, shown.reason);
  assert.equal(shown.snapshot.view, "shortlist");
  assert.equal(shown.snapshot.buyingPriority, null);
});

test("an informed microphone request can choose directly without a forced discovery or priority stage", () => {
  const { run, input } = setup();
  input.text = "Show me a directional desk microphone";
  const chosen = run("choose_solution_type", { solutionType: "directional_desktop" });
  assert.equal(chosen.ok, true, chosen.reason);
  const mic = PRODUCTS.find((product) => product.solutionType === "directional_desktop")!;
  const shown = run("shortlist", { entries: [{ productId: mic.id, fitReason: "A desk microphone", compromise: "Place it near your mouth" }] });
  assert.equal(shown.ok, true, shown.reason);
  assert.equal(shown.snapshot.view, "shortlist");
  assert.equal(shown.snapshot.buyingPriority, null);
});

test("unresolved microphone guidance does not block a shopper switching to bags", () => {
  const { run, input } = setup();
  input.text = "Help me decide which mic setup I need";
  assert.equal(run("show_solution_types", { question: "Will you move around?" }).ok, true);
  input.text = "Actually, show me bags instead";
  const bag = PRODUCTS.find((product) => product.category === "bags")!;
  const shown = run("shortlist", { entries: [{ productId: bag.id, fitReason: "Everyday carry", compromise: "Check its dimensions" }] });
  assert.equal(shown.ok, true, shown.reason);
  assert.equal(shown.snapshot.view, "shortlist");
  assert.deepEqual(shown.snapshot.displayOrder, [bag.id]);
});

// Media must not silently switch the shopper's model or grant purchasing authority.
test("Wireless PRO review uses the exact visible product and leaves checkout untouched", () => {
  const h = setup();
  assert.equal(h.run("show_product_video", { productId: "MIC-062" }).ok, false);
  assert.equal(h.run("shortlist", { entries: [{ productId: "MIC-062", fitReason: "Wearable", compromise: "Crowded-room performance unverified" }] }).ok, true);
  const before = h.store.get(h.input.sessionId)!;
  const result = h.run("show_product_video", { productId: "MIC-062" });
  assert.equal(result.ok, true);
  assert.equal((result.data as any).url, "https://www.youtube.com/shorts/WCsWHqMdPJI");
  assert.equal(result.snapshot.revision, before.revision);
  assert.equal(result.snapshot.selectedOfferId, before.selectedOfferId);
  assert.equal(h.run("show_product_video", { productId: "MIC-040" }).ok, false);
  assert.equal(h.store.core.get(h.input.sessionId).receipt, null);
});


test("related review preserves the visible product and explicit YouTube destination", () => {
  const h = setup();
  h.run("shortlist", {
    entries: [
      {
        productId: "MIC-040",
        fitReason: "Wearable",
        compromise: "Check host compatibility",
      },
    ],
  });
  const before = h.store.get(h.input.sessionId)!;
  h.input.text = "I want to watch it on YouTube";
  const review = h.run("show_product_video", { productId: "MIC-040" });
  assert.equal(review.ok, true);
  assert.equal((review.data as any).destination, "chrome");
  assert.equal((review.data as any).requestedProductId, "MIC-040");
  assert.equal((review.data as any).productId, "MIC-062");
  assert.match((review.data as any).instruction, /RELATED MODEL/);
  assert.equal(review.snapshot.focusedProductId, before.focusedProductId);
  assert.equal(review.snapshot.selectedOfferId, before.selectedOfferId);
  h.input.text = "Show me a video review";
  assert.equal(
    (h.run("show_product_video", { productId: "MIC-040" }).data as any)
      .destination,
    "inline",
  );
});
