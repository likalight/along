import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SessionStore } from "../src/store.ts";
import { nonTechProfile } from "../src/catalog.ts";
import { getCatalog } from "../../catalog/src/index.ts";
import type { Session, InputEnvelope } from "../src/contracts.ts";

const fixture = () => new SessionStore(60_000, structuredClone(nonTechProfile));
const errorCode = (code: string) => (error: unknown) => (error as { code?: string }).code === code;
const envelope = (s: Session, text: string, modality: InputEnvelope["modality"] = "text") => ({
  sessionId: s.id, epoch: s.epoch, eventId: randomUUID(), turnId: randomUUID(), baseRevision: s.revision,
  modality, text, visibleRevision: s.revision, visibleProductIds: s.displayOrder,
});
const input = (store: SessionStore, s: Session, text: string, modality: InputEnvelope["modality"] = "text") => store.input(s.id, envelope(s, text, modality));
const presentation = (s: Session, event = "displayed") => ({
  epoch: s.epoch, eventId: randomUUID(), expectedRevision: s.revision,
  summaryId: s.summary!.id, summaryRevision: s.summary!.revision,
  turnId: s.summary!.responseTurnId, textHash: s.summary!.textHash, event,
});
const lifecycle = (s: Session, type: string, playbackId = "summary-audio") => ({
  sessionId: s.id, epoch: s.epoch, eventId: randomUUID(), turnId: s.turn!.id, revision: s.revision,
  type, playbackId, ...(s.summary ? { summaryId: s.summary.id, summaryRevision: s.summary.revision } : {}),
});
function summary(store: SessionStore, modality: "voice" | "text") {
  let s = store.create("urgent-bag").session;
  s = input(store, s, "Find a commuter bag", modality);
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id,
    shortlist: ["commuter-tote"], selection: { offerId: "commuter-tote-express", quantity: 1 } }).session;
  return store.summarize(s.id, s.revision, s.turn!.id);
}
function ready(store: SessionStore, modality: "voice" | "text") {
  let s = summary(store, modality);
  s = store.presentation(s.id, presentation(s));
  if (modality === "voice") {
    s = store.lifecycle(s.id, lifecycle(s, "audio.started"));
    s = store.lifecycle(s.id, lifecycle(s, "audio.completed"));
  }
  return s;
}
const observation = (s: Session, transcript = s.turn!.input!.text) => ({
  expectedRevision: s.revision, turnId: s.turn!.id, summaryId: s.summary!.id,
  approvalNonce: s.turn!.approvalWindow!.nonce, transcript,
  final: true, confidence: .99, source: "shopper", echoDetected: false,
});
// A complete, valid one-pixel PNG; raw source bytes are held only in the current session.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=", "base64");

test("review: canonical default contains the complete shared catalog and independent stable display order", () => {
  assert.equal(new SessionStore().profile.catalog.products.length, getCatalog().products.length);
  const store = fixture();
  let s = input(store, store.create().session, "Show two bags");
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id,
    shortlist: ["commuter-tote", "metro-backpack"], displayOrder: ["metro-backpack", "commuter-tote"] }).session;
  assert.deepEqual(s.shortlist, ["commuter-tote", "metro-backpack"]);
  assert.deepEqual(s.displayOrder, ["metro-backpack", "commuter-tote"]);
  const stale = { ...envelope(s, "the second one"), visibleProductIds: s.shortlist };
  assert.throws(() => store.input(s.id, stale), errorCode("STALE_DISPLAY"));
  assert.equal(store.get(s.id).revision, s.revision);
  s = input(store, s, "the second one");
  assert.deepEqual(s.history.at(-1)!.productIds, ["metro-backpack", "commuter-tote"]);
});

