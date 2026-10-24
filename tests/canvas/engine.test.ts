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
function journey(
  category: Category = "audio",
  modality: "voice" | "text" = "voice",
) {
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
        modality,
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
  it.each([
    [60, 1, "1 close match.", "Fewer than five"],
    [80, 3, "2 close matches and 1 related discovery.", "Fewer than five"],
    [95, 4, "2 close matches and 2 related discoveries.", "Fewer than five"],
    [
      150,
      5,
      "2 close matches and 3 related discoveries.",
      "Tell me what speaks",
    ],
  ])(
    "describes the actual bag roles within a USD %i budget",
    (budget, count, roles, explanation) => {
      const j = journey("bags");
      j.say(`Budget under USD ${budget}`);
      const s = j.say("Explore options");
      expect(s.displayOrder).toHaveLength(count as number);
      expect(s.canvas.message).toContain(roles);
      expect(s.canvas.message).toContain(explanation);
      expect(
        s.displayOrder.filter(
          (id) => s.canvas.annotations[id].role === "Close match",
        ),
      ).toHaveLength(Math.min(count as number, 2));
      expect(
        s.displayOrder.filter(
          (id) => s.canvas.annotations[id].role === "Related discovery",
        ),
      ).toHaveLength(Math.max((count as number) - 2, 0));
    },
  );
  it("explains an empty bag shortlist without claiming any matches", () => {
    const j = journey("bags");
    j.say("Budget under USD 50");
    const s = j.say("Explore options");
    expect(s.displayOrder).toEqual([]);
    expect(s.canvas.annotations).toEqual({});
    expect(s.canvas.message).toContain(
      "No options fit your current constraints",
    );
    expect(s.canvas.message).not.toContain("close match");
  });
  it("returns from a focused product to discovery when asked for more", () => {
    const j = journey("bags");
    j.say("Explore options");
    j.say("Focus the second");
    const s = j.say("Show more");
    expect(s.focusedProductId).toBeNull();
    expect(s.view).toBe("shortlist");
    expect(s.displayOrder).toHaveLength(3);
    const offers = j.say("I need the second tomorrow");
    expect(offers.focusedProductId).toBe(offers.displayOrder[1]);
    expect(offers.view).toBe("offers");
  });
  it("checks bedsheet dimensions and depth, preserving unknowns", () => {
    const j = journey("bedsheets");
    j.say("Mattress depth 40 cm");
    const s = j.say("Explore options");
    expect(s.displayOrder).toEqual(["BED-005"]);
    const product = fixtureData.products.find((p) => p.id === "BED-005")!;
    expect(product.variantId).toBe("Queen · 152 × 203 cm · 40 cm pocket");
    expect(product.specs["Mattress depth"]).toBe("40 cm");
    for (const offer of fixtureData.offers.filter(
      (o) => o.productId === product.id,
    ))
      expect(offer.variantId).toBe(product.variantId);
    j.say("Dimensions 180 x 200");
    expect(j.say("Explore options").displayOrder).toEqual([]);
  });
  it("clarifies unsupported measurement units without reinterpreting inches as centimetres", () => {
    const j = journey("bedsheets");
    const initial = structuredClone(j.snapshot.hardConstraints);
    for (const command of [
      "Mattress depth 16 inches",
      "Mattress depth 16in",
      "Dimensions 60 x 80 inches",
      "Size 1520 x 2030 mm",
    ]) {
      const s = j.say(command);
      expect(s.hardConstraints).toEqual(initial);
      expect(s.canvas.message).toContain("centimetres");
      expect(s.canvas.message).toContain("unchanged");
    }
    j.say("Mattress depth 30.5 cm");
    expect(j.say("Explore options").displayOrder).toEqual(["BED-005"]);
  });
  it("clarifies unsupported colours and only removes colour constraints on explicit flexibility", () => {
    const j = journey("bags");
    j.say("Actually navy colour");
    const before = j.say("Explore options");
    const s = j.say("Actually red colour");
    expect(s.preferences).toEqual(before.preferences);
    expect(s.displayOrder).toEqual(before.displayOrder);
    expect(s.canvas.message).toContain("please clarify");
    expect(j.say("Any color is fine").preferences).toContain("Colour flexible");
    expect(j.snapshot.preferences).not.toContain("Navy colour");
  });
});
describe("comparison, evidence and session saves", () => {
  it.each(["voice", "text"] as const)(
    "accepts the same compare/save/restore/evidence/offer journey through %s intents",
    (modality) => {
      const j = journey("bags", modality);
      expect(j.input("Explore options").modality).toBe(modality);
      const initial = j.say("Explore options").displayOrder;
      const compared = j.say("Compare the first two");
      expect(compared.view).toBe("comparison");
      expect(compared.comparisonIds).toEqual(initial.slice(0, 2));
      j.say("Save the second");
      expect(j.snapshot.savedItems[0].id).toBe(initial[1]);
      expect(j.say("Remove the first").displayOrder).not.toContain(initial[0]);
      expect(j.say("Restore shortlist").displayOrder).toContain(initial[0]);
      const evidence = j.say("Reviews for the first");
      expect(evidence.view).toBe("evidence");
      expect(evidence.focusedProductId).toBe(initial[0]);
      expect(evidence.evidenceIds).toContain(`${initial[0]}-reviews`);
      expect(j.say("Offers for the first").view).toBe("offers");
      expect(j.say(`Choose offer ${initial[0]}-cheap`).selectedOfferId).toBe(
        `${initial[0]}-cheap`,
      );
      expect(j.say("Show saved choices").displayOrder).toEqual([initial[1]]);
    },
  );
  it("resolves middle against the current odd numbered shortlist", () => {
    const j = journey("bags");
    const five = j.say("Explore options").displayOrder;
    expect(five).toHaveLength(5);
    expect(j.say("Focus the middle").focusedProductId).toBe(five[2]);
    const three = j.say("Show more").displayOrder;
    expect(three).toHaveLength(3);
    expect(j.say("Focus the middle").focusedProductId).toBe(three[1]);
  });
  it.each([70, 95])(
    "clarifies an even shortlist instead of acting on its focus at USD %i",
    (budget) => {
      const j = journey("bags");
      j.say(`Budget under USD ${budget}`);
      const ids = j.say("Explore options").displayOrder;
      expect(ids.length % 2).toBe(0);
      j.say("Focus the first");
      for (const command of [
        "Focus the middle",
        "Save the middle",
        "Remove the middle",
        "Offers for the middle",
      ]) {
        const s = j.say(command);
        expect(s.canvas.message).toContain("There is no single middle card");
        expect(s.canvas.message).toContain("visible card number or product ID");
        expect(s.focusedProductId).toBe(ids[0]);
        expect(s.displayOrder).toEqual(ids);
        expect(s.savedItems).toEqual([]);
        expect(s.exclusions).toEqual([]);
        expect(s.view).toBe("shortlist");
      }
    },
  );
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
  it("keeps audio delivered totals unknown while required host setup is unpriced", () => {
    for (const offer of fixtureData.offers.filter((o) =>
      o.productId.startsWith("MIC-"),
    )) {
      expect(offer.requiredSetupMinor).toBeNull();
      expect(deliveredTotal(offer)).toBeNull();
      expect(offer.conditions.join(" ")).toContain(
        "complete setup total is unavailable",
      );
    }
    const base = fixtureData.offers.find((o) => o.id === "BAG-001-cheap")!;
    expect(base.requiredSetupMinor).toBe(0);
    expect(deliveredTotal({ ...base, requiredSetupMinor: 1200 })).toBe(9600);
    expect(deliveredTotal({ ...base, requiredSetupMinor: null })).toBeNull();
    expect(deliveredTotal({ ...base, requiredSetupMinor: -1 })).toBeNull();
    expect(
      deliveredTotal({ ...base, requiredSetupMinor: Number.MAX_SAFE_INTEGER }),
    ).toBeNull();
  });
  it("preserves captured written-review counts separately from aggregate-only rating counts", () => {
    for (const [id, count] of [
      ["MIC-022", 22],
      ["MIC-037", 7],
      ["MIC-040", 4],
      ["MIC-044", 2],
    ] as const) {
      const reviews = fixtureData.evidence.find(
        (e) => e.id === `${id}-reviews`,
      )!;
      expect(reviews.ratingCount).toBe(count);
      expect(reviews.writtenReviewCount).toBe(count);
    }
    for (const id of ["MIC-001", "MIC-020"]) {
      const reviews = fixtureData.evidence.find(
        (e) => e.id === `${id}-reviews`,
      )!;
      expect(reviews.ratingCount).not.toBeNull();
      expect(reviews.writtenReviewCount).toBeNull();
    }
  });
  it("accepts exact same-variant offers and blocks incomplete choices through text too", () => {
    const bags = journey("bags");
    bags.say("Explore options");
    bags.say("Offers for the first");
    bags.say("Choose offer BAG-001-fast");
    expect(bags.snapshot.selectedOfferId).toBe("BAG-001-fast");
    for (const command of [
      "Choose offer BAG-001-unknown",
      "Choose offer BAG-002-cheap",
    ]) {
      const s = bags.say(command);
      expect(s.selectedOfferId).toBe("BAG-001-fast");
      expect(s.canvas.message).toContain("cannot be selected");
    }
    const audio = journey("audio");
    audio.say("Explore options");
    audio.say("Choose desktop");
    audio.say("Choose value");
    audio.say("Offers for the first");
    for (const command of [
      "Choose cheaper offer",
      `Choose offer ${audio.snapshot.focusedProductId}-fast`,
    ]) {
      const s = audio.say(command);
      expect(s.selectedOfferId).toBeNull();
      expect(s.canvas.message).toContain("complete delivered setup total");
    }
  });
});
