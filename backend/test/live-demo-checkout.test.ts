import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SessionStore, isLiveDemoConfirmation, type LiveDemoCompletion } from "../src/store.ts";
import { nonTechProfile } from "../src/catalog.ts";
import { checkoutCopy } from "../src/checkout-copy.ts";

function review(displayed = true, classification: "proxy" | "real" = "proxy") {
  const profile = structuredClone(nonTechProfile);
  profile.catalog.offers.find((offer) => offer.id === "commuter-tote-express")!.classification = classification;
  const store = new SessionStore(60_000, profile);
  let s = store.create("urgent-bag").session;
  s = store.input(s.id, { sessionId: s.id, epoch: s.epoch, eventId: randomUUID(),
    turnId: randomUUID(), baseRevision: s.revision, modality: "voice", text: "Review this bag",
    visibleRevision: s.revision, visibleProductIds: s.displayOrder });
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id,
    shortlist: ["commuter-tote"], selection: { offerId: "commuter-tote-express", quantity: 1 } }).session;
  s = store.summarize(s.id, s.revision, s.turn!.id);
  if (displayed) s = store.presentation(s.id, { epoch: s.epoch, eventId: randomUUID(),
    expectedRevision: s.revision, summaryId: s.summary!.id, summaryRevision: s.summary!.revision,
    turnId: s.summary!.responseTurnId, textHash: s.summary!.textHash, event: "displayed" });
  const input: LiveDemoCompletion = { epoch: s.epoch, expectedRevision: s.revision,
    summaryId: s.summary!.id, summaryRevision: s.summary!.revision,
    responseTurnId: s.summary!.responseTurnId, delegationId: "server-delegation-1", transcript: "confirm" };
  return { store, s, input };
}
const code = (value: string) => (error: unknown) => (error as {code?: string}).code === value;

test("Live rehearsal completes only a displayed proxy summary and returns one immutable receipt", () => {
  const { store, s, input } = review();
  assert.equal(s.summary!.playback, "pending");
  assert.equal(s.summary!.approvalNonce, null);
  const first = store.completeLiveDemo(s.id, input);
  assert.equal(first.session.stage, "receipt");
  assert.equal(first.receipt.simulated, true);
  assert.equal(first.receipt.completionSource, "live_demo");
  assert.equal(first.receipt.summaryRevision, input.summaryRevision);
  assert.deepEqual(first.receipt.quote, s.summary!.quote);
  assert.equal(first.session.summary!.approvalNonce, null);
  assert.equal(first.session.summary!.playback, "pending");
  assert.equal(first.session.history.at(-1)!.modality, "live_demo");
  const again = store.completeLiveDemo(s.id, { ...input, expectedRevision: first.session.revision });
  assert.equal(again.receipt.id, first.receipt.id);
  assert.equal(again.session.revision, first.session.revision);
  first.receipt.quote.offer.sellerName = "mutated";
  assert.notEqual(store.get(s.id).receipt!.quote.offer.sellerName, "mutated");
  assert.throws(() => store.completeLiveDemo(s.id, { ...input, transcript: "confirm purchase" }), code("EVENT_CONFLICT"));
  assert.throws(() => store.approve(s.id, { expectedRevision: again.session.revision,
    summaryId: input.summaryId, turnId: input.responseTurnId, transcript: "confirm" }), code("ORDER_COMPLETE"));
});

test("Live rehearsal rejects undisplayed, stale, changed and non-proxy orders without modifying review", () => {
  const undisplayed = review(false);
  assert.throws(() => undisplayed.store.completeLiveDemo(undisplayed.s.id, undisplayed.input), code("STALE_SUMMARY"));
  const real = review(true, "real");
  assert.throws(() => real.store.completeLiveDemo(real.s.id, real.input), code("LIVE_DEMO_ONLY"));
  for (const patch of [{ summaryId: "old" }, { summaryRevision: -1 }, { responseTurnId: "old" }, { expectedRevision: -1 }, { epoch: -1 }]) {
    const { store, s, input } = review();
    assert.throws(() => store.completeLiveDemo(s.id, { ...input, ...patch }));
    assert.deepEqual(store.get(s.id), s);
  }
  const changed = review();
  changed.store.profile.catalog.offers.find((offer) => offer.id === "commuter-tote-express")!.unitPrice += 100;
  assert.throws(() => changed.store.completeLiveDemo(changed.s.id, changed.input), code("STALE_QUOTE"));
  assert.deepEqual(changed.store.get(changed.s.id), changed.s);
});