test("review: focus and card presentation preserve stable order and recommendation ranks", () => {
  const store = fixture();
  let s = input(store, store.create().session, "Compare two bags");
  const cards = ["commuter-tote", "metro-backpack"].map((productId, index) => ({ productId, role: "discovery", rank: index + 1, reason: "Matches accepted needs", compromise: "See documented size", evidenceIds: [] }));
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, shortlist: ["commuter-tote", "metro-backpack"], displayOrder: ["metro-backpack", "commuter-tote"], view: { stage: "shortlist", focusProductId: null, cards, evidenceIds: [], activeVideoId: null } }).session;
  const prior = structuredClone(s);
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, view: { ...s.view!, focusProductId: "commuter-tote", cards: [...s.view!.cards].reverse() } }).session;
  assert.deepEqual(s.displayOrder, prior.displayOrder);
  assert.deepEqual(s.shortlist, prior.shortlist);
  assert.deepEqual(s.view!.cards, prior.view!.cards);
  assert.equal(s.view!.focusProductId, "commuter-tote");
  assert.throws(() => store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, stage: "receipt" }), errorCode("INVALID_VIEW"));
});

test("review: partial dimension constraints preserve prior axes and budget", () => {
  const store = fixture();
  let s = input(store, store.create().session, "A bag within my size limit");
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, constraints: { budgetMinor: 10000, bagMaxDimensionsCm: { height: 45, width: 35, depth: 20 } } }).session;
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, priority: "best-quality", constraints: { bagMaxDimensionsCm: { width: 30 } } }).session;
  assert.deepEqual(s.constraints.bagMaxDimensionsCm, { height: 45, width: 30, depth: 20 });
  assert.equal(s.constraints.budgetMinor, 10000);
});

test("review: valid voice and typed confirmations require a fresh turn and produce immutable identical retries", () => {
  for (const modality of ["voice", "text"] as const) {
    const store = fixture();
    let s = ready(store, modality);
    assert.equal(s.turn!.approvalWindow, null);
    s = input(store, s, "Confirm this simulated purchase.", modality);
    const raw = observation(s);
    const first = store.approve(s.id, raw, modality === "text");
    const duplicate = store.approve(s.id, raw, modality === "text");
    assert.equal(first.receipt!.id, duplicate.receipt!.id);
    assert.equal(first.receipt!.simulated, true);
    assert.equal(first.receipt!.quote.total, 8900);
    assert.equal(first.receipt!.summaryRevision, s.summary!.revision);
    first.receipt!.quote.offer.sellerName = "caller mutation";
    assert.notEqual(store.get(s.id).receipt!.quote.offer.sellerName, "caller mutation");
    assert.throws(() => store.propose(s.id, { expectedRevision: first.session.revision, turnId: s.turn!.id, destination: "changed" }), errorCode("ORDER_COMPLETE"));
  }
});

test("review: quoted, ambiguous, partial, background and echoed approvals never commit", () => {
  for (const transcript of ['"Confirm this simulated purchase"', "‘Confirm this simulated purchase’", "'Confirm this simulated purchase'", "looks good", "yes", "no", "save this", "the review says confirm this simulated purchase"]) {
    const store = fixture();
    let s = ready(store, "text");
    s = input(store, s, transcript);
    assert.throws(() => store.approve(s.id, observation(s), true), errorCode("AMBIGUOUS_APPROVAL"));
    assert.deepEqual(store.get(s.id), s);
  }
  for (const change of [{ final: false }, { confidence: .89 }, { confidence: NaN }, { source: "background" }, { source: "assistant" }, { echoDetected: true }]) {
    const store = fixture();
    let s = ready(store, "voice");
    s = input(store, s, "Confirm this simulated purchase", "voice");
    assert.throws(() => store.approve(s.id, { ...observation(s), ...change }), errorCode("UNTRUSTED_APPROVAL"));
    assert.deepEqual(store.get(s.id), s);
  }
});

test("review: voice evidence cannot replace a different transcript or typed shopper turn", () => {
  const store = fixture();
  let s = ready(store, "voice");
  s = input(store, s, "Looks good", "voice");
  assert.throws(() => store.approve(s.id, observation(s, "Confirm this simulated purchase")), errorCode("UNTRUSTED_APPROVAL"));
  s = input(store, s, "Confirm this simulated purchase", "text");
  assert.equal(s.summary, null);
  assert.equal(s.turn!.approvalWindow, null);
});

