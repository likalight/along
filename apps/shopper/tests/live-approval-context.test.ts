import { describe, expect, it } from "vitest";
import {
  asksForOrderApproval,
  LiveApprovalContext,
} from "@/lib/voice/live-approval-context";

const summary = { id: "summary-1", revision: 4, responseTurnId: "review-turn" };
const output = (delta: string, start_ms = 10, end_ms = 20) => ({
  delta,
  start_ms,
  end_ms,
});

describe("the current spoken order approval question", () => {
  it.each([
    "Would you like me to place this order?",
    "The details are on screen. Would you like to place the order?",
    "Ready to place your order?",
    "Shall I order it?",
    "Should I go ahead and place the order?",
    "Do you want me to buy this for you?",
    "Shall we go ahead with this order?",
    "Do you approve this order?",
  ])("recognizes a natural purchase question: %s", (question) => {
    expect(asksForOrderApproval(question)).toBe(true);
  });

  it.each([
    "Would you like me to explain the returns policy?",
    "Should I change the order?",
    "Can you confirm the delivery address?",
    "Would you like me to cancel this order?",
    "Would you like me to place this order or compare another one?",
    'Did you say "Would you like me to place this order?"?',
    "Would you like me to place this order? Or hear about returns?",
  ])("does not treat another question as approval: %s", (question) => {
    expect(asksForOrderApproval(question)).toBe(false);
  });

  it("consumes one prompt and binds all summary identity fields", () => {
    const context = new LiveApprovalContext();
    context.arm(summary);
    expect(context.consume(summary)).toBe(true);
    expect(context.consume(summary)).toBe(false);
    for (const changed of [
      { ...summary, id: "summary-2" },
      { ...summary, revision: 5 },
      { ...summary, responseTurnId: "new-turn" },
    ]) {
      context.arm(summary);
      expect(context.consume(changed)).toBe(false);
    }
  });

  it("replaces the question context as streamed assistant questions change", () => {
    const context = new LiveApprovalContext();
    context.expect(summary);
    context.observeOutput(output("Would you like me to "), summary);
    context.observeOutput(output("place this order?", 20, 30), summary);
    expect(context.consume(summary)).toBe(true);
    context.arm(summary);
    context.observeOutput(output("Would you like to hear ", 30, 40), summary);
    context.observeOutput(output("the returns policy?", 40, 50), summary);
    expect(context.consume(summary)).toBe(false);
  });

  it("does not invalidate an invitation on partial shopper words or accept late prior questions", () => {
    const context = new LiveApprovalContext();
    context.arm(summary);
    context.observeInput(output("y", 100, 110));
    context.observeOutput(
      output("Would you like to hear about returns?", 40, 90),
      summary,
    );
    context.observeInput(output("es please", 110, 120));
    expect(context.consume(summary)).toBe(true);
  });
});
