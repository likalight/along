import assert from "node:assert/strict";
import { test } from "node:test";
import { EVIDENCE, offersForProduct } from "../fixtures/catalog.js";
import { AuthoritativeSessionStore } from "../session/AuthoritativeSessionStore.js";
import { FixtureVoiceAdapter } from "../voice/adapter.js";
import { VoiceOrchestrator } from "./VoiceOrchestrator.js";

test("fixture evidence journey only includes the focused product and its offer's seller evidence", async () => {
  const store = new AuthoritativeSessionStore();
  const orchestrator = new VoiceOrchestrator(store, new FixtureVoiceAdapter());
  let snapshot = orchestrator.createSession();
  let event = 0;
  for (const text of [
    "a work and gym bag",
    "shape, budget USD 150",
    "show evidence",
  ]) {
    const result = await orchestrator.handleInput({
      sessionId: snapshot.sessionId,
      epoch: snapshot.epoch,
      eventId: `evidence-${++event}`,
      turnId: `evidence-${event}`,
      baseRevision: snapshot.revision,
      modality: "text",
      text,
      visibleRevision: snapshot.revision,
      visibleProductIds: snapshot.displayOrder,
    });
    snapshot = result.snapshot;
  }

  assert.equal(snapshot.view, "evidence");
  assert.equal(snapshot.focusedProductId, "BAG-001");
  assert.ok(snapshot.evidenceIds.includes("SRC-BAG-001"));
  assert.ok(snapshot.evidenceIds.includes("SELLER-VALUE"));
  assert.ok(snapshot.evidenceIds.includes("FIXTURE-BAG-001-A"));
  assert.ok(snapshot.evidenceIds.length <= 50);
  assert.equal(new Set(snapshot.evidenceIds).size, snapshot.evidenceIds.length);

  const offer = offersForProduct("BAG-001")[0]!;
  // The expanded catalog shares this seller across many products. Their offer
  // records must not leak into the evidence panel for the focused bag.
  assert.ok(EVIDENCE.filter((item) => item.subjectId === offer.sellerId).length > 50);
  for (const id of snapshot.evidenceIds) {
    const evidence = EVIDENCE.find((item) => item.id === id)!;
    assert.ok(
      (evidence.subjectType === "product" && evidence.subjectId === "BAG-001") ||
        offer.evidenceIds.includes(id),
      `Unrelated evidence ${id} was included`,
    );
  }
});