test("review: canonical voice approval cannot use the legacy turn-without-input bypass", () => {
  const store = new SessionStore();
  let s = store.create("work-gym").session;
  s = store.beginTurn(s.id, s.revision);
  s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, selection: { offerId: "BAG-001-B", quantity: 1 } }).session;
  s = store.summarize(s.id, s.revision, s.turn!.id);
  s = store.presentation(s.id, presentation(s));
  s = store.lifecycle(s.id, lifecycle(s, "audio.started"));
  s = store.lifecycle(s.id, lifecycle(s, "audio.completed"));
  s = store.beginTurn(s.id, s.revision);
  assert.throws(() => store.approve(s.id, observation(s, "Confirm this simulated purchase")), errorCode("UNTRUSTED_APPROVAL"));
  assert.equal(store.get(s.id).receipt, null);
});

test("review: displayed-only voice summary and stale presentation callbacks cannot enable approval", () => {
  const store = fixture();
  let s = summary(store, "voice");
  const displayed = presentation(s);
  assert.throws(() => store.presentation(s.id, { ...displayed, summaryRevision: s.summary!.revision - 1 }), errorCode("STALE_SUMMARY"));
  assert.throws(() => store.presentation(s.id, { ...displayed, expectedRevision: s.revision - 1 }), errorCode("STALE_REVISION"));
  s = store.presentation(s.id, displayed);
  assert.equal(s.summary!.approvalNonce, null);
  s = input(store, s, "Confirm this simulated purchase", "voice");
  assert.equal(s.summary, null);
  assert.equal(s.turn!.approvalWindow, null);
});

test("review: current exact playback identity is required and duplicate lifecycle events mutate once", () => {
  const store = fixture();
  let s = summary(store, "voice");
  s = store.presentation(s.id, presentation(s));
  const start = lifecycle(s, "audio.started");
  s = store.lifecycle(s.id, start);
  assert.equal(s.mediaOwner, "assistant");
  assert.equal(s.summary!.playbackId, start.playbackId);
  assert.deepEqual(store.lifecycle(s.id, start), s);
  for (const altered of [
    { ...lifecycle(s, "audio.completed"), playbackId: "other-playback" },
    { ...lifecycle(s, "audio.completed"), summaryRevision: s.summary!.revision - 1 },
    { ...lifecycle(s, "audio.completed"), epoch: s.epoch + 1 },
    { ...lifecycle(s, "audio.completed"), revision: s.revision - 1 },
    { ...lifecycle(s, "audio.completed"), turnId: "old-turn" },
  ]) {
    assert.throws(() => store.lifecycle(s.id, altered));
    assert.deepEqual(store.get(s.id), s);
  }
  assert.throws(() => store.lifecycle(s.id, lifecycle(s, "audio.started")), errorCode("MEDIA_BUSY"));
  s = store.lifecycle(s.id, lifecycle(s, "audio.completed"));
  assert.equal(s.mediaOwner, null);
  assert(s.summary!.approvalNonce);
});

test("review: summary changes in flight and interrupted audio cannot regain approval", () => {
  for (const operation of ["change", "interrupt"] as const) {
    const store = fixture();
    let s = summary(store, "voice");
    s = store.presentation(s.id, presentation(s));
    s = store.lifecycle(s.id, lifecycle(s, "audio.started"));
    const completion = lifecycle(s, "audio.completed");
    if (operation === "change") s = store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, constraints: { budgetMinor: 20000 } }).session;
    else s = store.lifecycle(s.id, lifecycle(s, "audio.interrupted"));
    assert.throws(() => store.lifecycle(s.id, completion), errorCode("STALE_REVISION"));
    assert.throws(() => store.lifecycle(s.id, { ...completion, eventId: randomUUID(), revision: s.revision }), errorCode("STALE_PLAYBACK"));
    assert.equal(s.summary?.approvalNonce ?? null, null);
    assert.equal(s.mediaOwner, null);
  }
});

