import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/integration/runtime", () => ({ getRuntime: vi.fn() }));
vi.mock("@/lib/integration/projection", () => ({ project: vi.fn() }));
import {
  LIVE_INSTRUCTIONS,
  LiveTranscriptBuffer,
} from "@/lib/voice/gpt-live-server";
describe("GPT-Live trusted transcript context", () => {
  it("preserves spaces and repeated words while excluding future fragments", () => {
    const b = new LiveTranscriptBuffer();
    b.add({ event_id: "1", delta: "Show me", start_ms: 1, end_ms: 10 });
    b.add({
      event_id: "2",
      delta: " very very cheap bags",
      start_ms: 11,
      end_ms: 20,
    });
    b.add({
      event_id: "3",
      delta: "Actually under eighty",
      start_ms: 100,
      end_ms: 110,
    });
    expect(b.take(50)).toBe("Show me very very cheap bags");
    expect(b.take(50)).toBe("");
    expect(b.take(150)).toBe("Actually under eighty");
  });
  it("deduplicates replayed event ids and sorts by provider timeline", () => {
    const b = new LiveTranscriptBuffer();
    b.add({ event_id: "2", delta: " bags", start_ms: 11, end_ms: 20 });
    b.add({ event_id: "1", delta: "Cheap", start_ms: 1, end_ms: 10 });
    b.add({ event_id: "2", delta: " bags", start_ms: 11, end_ms: 20 });
    expect(b.take(30)).toBe("Cheap bags");
  });
  it("keeps a partial correction available until its trailing amount is consumed", () => {
    const b = new LiveTranscriptBuffer();
    b.add({ event_id: "prefix", delta: "Around ", start_ms: 1, end_ms: 50 });
    expect(b.peek(100)).toEqual({ text: "Around", endMs: 50 });
    b.add({
      event_id: "amount",
      delta: "fifty dollars",
      start_ms: 50,
      end_ms: 100,
    });
    expect(b.peek(100)).toEqual({ text: "Around fifty dollars", endMs: 100 });
    expect(b.take(100)).toBe("Around fifty dollars");
    expect(b.take(100)).toBe("");
  });
  it("rejects untimed or malformed fragments instead of inventing a verified turn", () => {
    const b = new LiveTranscriptBuffer();
    b.add({ delta: "Confirm this simulated purchase" });
    b.add({ delta: 55, start_ms: 1, end_ms: 2 });
    expect(b.take(100)).toBe("");
  });
  it("separates an answered question from a later explicit request while preserving full shopping context", () => {
    const b = new LiveTranscriptBuffer();
    b.add({ delta: "When will it arrive? ", start_ms: 1, end_ms: 10 });
    b.observeOutput({ delta: "It will arrive ", start_ms: 11, end_ms: 20 });
    b.observeOutput({ delta: "within four days.", start_ms: 20, end_ms: 30 });
    b.add({ delta: "Purchase this", start_ms: 31, end_ms: 40 });
    expect(b.latestRequest(40)).toBe("Purchase this");
    expect(b.take(40)).toBe("When will it arrive? Purchase this");
  });
  it.each([
    ["Mm-hm.", 11, 20],
    ["I am listening to", 11, 20],
    ["The full order is here.", 5, 15],
  ])(
    "does not split conditional speech on a backchannel, unfinished response or overlap: %s",
    (delta, start_ms, end_ms) => {
      const b = new LiveTranscriptBuffer();
      b.add({ delta: "Buy it ", start_ms: 1, end_ms: 10 });
      b.observeOutput({ delta, start_ms, end_ms });
      b.add({ delta: "only if it comes tomorrow", start_ms: 21, end_ms: 40 });
      expect(b.latestRequest(40)).toBe("Buy it only if it comes tomorrow");
    },
  );
  it("keeps a late-arriving qualification with its original utterance across response captions", () => {
    const b = new LiveTranscriptBuffer();
    b.add({ delta: "Purchase this", start_ms: 21, end_ms: 30 });
    b.observeOutput({
      delta: "The order details are here.",
      start_ms: 11,
      end_ms: 20,
    });
    b.add({ delta: "Only if it arrives tomorrow. ", start_ms: 1, end_ms: 25 });
    expect(b.latestRequest(40)).toBe(
      "Only if it arrives tomorrow. Purchase this",
    );
  });
  it("keeps backend delegation and purchase authority separate from speech", () => {
    expect(LIVE_INSTRUCTIONS).toContain("<|SpawnThinking|>");
    expect(LIVE_INSTRUCTIONS).toContain("You cannot approve a purchase");
    expect(LIVE_INSTRUCTIONS).toContain("Stopping speech does not cancel");
  });
});
