import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SessionStore, isLiveDemoConfirmation, type LiveDemoCompletion, type InterpretedCheckoutApproval } from "../src/store.ts";
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
const interpretedApproval = (input: LiveDemoCompletion, requiresApprovalQuestion = false): InterpretedCheckoutApproval => ({
  intent: "approve_order", transcript: input.transcript, summaryId: input.summaryId,
  summaryRevision: input.summaryRevision, requiresApprovalQuestion,
});
const voiceInput = (store: SessionStore, s: ReturnType<SessionStore["get"]>, text: string) =>
  store.input(s.id, { sessionId: s.id, epoch: s.epoch, eventId: randomUUID(),
    turnId: randomUUID(), baseRevision: s.revision, modality: "voice", text,
    visibleRevision: s.revision, visibleProductIds: s.displayOrder });

test("server-interpreted approval completes the reviewed order without rewriting shopper language", () => {
  const { store, s, input: raw } = review();
  const input = { ...raw, transcript: "I'm happy with those details; let's get this sent out to me." };
  assert.throws(() => store.completeLiveDemo(s.id, input), code("AMBIGUOUS_APPROVAL"));
  const interpretation = interpretedApproval(input);
  const first = store.completeLiveDemo(s.id, input, interpretation);
  assert.equal(first.session.stage, "receipt");
  assert.equal(first.session.history.at(-1)?.text, input.transcript);
  assert.deepEqual(first.receipt.quote, s.summary!.quote);
  assert.equal(first.receipt.summaryId, s.summary!.id);
  assert.equal(first.session.summary!.approvalNonce, null);
  assert.equal(first.session.summary!.playback, "pending");
  const again = store.completeLiveDemo(s.id, { ...input, expectedRevision: first.session.revision }, interpretation);
  assert.equal(again.receipt.id, first.receipt.id);
  assert.equal(again.session.revision, first.session.revision);
  assert.throws(() => store.completeLiveDemo(s.id, input, { ...interpretation, requiresApprovalQuestion: true }), code("EVENT_CONFLICT"));
});

test("server interpretation is bound to the exact transcript and immutable review identity", () => {
  for (const patch of [
    { transcript: "A different shopper statement" }, { summaryId: "other-review" },
    { summaryRevision: -1 }, { intent: "change_order" }, { requiresApprovalQuestion: "false" },
  ]) {
    const { store, s, input } = review();
    assert.throws(() => store.completeLiveDemo(s.id, input,
      { ...interpretedApproval(input), ...patch } as InterpretedCheckoutApproval));
    assert.deepEqual(store.get(s.id), s);
  }
});

test("contextual semantic assent still needs the current order approval question", () => {
  const { store, s, input: raw } = review();
  const input = { ...raw, transcript: "That's exactly what I had in mind." };
  const interpretation = interpretedApproval(input, true);
  assert.throws(() => store.completeLiveDemo(s.id, input, interpretation), code("AMBIGUOUS_APPROVAL"));
  assert.throws(() => store.completeLiveDemo(s.id, { ...input, affirmationSummaryId: "old-review" }, interpretation), code("STALE_SUMMARY"));
  assert.deepEqual(store.get(s.id), s);
  const result = store.completeLiveDemo(s.id, { ...input, affirmationSummaryId: s.summary!.id }, interpretation);
  assert.equal(result.receipt.summaryId, s.summary!.id);
});

test("raw JSON cannot smuggle server interpretation into Live completion", () => {
  const { store, s, input } = review();
  for (const extra of [
    { interpretedApproval: interpretedApproval(input) }, { intent: "approve_order" },
    { requiresApprovalQuestion: false }, { semanticApproval: true },
  ]) {
    const raw = JSON.parse(JSON.stringify({ ...input, ...extra }));
    assert.throws(() => store.completeLiveDemo(s.id, raw), code("UNKNOWN_FIELD"));
    assert.deepEqual(store.get(s.id), s);
  }
});

test("a discovery handoff invalidates an earlier semantic approval proof in both checkout modes", () => {
  for (const liveMode of [false, true]) {
    const { store, s, input } = review();
    if (liveMode) store.enableLiveDemoCheckout(s.id);
    const after = store.importReference(s.id, {
      epoch: s.epoch, baseRevision: s.revision, eventId: randomUUID(),
      text: "External product reference; exact listing and seller remain unverified.",
    });
    assert.deepEqual(after.constraints, s.constraints);
    assert.equal(after.summary, null);
    assert.equal(after.turn!.approvalWindow, null);
    assert.throws(() => store.completeLiveDemo(s.id,
      { ...input, expectedRevision: after.revision }, interpretedApproval(input)),
    code(liveMode ? "STALE_SUMMARY" : "STALE_TURN"));
    assert.deepEqual(store.get(s.id), after);
    assert.equal(store.get(s.id).receipt, null);
  }
});

test("semantic approval cannot bypass displayed review, current quote or proxy-offer guards", () => {
  const undisplayed = review(false);
  assert.throws(() => undisplayed.store.completeLiveDemo(undisplayed.s.id, undisplayed.input,
    interpretedApproval(undisplayed.input)), code("STALE_SUMMARY"));
  const real = review(true, "real");
  assert.throws(() => real.store.completeLiveDemo(real.s.id, real.input,
    interpretedApproval(real.input)), code("LIVE_DEMO_ONLY"));
  const changed = review();
  changed.store.profile.catalog.offers.find((offer) => offer.id === "commuter-tote-express")!.unitPrice += 100;
  assert.throws(() => changed.store.completeLiveDemo(changed.s.id, changed.input,
    interpretedApproval(changed.input)), code("STALE_QUOTE"));
  for (const { store, s } of [undisplayed, real, changed]) assert.deepEqual(store.get(s.id), s);
});

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