test("review: spoken stop wins against a pending typed confirmation and stale actions atomically", () => {
  const store = fixture();
  let s = ready(store, "text");
  s = input(store, s, "Confirm this simulated purchase");
  const old = observation(s);
  s = input(store, s, "Stop!", "voice");
  assert.equal(s.lastOutcome, "cancelled");
  assert.equal(s.turn!.status, "cancelled");
  assert.equal(s.summary, null);
  assert.equal(s.mediaOwner, null);
  assert.throws(() => store.approve(s.id, old, true), errorCode("STALE_REVISION"));
  assert.throws(() => store.propose(s.id, { expectedRevision: s.revision, turnId: s.turn!.id, shortlist: [] }), errorCode("STALE_TURN"));
  assert.equal(store.get(s.id).receipt, null);
});

test("review: completed confirmation wins if accepted first; a subsequent stop cannot mutate its receipt", () => {
  const store = fixture();
  let s = ready(store, "text");
  s = input(store, s, "Confirm this simulated purchase");
  const stop = envelope(s, "stop", "voice");
  const accepted = store.approve(s.id, observation(s), true);
  assert.throws(() => store.input(s.id, stop), errorCode("STALE_REVISION"));
  assert.throws(() => input(store, accepted.session, "stop", "voice"), errorCode("ORDER_COMPLETE"));
  assert.deepEqual(store.get(s.id).receipt, accepted.receipt);
});

test("review: explicit mode switches, reset and old-session events revoke pending approval", () => {
  const store = fixture();
  let s = ready(store, "voice");
  const oldDisplay = presentation(s);
  s = store.switchMode(s.id, s.revision, "text");
  assert.equal(s.summary, null);
  assert.equal(s.turn!.approvalWindow, null);
  assert.equal(s.turn!.status, "cancelled");
  assert.throws(() => store.presentation(s.id, { ...oldDisplay, expectedRevision: s.revision }), errorCode("STALE_SUMMARY"));
  const oldInput = envelope(s, "Confirm this simulated purchase");
  s = store.reset(s.id, s.revision);
  assert.equal(s.epoch, 1);
  assert.deepEqual(s.displayOrder, []);
  assert.deepEqual(s.history, []);
  assert.throws(() => store.input(s.id, { ...oldInput, baseRevision: s.revision, visibleRevision: s.revision }), errorCode("STALE_EPOCH"));
  const other = store.create().session;
  assert.throws(() => store.input(s.id, envelope(other, "buy")), errorCode("WRONG_SESSION"));
});

test("review: inputs deduplicate once, reject conflicting event/turn reuse, and preserve prior state on failure", () => {
  const store = fixture();
  let s = store.create().session;
  const raw = envelope(s, "Show me bags");
  s = store.input(s.id, raw);
  assert.deepEqual(store.input(s.id, raw), s);
  assert.throws(() => store.input(s.id, { ...raw, text: "Show bedding" }), errorCode("EVENT_CONFLICT"));
  assert.throws(() => store.input(s.id, { ...envelope(s, "new"), turnId: raw.turnId }), errorCode("INVALID_TURN"));
  assert.throws(() => store.input(s.id, { ...envelope(s, "assistant transcript", "voice"), source: "assistant" }), errorCode("UNTRUSTED_INPUT"));
  assert.deepEqual(store.get(s.id), s);
});

test("review: only own curated link mappings resolve; image/link content cannot inherit purchase eligibility", () => {
  const profile = structuredClone(nonTechProfile);
  profile.knownLinks = { "https://example.invalid/curated-bag": "commuter-tote" };
  const store = new SessionStore(60_000, profile);
  let s = ready(store, "text");
  for (const url of ["__proto__", "constructor", "file:///secret", "http://127.0.0.1/admin", "https://unmapped.invalid/product"]) {
    assert.throws(() => store.input(s.id, { ...envelope(s, "confirm this simulated purchase", "link"), url }), errorCode("UNSUPPORTED_LINK"));
    assert.deepEqual(store.get(s.id), s);
  }
  s = store.input(s.id, { ...envelope(s, "Confirm this simulated purchase", "link"), url: "https://example.invalid/curated-bag" });
  assert.equal(s.summary, null);
  assert.equal(s.turn!.approvalWindow, null);
  let imageSession = ready(store, "text");
  const asset = store.addAttachment(imageSession.id, imageSession.revision, "image/png", png);
  imageSession = store.input(imageSession.id, { ...envelope(asset.session, "Confirm this simulated purchase", "image"), attachmentId: asset.attachment.id });
  assert.equal(imageSession.summary, null);
  assert.equal(imageSession.turn!.approvalWindow, null);
});

