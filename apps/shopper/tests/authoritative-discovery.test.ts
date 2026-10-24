import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/session/route";
import { getRuntime } from "@/lib/integration/runtime";

function shopper() {
  const { store, orch } = getRuntime();
  const { sessionId } = orch.createSession();
  return {
    id: sessionId,
    async say(text: string) {
      const s = store.core.get(sessionId);
      const response = await POST(
        new Request("http://localhost/api/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `along-session-${sessionId}=${store.accessToken(sessionId)}`,
          },
          body: JSON.stringify({
            action: "input",
            input: {
              sessionId,
              epoch: s.epoch,
              turnId: crypto.randomUUID(),
              eventId: crypto.randomUUID(),
              baseRevision: s.revision,
              visibleRevision: s.revision,
              visibleProductIds: s.displayOrder,
              modality: "text",
              text,
            },
          }),
        }),
      );
      const result = await response.json();
      expect(response.status, JSON.stringify(result)).toBe(200);
      return result.snapshot;
    },
    state: () => store.core.get(sessionId),
  };
}

describe("authoritative discovery retains shopper constraints", () => {
  it("does not pad the shortlist with bags that fail laptop, shoe or delivery requirements", async () => {
    const user = shopper();
    await user.say(
      "I need a backpack for a 14-inch laptop and separate shoes under 150 dollars tomorrow",
    );
    expect(user.state().shortlist).toEqual(["BAG-001"]);
    for (const id of user.state().shortlist) {
      expect(
        getRuntime()
          .store.quotes(user.id, id)
          .some((q) => q.eligible),
      ).toBe(true);
    }
    await user.say("My budget is under 100 dollars instead");
    expect(user.state().shortlist).toEqual([]);
    expect(user.state().constraints).toMatchObject({
      budgetMinor: 10000,
      deliveryWithinDays: 1,
      compatibility: { laptopInches: 14 },
      requiredSpecifications: { separateShoeCompartment: true },
    });
    expect(user.state().receipt).toBeNull();
  });
  it("does not include shallow fitted sheets after exact mattress measurements are supplied", async () => {
    const user = shopper();
    await user.say(
      "I want queen sheets for a 60 by 80 inches bed with a 12 inch mattress under 70 dollars",
    );
    expect(user.state().shortlist.length).toBeGreaterThan(0);
    expect(user.state().shortlist).not.toContain("BED-001");
    for (const id of user.state().shortlist) {
      expect(
        getRuntime()
          .store.quotes(user.id, id)
          .some((q) => q.eligible),
      ).toBe(true);
    }
  });
  it("does not invent USB-C when the shopper chooses a microphone type", async () => {
    const user = shopper();
    await user.say("I need a microphone for cafe dictation");
    await user.say("choose clip-on");
    expect(
      user.state().constraints.compatibility?.hostConnection,
    ).toBeUndefined();
  });
  it("allows clearly pending discovery for an unspecified connection without treating a known mismatch as pending", async () => {
    const user = shopper();
    await user.say("I want a desktop microphone under 150 dollars");
    await user.say("best value");
    expect(
      user.state().constraints.compatibility?.hostConnection,
    ).toBeUndefined();
    expect(user.state().shortlist.length).toBeGreaterThan(0);
    for (const id of user.state().shortlist) {
      const quotes = getRuntime().store.quotes(user.id, id);
      expect(
        quotes.some((q) =>
          q.conflicts.every((c) => c.code === "HOST_CONNECTION_REQUIRED"),
        ),
      ).toBe(true);
    }
    expect(
      user
        .state()
        .view?.cards.every((c) => c.compromise.includes("device connection")),
    ).toBe(true);
    await user.say("My computer has USB-C");
    for (const id of user.state().shortlist) {
      expect(
        getRuntime()
          .store.quotes(user.id, id)
          .some((q) => q.eligible),
      ).toBe(true);
    }
  });
});
