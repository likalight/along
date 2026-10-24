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
    b.add({ event_id: "amount", delta: "fifty dollars", start_ms: 50, end_ms: 100 });
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
  it("keeps backend delegation and purchase authority separate from speech", () => {
    expect(LIVE_INSTRUCTIONS).toContain("<|SpawnThinking|>");
    expect(LIVE_INSTRUCTIONS).toContain("You cannot approve a purchase");
    expect(LIVE_INSTRUCTIONS).toContain("Stopping speech does not cancel");
  });
});
