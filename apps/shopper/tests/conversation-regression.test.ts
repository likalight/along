import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/session/route";
import { getRuntime } from "@/lib/integration/runtime";

async function conversation() {
  let cookie = "";
  async function request(body: unknown) {
    const response = await POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body),
    }));
    const nextCookie = response.headers.get("set-cookie");
    if (nextCookie) cookie = nextCookie.split(";")[0];
    const data = await response.json();
    expect(response.status, JSON.stringify(data)).toBe(200);
    return data;
  }
  let snapshot = await request({ action: "connect" });
  return async (text: string) => {
    const accepted = await request({ action: "input", input: {
      sessionId: snapshot.sessionId, epoch: snapshot.epoch, turnId: crypto.randomUUID(),
      eventId: crypto.randomUUID(), baseRevision: snapshot.revision, revision: snapshot.revision,
      modality: "text", text, visibleRevision: snapshot.revision, visibleProductIds: snapshot.displayOrder,
    } });
    snapshot = accepted.snapshot;
    return snapshot;
  };
}

describe("integrated shopping conversation", () => {
  it.each(["capacity", "Capacity, please.", "I need room for a laptop and gym clothes"])("accepts the offered capacity answer: %s", async (answer) => {
    const send = await conversation();
    await send("I need a work and gym bag");
    const result = await send(answer);
    expect(result.view, JSON.stringify({ message: result.message, constraints: result.hardConstraints, products: result.displayOrder })).toBe("shortlist");
    expect(result.message).not.toMatch(/what matters more|shape, the colour/i);
    expect(result.preferences.join(" ")).toMatch(/capacity/i);
    const again = await send("capacity");
    expect(again.view).toBe("shortlist");
    expect(again.message).not.toMatch(/what matters more|shape, the colour/i);
    const followup = await send("Okay, show me");
    expect(followup.view).toBe("shortlist");
    expect(followup.preferences.join(" ")).toMatch(/capacity/i);
  });
  it.each(["shape", "colour", "color"])("accepts the other offered preference: %s", async (answer) => {
    const send = await conversation();
    await send("I need a work and gym bag");
    const result = await send(answer);
    expect(result.view).toBe("shortlist");
  });
  it("keeps the budget while answering a practical preference and speaks one shopper-facing response", async () => {
    const send = await conversation();
    await send("I need a work and gym bag under 150 dollars");
    const result = await send("capacity");
    expect(result.view, JSON.stringify({ message: result.message, constraints: result.hardConstraints, products: result.displayOrder })).toBe("shortlist");
    expect(JSON.stringify(result.hardConstraints)).toContain("15000");
    expect(result.displayOrder.length).toBeGreaterThan(0);
    expect(result.preferences.join(" ")).toMatch(/capacity/i);
    for (const productId of result.displayOrder) {
      const eligible = getRuntime().store.quotes(result.sessionId, productId).filter(quote => quote.eligible);
      expect(eligible.length).toBeGreaterThan(0);
      expect(eligible.every(quote => quote.total !== null && quote.total <= 15000 && quote.currency === "USD")).toBe(true);
    }
    expect(result.message).not.toMatch(/hard limits|constraints|carry.forward|contextual ranks|candidates|decisions/i);
  });
});
