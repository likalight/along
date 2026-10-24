/** Real HTTP cross-package rehearsal. No provider requests, audio, or real orders. */
import assert from "node:assert/strict";
const base = process.env.INTEGRATION_URL ?? "http://127.0.0.1:4321";
async function shopper(scenarioId) {
  const r = await fetch(base + "/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId }),
  });
  assert.equal(r.status, 200);
  let state = await r.json();
  const cookie = r.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
  const request = async (path, body, expected = 200) => {
    const r = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: base },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    assert.equal(r.status, expected, JSON.stringify(d.error));
    if (d.snapshot) state = d;
    return d;
  };
  const context = () => ({
    sessionId: state.snapshot.sessionId,
    epoch: state.snapshot.epoch,
    visibleRevision: state.snapshot.revision,
    visibleProductIds: state.snapshot.displayOrder,
  });
  return {
    get state() {
      return state;
    },
    context,
    request,
    turn: (text, expected) =>
      request("/api/turn", { ...context(), modality: "text", text }, expected),
    action: (action, payload = {}, expected) =>
      request("/api/action", { ...context(), action, payload }, expected),
    present: () =>
      request("/api/presentation", {
        sessionId: state.snapshot.sessionId,
        summaryId: state.summary.id,
        turnId: state.summary.responseTurnId,
        textHash: state.summary.textHash,
        event: "displayed",
      }),
  };
}
const bag = await shopper("bag_inspiration");
await bag.turn(
  "I need a backpack for a 14-inch laptop and separate shoes under 150 dollars tomorrow",
);
assert.equal(bag.state.snapshot.hardConstraints.budgetMinor, 15000);
assert.equal(bag.state.snapshot.hardConstraints.compatibility.laptopInches, 14);
assert.equal(
  bag.state.offers.find((q) => q.offer.id === "BAG-001-A").eligible,
  false,
);
assert.equal(
  bag.state.offers.find((q) => q.offer.id === "BAG-001-B").total,
  11900,
);
const stale = bag.context();
await bag.action("prepare_summary");
await bag.present();
await bag.turn("Keep tomorrow but change the budget to 100 dollars");
assert.equal(bag.state.summary, null);
assert.equal(bag.state.snapshot.selectedOfferId, null);
assert.equal(bag.state.snapshot.hardConstraints.deliveryWithinDays, 1);
assert.equal(bag.state.receipt, null);
await bag.request(
  "/api/turn",
  { ...stale, modality: "text", text: "the first one" },
  409,
);
await bag.turn("Change the budget to 150 dollars, still tomorrow");
await bag.action("prepare_summary");
await bag.present();
await bag.turn("Confirm this simulated purchase");
const receipt = bag.state.receipt.id;
assert.equal(bag.state.receipt.quote.total, 11900);
await bag.turn("Confirm this simulated purchase", 409);
assert.equal(bag.state.receipt.id, receipt);
const auth = await fetch(
  base + "/api/session?sessionId=" + bag.state.snapshot.sessionId,
);
assert.equal(auth.status, 403);
const bed = await shopper("warm_bedding");
await bed.turn(
  "I want queen sheets for a 60 by 80 inches bed with a 12 inch mattress under 70 dollars",
);
const eligible = bed.state.offers.filter((q) => q.eligible);
assert(eligible.some((q) => q.product.id === "BED-003"));
assert(!eligible.some((q) => q.product.id === "BED-001"));
await bed.action("select_offer", { offerId: "BED-003-A" });
await bed.action("prepare_summary");
await bed.action("cancel");
assert.equal(bed.state.summary, null);
assert.equal(bed.state.receipt, null);
const audio = await shopper("cafe_dictation");
await audio.turn(
  "I need a directional desktop microphone with USB-C under 160 dollars tomorrow",
);
await audio.turn("best value");
assert(audio.state.offers.some((q) => q.eligible));
assert(
  !audio.state.offers.some(
    (q) => q.eligible && ["MIC-025", "MIC-038"].includes(q.product.id),
  ),
);
console.log(
  "PASS: browser/API contract, canonical bag totals, budget revision, stale-display rejection, one receipt, session isolation, bed dimensions, cancellation, and audio host/deadline eligibility.",
);
