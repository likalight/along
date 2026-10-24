import { describe, expect, it } from "vitest";
import {
  applyDemo,
  createDemo,
  type DemoInput,
} from "../../lib/canvas/demo-engine";
import {
  acceptEvent,
  deliveredTotal,
  type Category,
  type Snapshot,
} from "../../lib/canvas/contracts";
import { fixtureData } from "../../lib/canvas/fixtures";
function journey(category: Category = "audio") {
  let s = createDemo(category);
  let n = 0;
  return {
    get snapshot() {
      return s;
    },
    input(text: string): DemoInput {
      return {
        text,
        sessionId: s.sessionId,
        epoch: s.epoch,
        eventId: `event-${++n}`,
        turnId: `turn-${n}`,
        baseRevision: s.revision,
        visibleRevision: s.revision,
        visibleProductIds: s.displayOrder,
        modality: "voice",
      };
    },
    say(text: string) {
      const result = applyDemo(this.input(text));
      expect(result.status).toBe(200);
      s = result.event!.snapshot;
      return s;
    },
  };
}
describe("accepted canvas contract", () => {
  it("ignores stale, wrong-session, wrong-epoch and inconsistent events", () => {
    const s = createDemo();
    const next = { ...s, revision: 1, displayOrder: ["MIC-001"] };
    const event = {
      sessionId: s.sessionId,
      epoch: 1,
      eventId: "a",
      turnId: "t",
      revision: 1,
      type: "session.updated" as const,
      snapshot: next,
    };
    expect(acceptEvent(s, event)).toBe(next);
    expect(acceptEvent(s, event, "superseded-turn")).toBe(s);
    expect(acceptEvent(next, event)).toBe(next);
    expect(acceptEvent(s, { ...event, sessionId: "other" })).toBe(s);
    expect(acceptEvent(s, { ...event, epoch: 2 })).toBe(s);
    expect(acceptEvent(s, { ...event, revision: 3 })).toBe(s);
    expect(
      acceptEvent(s, {
        ...event,
        snapshot: { ...next, displayOrder: ["MIC-001", "MIC-001"] },
      }),
    ).toBe(s);
  });
  it("deduplicates identical input and rejects old visible references", () => {
    const j = journey();
    const input = j.input("Explore options");
    const first = applyDemo(input);
    expect(applyDemo(input).event).toEqual(first.event);
    expect(applyDemo({ ...input, text: "Choose headset" }).status).toBe(409);
    expect(applyDemo({ ...input, eventId: "new" }).status).toBe(409);
    expect(
      applyDemo({
        ...input,
        eventId: "new",
        baseRevision: 1,
        visibleRevision: 1,
        visibleProductIds: ["bogus"],
      }).status,
    ).toBe(409);
  });
});
describe("guided narrowing", () => {
  it("separates audio understanding, solution, priority and shortlist", () => {
    const j = journey();
    expect(j.snapshot.view).toBe("understanding");
    expect(j.snapshot.displayOrder).toEqual([]);
    expect(j.say("Explore options").view).toBe("solution_types");
    expect(j.say("Choose headset").view).toBe("buying_priorities");
    const s = j.say("Choose best value");
    expect(s.view).toBe("shortlist");
    expect(s.displayOrder).toHaveLength(3);
    expect(s.displayOrder[0]).toBe("MIC-003");
    const original = [...s.displayOrder];
    expect(j.say("Focus the third").displayOrder).toEqual(original);
    expect(j.snapshot.focusedProductId).toBe(original[2]);
    expect(j.snapshot.canvas.annotations[original[0]].rank).toBe(1);
  });
  it("preserves a hard budget even for quality-first and explains fewer matches", () => {
    const j = journey();
    j.say("Budget under $100");
    j.say("Explore options");
    j.say("Choose headset");
    const s = j.say("Choose best quality regardless of cost");
    expect(s.hardConstraints.budgetMinor).toBe("10000");
    expect(s.displayOrder).toHaveLength(2);
    expect(s.canvas.message).toContain("Fewer than three");
    expect(s.displayOrder).not.toContain("MIC-009");
  });
  it("excludes unavailable clip-on kits instead of fabricating a third option", () => {
    const j = journey();
    j.say("Explore options");
    j.say("Choose clip-on");
    const s = j.say("Choose cost-effective");
    expect(s.displayOrder).toEqual(["MIC-037", "MIC-040"]);
    expect(s.canvas.message).toContain("Fewer than three");
  });
  it("preserves reference, budget and preferences through bag refinement", () => {
    const j = journey("bags");
    const original = j.snapshot;
    const collection = j.say("Explore options");
    expect(collection.displayOrder).toHaveLength(5);
    expect(
      collection.displayOrder.map(
        (id) => collection.canvas.annotations[id].role,
      ),
    ).toEqual([
      "Close match",
      "Close match",
      "Related discovery",
      "Related discovery",
      "Related discovery",
    ]);
    expect(
      Object.values(collection.canvas.annotations).every((a) => !a.rank),
    ).toBe(true);
    const closer = j.say("I prefer the softer shape");
    expect(closer.displayOrder).toHaveLength(3);
    expect(closer.canvas.reference).toEqual(original.canvas.reference);
    expect(closer.attachmentIds).toEqual(original.attachmentIds);
    expect(closer.hardConstraints).toEqual(original.hardConstraints);
    expect(closer.preferences).toContain("Colour flexible");
    expect(j.say("Actually navy colour").preferences).toContain("Navy colour");
    j.say("Explore options");
    expect(
      j.snapshot.displayOrder.every((id) =>
        fixtureData.products
          .find((p) => p.id === id)!
          .variantId.startsWith("Navy"),
      ),
    ).toBe(true);
  });
  it("checks bedsheet dimensions and depth, preserving unknowns", () => {
    const j = journey("bedsheets");
    j.say("Mattress depth 40 cm");
    const s = j.say("Explore options");
    expect(s.displayOrder).toEqual(["BED-005"]);
    j.say("Dimensions 180 x 200");
    expect(j.say("Explore options").displayOrder).toEqual([]);
  });
});
describe("comparison, evidence and session saves", () => {
  it("holds comparison order, removes by visible identity and restores the same keyed product", () => {
    const j = journey("bags");
    j.say("Explore options");
    j.say("Show more");
    const ids = [...j.snapshot.displayOrder];
    expect(j.say("Compare the first two").displayOrder).toEqual(
      ids.slice(0, 2),
    );
    j.say("Save the second");
    expect(j.snapshot.savedItems[0].id).toBe(ids[1]);
    const removed = j.say("Remove the first");
    expect(removed.displayOrder).not.toContain(ids[0]);
    expect(j.say("Restore shortlist").displayOrder).toContain(ids[0]);
    expect(j.say("Show saved choices").displayOrder).toEqual([ids[1]]);
  });
  it("plays evidence for the focused product, not the first product when asked for first video", () => {
    const j = journey();
    j.say("Explore options");
    j.say("Choose desktop");
    j.say("Choose value");
    const third = j.snapshot.displayOrder[2];
    j.say("Reviews for the third");
    const s = j.say("Play the first video");
    expect(s.focusedProductId).toBe(third);
    expect(s.evidenceIds).toContain(`${third}-video`);
  });
  it("separates seller evidence and unknown totals from product review metrics", () => {
    const j = journey("bags");
    j.say("Explore options");
    j.say("Offers for the first");
    j.say("I need it tomorrow");
    expect(j.snapshot.view).toBe("offers");
    expect(j.snapshot.hardConstraints.deadlineDays).toBe("1");
    const same = fixtureData.offers.filter(
      (o) => o.productId === j.snapshot.focusedProductId,
    );
    expect(deliveredTotal(same[0])).toBe(8400);
    expect(deliveredTotal(same[1])).toBe(9900);
    expect(deliveredTotal(same[2])).toBeNull();
    expect(same[0].deliveryWindow.latestOffsetDays).toBeGreaterThan(1);
    expect(same[1].deliveryWindow.latestOffsetDays).toBe(1);
    for (const o of same)
      expect(
        fixtureData.evidence.find((e) => e.id === o.evidenceIds[0])!
          .subjectType,
      ).toBe("seller");
    expect(
      fixtureData.evidence.find((e) => e.id === "MIC-047-reviews")!.rating,
    ).toBeNull();
    expect(
      fixtureData.evidence.find((e) => e.id === "MIC-047-reviews")!
        .writtenReviewCount,
    ).toBe(43);
    expect(fixtureData.products).toHaveLength(24);
  });
});
