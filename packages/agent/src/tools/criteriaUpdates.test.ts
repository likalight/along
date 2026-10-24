import assert from "node:assert/strict";
import { test } from "node:test";
import type { InputEvent } from "@coupang/contract";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import { SessionThread } from "../thread/SessionThread.js";
import { executeShoppingTool } from "./shoppingTools.js";

const requirements = (values: Record<string, unknown>) => ({
  needs: [], preferences: [], exclusions: [],
  budgetMinor: null, category: null, minimumCapacityL: null,
  maxDeliveryDays: null, separateShoeCompartment: null,
  compatibility: { hostConnection: null, laptopInches: null, bedWidthInches: null, bedLengthInches: null, mattressDepthInches: null },
  ...values,
});

function setup() {
  const store = new AuthoritativeSessionStore();
  const initial = store.create();
  const thread = new SessionThread(initial);
  const input: InputEvent = {
    sessionId: initial.sessionId, epoch: initial.epoch,
    turnId: "initial", eventId: "initial", baseRevision: initial.revision,
    modality: "text", text: "A bag under fifty dollars, at least thirty litres, with a separate shoe compartment, within two days",
    visibleRevision: initial.revision, visibleProductIds: [],
  };
  const begin = (text: string) => {
    const current = store.get(initial.sessionId)!;
    Object.assign(input, { text, turnId: crypto.randomUUID(), eventId: crypto.randomUUID(), baseRevision: current.revision, visibleRevision: current.revision });
    store.ingestInput(input);
    input.baseRevision = store.get(initial.sessionId)!.revision;
    thread.snapshot = store.get(initial.sessionId)!;
  };
  const update = (values: Record<string, unknown>) => executeShoppingTool({
    name: "remember_requirements", arguments: requirements(values), store, thread, input,
  });
  begin(input.text!);
  const result = update({ budgetMinor: 5000, category: "bags", minimumCapacityL: 30, separateShoeCompartment: true, maxDeliveryDays: 2 });
  assert.equal(result.ok, true, result.reason);
  return { store, input, begin, update };
}

test("shopper corrections update individual criteria while retaining unrelated limits", () => {
  const { store, input, begin, update } = setup();
  for (const [text, values] of [
    ["Actually, delivery within five days is fine", { maxDeliveryDays: 5 }],
    ["A minimum of twenty litres is enough", { minimumCapacityL: 20 }],
    ["I do not need a separate shoe compartment", { separateShoeCompartment: false }],
  ] as const) {
    begin(text);
    const result = update(values);
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.snapshot.hardConstraints.budgetMinor, 5000);
    assert.equal(result.snapshot.hardConstraints.category, "everyday-bags");
  }
  const accepted = store.get(input.sessionId)!.hardConstraints;
  assert.equal(accepted.maxDeliveryDays, 5);
  assert.equal(accepted.minimumCapacityL, 20);
  assert.equal(accepted.separateShoeCompartment, false);
});

test("the agent cannot relax criteria just because a product fails them", () => {
  const { store, input, begin, update } = setup();
  begin("Show me some other bags");
  const revision = store.get(input.sessionId)!.revision;
  for (const values of [{ maxDeliveryDays: 5 }, { minimumCapacityL: 20 }, { separateShoeCompartment: false }]) {
    const result = update(values);
    assert.equal(result.ok, false);
    assert.equal(store.get(input.sessionId)!.revision, revision);
  }
  assert.equal(store.get(input.sessionId)!.hardConstraints.maxDeliveryDays, 2);
  assert.equal(store.get(input.sessionId)!.hardConstraints.minimumCapacityL, 30);
  assert.equal(store.get(input.sessionId)!.hardConstraints.separateShoeCompartment, true);
});