test("Live rehearsal requires whole-utterance approval and never invents trusted voice evidence", () => {
  for (const transcript of ["confirm", "Confirm!", "confirm purchase", "yes, confirm", "yes confirm purchase", "Confirm this simulated purchase."])
    assert.equal(isLiveDemoConfirmation(transcript), true, transcript);
  for (const transcript of ["yes", "looks good", "confirm?", '"confirm"', "don't confirm", "confirm, no wait", "I said confirm", "confirm and change the address"])
    assert.equal(isLiveDemoConfirmation(transcript), false, transcript);
  const { store, s, input } = review();
  assert.throws(() => store.completeLiveDemo(s.id, { ...input, final: true } as LiveDemoCompletion));
  assert.throws(() => store.completeLiveDemo(s.id, { ...input, transcript: "confirm, no wait" }), code("AMBIGUOUS_APPROVAL"));
  assert.throws(() => store.approve(s.id, { expectedRevision: s.revision,
    summaryId: input.summaryId, turnId: input.responseTurnId, transcript: "confirm",
    final: true, confidence: 1, source: "shopper", echoDetected: false }), code("APPROVAL_NOT_READY"));
  assert.deepEqual(store.get(s.id), s);
});

test("canonical checkout speech removes implementation labels while preserving requirements and prices", () => {
  const { s } = review();
  assert.doesNotMatch(s.summary!.spokenText, /\b(?:demo|simulated|synthetic|hypothetical|proxy|fictional)\b/i);
  assert.match(s.summary!.spokenText, /total SGD 89\.00/);
  assert.match(s.summary!.spokenText, /Would you like me to place this order\? You can also change it or cancel\./);
  assert.match(checkoutCopy("DEMO: return unused/unwashed within 14 days of simulated delivery; outbound shipping excluded, USD 5 return postage."), /14 days of delivery; outbound shipping excluded, USD 5 return postage/);
  assert.match(checkoutCopy("This simulated offer is withheld pending the manufacturer's recall serial-number verification."), /withheld pending.*recall serial-number verification/);
  assert.equal(checkoutCopy("DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)"), "Selected delivery destination");
  assert.equal(checkoutCopy("Demo Value Seller — fictional"), "Value option");
});

test("Live completion accepts a natural purchase instruction and preserves the observed transcript", () => {
  const { store, s, input } = review();
  const transcript = "Yes I approved this, can we just buy this";
  const result = store.completeLiveDemo(s.id, { ...input, transcript });
  assert.equal(result.session.stage, "receipt");
  assert.equal(result.session.history.at(-1)?.text, transcript);
  assert.equal(result.receipt.summaryId, s.summary!.id);
  assert.deepEqual(result.receipt.quote, s.summary!.quote);
});

test("short Live assent requires the current displayed order approval context", () => {
  const { store, s, input } = review();
  const assent = { ...input, transcript: "yes please" };
  assert.throws(() => store.completeLiveDemo(s.id, assent), code("AMBIGUOUS_APPROVAL"));
  assert.deepEqual(store.get(s.id), s);
  assert.throws(() => store.completeLiveDemo(s.id, { ...assent, affirmationSummaryId: "old-order" }), code("STALE_SUMMARY"));
  assert.deepEqual(store.get(s.id), s);
  const accepted = { ...assent, affirmationSummaryId: s.summary!.id };
  const first = store.completeLiveDemo(s.id, accepted);
  assert.equal(first.session.history.at(-1)?.text, "yes please");
  const replay = store.completeLiveDemo(s.id, { ...accepted, expectedRevision: first.session.revision });
  assert.equal(replay.receipt.id, first.receipt.id);
  const undisplayed = review(false);
  assert.throws(() => undisplayed.store.completeLiveDemo(undisplayed.s.id, { ...undisplayed.input, transcript: "yes", affirmationSummaryId: undisplayed.s.summary!.id }), code("STALE_SUMMARY"));
});

test("natural purchase commands cannot create an order without a current review", () => {
  const store = new SessionStore(60_000, structuredClone(nonTechProfile));
  const initial = store.create().session;
  const s = store.beginTurn(initial.id, initial.revision);
  for (const transcript of ["please buy it", "yes"]) {
    assert.throws(() => store.completeLiveDemo(s.id, { epoch: s.epoch, expectedRevision: s.revision, summaryId: "missing", summaryRevision: s.revision, responseTurnId: s.turn!.id, delegationId: `no-order-${transcript.length}`, transcript, affirmationSummaryId: "missing" }), code("STALE_SUMMARY"));
    assert.deepEqual(store.get(s.id), s);
    assert.equal(store.get(s.id).receipt, null);
  }
});
