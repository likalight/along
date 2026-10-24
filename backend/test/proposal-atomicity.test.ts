import assert from "node:assert/strict";
import { test } from "node:test";
import { SessionStore } from "../src/store.ts";
import { alongProfile } from "../src/along-catalog.ts";
function setup() {
  const store = new SessionStore(undefined, alongProfile);
  const {session} = store.create();
  const state = store.beginTurn(session.id, session.revision);
  return {store, id: state.id, turnId: state.turn!.id};
}
test("rejected offer selection does not mutate any session fields or revision", () => {
  const {store,id,turnId} = setup();
  store.propose(id, {expectedRevision:store.get(id).revision,turnId,constraints:{budgetMinor:1}});
  const before = structuredClone(store.get(id));
  assert.throws(() => store.propose(id, {expectedRevision:before.revision,turnId,selection:{offerId:"BAG-001-B",quantity:1},stage:"offers",needs:["should not persist"]}), /violates constraints/);
  assert.deepEqual(store.get(id), before);
});
test("rejected exclusion does not mutate shortlist, constraints, summary or revision", () => {
  const {store,id,turnId} = setup();
  store.propose(id, {expectedRevision:store.get(id).revision,turnId,shortlist:["BAG-001"]});
  const before = structuredClone(store.get(id));
  assert.throws(() => store.propose(id, {expectedRevision:before.revision,turnId,excludedProductIds:["BAG-001"],constraints:{budgetMinor:100}}), /excluded product/);
  assert.deepEqual(store.get(id), before);
});

test("state-only proposals avoid catalog response expansion while preserving selection validation", () => {
  const store = new SessionStore(undefined, structuredClone(alongProfile));
  const {session} = store.create();
  const state = store.beginTurn(session.id, session.revision);
  const id = state.id, turnId = state.turn!.id;
  let fullScans = 0;
  store.profile.catalog.offers = new Proxy(store.profile.catalog.offers, { get(target, key, receiver) {
    if (key === "map") fullScans++;
    return Reflect.get(target, key, receiver);
  } });
  const first = store.propose(id, { expectedRevision: state.revision, turnId, constraints: { budgetMinor: 100, compatibility: { hostConnection: "usb-c" } } }, { includeOffers: false });
  assert.equal(Object.hasOwn(first, "offers"), false);
  assert.equal(fullScans, 0);
  const before = store.get(id);
  assert.throws(() => store.propose(id, { expectedRevision: before.revision, turnId, selection: { offerId: "MIC-001-A", quantity: 1 } }, { includeOffers: false }), /violates constraints/);
  assert.deepEqual(store.get(id), before);
  const updated = store.propose(id, { expectedRevision: before.revision, turnId, constraints: { budgetMinor: 5000 }, selection: { offerId: "MIC-001-A", quantity: 1 } }, { includeOffers: false });
  assert.equal(updated.session.selection?.offerId, "MIC-001-A");
  assert.equal(updated.session.constraints.compatibility?.hostConnection, "usb-c");
  assert.equal(fullScans, 0, "Selected-offer checks must not trigger unrelated offer expansion");
  const summary = store.summarize(id, updated.session.revision, turnId);
  assert.equal(summary.summary?.quote.eligible, true);
  assert.equal(summary.summary?.quote.total, 2400);
});

test("ordinary proposals retain the complete public offer response", () => {
  const {store,id,turnId} = setup();
  const result = store.propose(id, { expectedRevision: store.get(id).revision, turnId, constraints: { budgetMinor: 5000, compatibility: { hostConnection: "usb-c" } } });
  assert.deepEqual(result.offers.map((quote) => quote.offer.id), store.profile.catalog.offers.map((offer) => offer.id));
  assert.equal(result.offers.find((quote) => quote.offer.id === "MIC-001-A")?.eligible, true);
  assert.equal(result.offers.find((quote) => quote.offer.id === "MIC-005-A")?.eligible, false);
});