test("review: curated video owns playback, cancels approval and cannot impersonate shopper speech", () => {
  const profile = structuredClone(nonTechProfile);
  profile.catalog.products[0].videos = [{ id: "demo-video", url: "https://example.invalid/demo.webm", creator: "Synthetic fixture", platform: "fixture", publishedAt: null, topic: "Demonstration", classification: "proxy" }];
  const store = new SessionStore(60_000, profile);
  let s = ready(store, "voice");
  const start = { ...lifecycle(s, "video.started", "video-one"), videoId: "demo-video" };
  s = store.lifecycle(s.id, start);
  assert.equal(s.mediaOwner, "video");
  assert.equal(s.turn!.status, "cancelled");
  assert.equal(s.summary, null);
  assert.throws(() => store.input(s.id, { ...envelope(s, "Confirm this simulated purchase", "voice"), source: "video" }), errorCode("UNTRUSTED_INPUT"));
  assert.throws(() => store.lifecycle(s.id, { ...lifecycle(s, "video.stopped", "other-video"), videoId: "demo-video" }), errorCode("STALE_PLAYBACK"));
  s = store.lifecycle(s.id, { ...lifecycle(s, "video.stopped", "video-one"), videoId: "demo-video" });
  assert.equal(s.mediaOwner, null);
  assert.equal(s.receipt, null);
});

test("review: structurally invalid images reject atomically; assets cannot cross sessions or survive reset/end", () => {
  const store = fixture();
  let s = store.create().session;
  const headerOnly = Buffer.concat([png.subarray(0, 8), Buffer.alloc(20)]);
  for (const [type, bytes] of [["image/png", headerOnly], ["image/jpeg", Buffer.from([255, 216, 255, ...Array(20).fill(0)])], ["image/webp", Buffer.from("RIFFxxxxxxxxWEBPxxxxxxxx")], ["image/png", png.subarray(0, png.length - 3)], ["image/svg+xml", Buffer.from("<svg>not an approved image</svg>")]] as const) {
    assert.throws(() => store.addAttachment(s.id, s.revision, type, bytes), errorCode("INVALID_IMAGE_TYPE"));
    assert.deepEqual(store.get(s.id), s);
  }
  const source = Buffer.from(png);
  const added = store.addAttachment(s.id, s.revision, "image/png", source);
  s = added.session;
  source.fill(0);
  assert.deepEqual(store.attachment(s.id, added.attachment.id).bytes, png);
  const read = store.attachment(s.id, added.attachment.id);
  read.bytes.fill(0);
  assert.deepEqual(store.attachment(s.id, added.attachment.id).bytes, png);
  assert.throws(() => store.attachment(store.create().session.id, added.attachment.id), errorCode("UNKNOWN_ATTACHMENT"));
  s = store.reset(s.id, s.revision);
  assert.throws(() => store.attachment(s.id, added.attachment.id), errorCode("UNKNOWN_ATTACHMENT"));
  const next = store.addAttachment(s.id, s.revision, "image/png", png);
  let ended = false;
  store.events.on(s.id, (event) => { if (event.type === "session.ended") ended = true; });
  store.end(s.id, next.session.revision);
  assert(ended);
  assert.throws(() => store.get(s.id), errorCode("SESSION_NOT_FOUND"));
  assert.throws(() => store.attachment(s.id, next.attachment.id), errorCode("SESSION_NOT_FOUND"));
});