test("opted-in Live review survives a delivery discussion and completes the same reviewed order", () => {
  const { store, s: reviewed, input } = review();
  store.enableLiveDemoCheckout(reviewed.id);
  let s = voiceInput(store, reviewed, "When does it arrive?");
  assert.notEqual(s.turn!.id, input.responseTurnId);
  assert.deepEqual(s.summary, reviewed.summary);
  assert.equal(s.turn!.approvalWindow, null);
  // A read-only answer may advance the session revision but not the order.
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id,
    needs: ["Delivery timing explained"] }, { includeOffers: false }).session;
  const first = store.completeLiveDemo(s.id, { ...input, expectedRevision: s.revision,
    transcript: "I want to place the order" });
  assert.equal(first.receipt.summaryId, reviewed.summary!.id);
  assert.deepEqual(first.receipt.quote, reviewed.summary!.quote);
  assert.equal(first.session.summary!.approvalNonce, null);
  assert.throws(() => store.propose(s.id, { expectedRevision: first.session.revision,
    turnId: s.turn!.id, constraints: { budgetMinor: 5000 } }), code("ORDER_COMPLETE"));
});

test("Live can approve the displayed order after interrupting its narration without enabling strict approval", () => {
  const { store, s: reviewed, input } = review();
  store.enableLiveDemoCheckout(reviewed.id);
  const playback = (s: ReturnType<SessionStore["get"]>, type: string) => ({
    sessionId: s.id, epoch: s.epoch, eventId: randomUUID(), revision: s.revision,
    turnId: s.turn!.id, type, playbackId: "interrupted-review",
    summaryId: s.summary!.id, summaryRevision: s.summary!.revision,
  });
  let s = store.lifecycle(reviewed.id, playback(reviewed, "audio.started"));
  s = store.lifecycle(s.id, playback(s, "audio.interrupted"));
  assert.equal(s.summary!.playback, "interrupted");
  s = voiceInput(store, s, "Confirm this simulated purchase");
  assert.equal(s.summary!.id, input.summaryId);
  assert.equal(s.summary!.approvalNonce, null);
  assert.equal(s.turn!.approvalWindow, null);
  assert.throws(() => store.approve(s.id, { expectedRevision: s.revision,
    summaryId: input.summaryId, turnId: s.turn!.id, transcript: s.turn!.input!.text,
    final: true, confidence: 1, source: "shopper", echoDetected: false }), code("APPROVAL_NOT_READY"));
  const accepted = store.completeLiveDemo(s.id, { ...input, expectedRevision: s.revision,
    transcript: "I want to place the order" });
  assert.equal(accepted.receipt.summaryId, input.summaryId);
  assert.equal(accepted.session.summary!.playback, "interrupted");
});

test("Live opt-in never retains an undisplayed or real-offer review across a new turn", () => {
  for (const { store, s, input } of [review(false), review(true, "real")]) {
    store.enableLiveDemoCheckout(s.id);
    const next = voiceInput(store, s, "When does it arrive?");
    assert.equal(next.summary, null);
    assert.throws(() => store.completeLiveDemo(s.id, { ...input,
      expectedRevision: next.revision }), code("STALE_SUMMARY"));
  }
});

test("material order changes invalidate a retained Live review", () => {
  for (const change of [
    { constraints: { budgetMinor: 12000 } },
    { constraints: { budgetMinor: 20000 }, selection: { offerId: "commuter-tote-express", quantity: 2 } },
    { destination: "A different delivery destination" },
  ]) {
    const { store, s: reviewed, input } = review();
    store.enableLiveDemoCheckout(reviewed.id);
    let s = voiceInput(store, reviewed, "Change the order details");
    s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id,
      ...change }, { includeOffers: false }).session;
    assert.equal(s.summary, null);
    assert.throws(() => store.completeLiveDemo(s.id, { ...input,
      expectedRevision: s.revision }), code("STALE_SUMMARY"));
    assert.equal(store.get(s.id).receipt, null);
  }
});

test("explicit cancellation and switching modes still revoke a Live review", () => {
  for (const action of ["cancel", "spoken-cancel", "text-mode"] as const) {
    const { store, s: reviewed, input } = review();
    store.enableLiveDemoCheckout(reviewed.id);
    const s = action === "cancel"
      ? store.cancel(reviewed.id, reviewed.turn!.id)
      : action === "spoken-cancel"
        ? voiceInput(store, reviewed, "cancel purchase")
        : store.switchMode(reviewed.id, reviewed.revision, "text");
    assert.equal(s.summary, null);
    assert.throws(() => store.completeLiveDemo(s.id, { ...input,
      expectedRevision: s.revision }), code("STALE_SUMMARY"));
    assert.equal(store.get(s.id).receipt, null);
  }
});

test("retained Live review still checks its quote and cannot cross a session reset", () => {
  const { store, s: reviewed, input } = review();
  store.enableLiveDemoCheckout(reviewed.id);
  let s = voiceInput(store, reviewed, "Explain the delivery estimate");
  store.profile.catalog.offers.find((offer) => offer.id === "commuter-tote-express")!.unitPrice += 100;
  assert.throws(() => store.completeLiveDemo(s.id, { ...input,
    expectedRevision: s.revision }), code("STALE_QUOTE"));
  s = store.reset(s.id, s.revision);
  assert.throws(() => store.completeLiveDemo(s.id, { ...input,
    expectedRevision: s.revision }), code("STALE_EPOCH"));
  assert.equal(store.get(s.id).summary, null);
  assert.equal(store.get(s.id).receipt, null);
});
