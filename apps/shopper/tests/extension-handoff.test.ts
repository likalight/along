import { describe, expect, it, vi } from "vitest";
import { SessionController } from "@/lib/session/controller";
import { initialSession } from "@/lib/session/fixtures";
import type { Session, SessionTransport } from "@/lib/session/contract";
import type { SpeechAdapter } from "@/lib/voice/adapter";

function harness() {
  let snapshot: Session = {
    ...initialSession("same-conversation"),
    hardConstraints: { budgetMax: "15000" },
    history: [{ role: "user", text: "A work and gym bag, under USD 150" }],
    conversationMode: "text",
  };
  const speech: SpeechAdapter = {
    start: vi.fn(async () => {}),
    stop: vi.fn(),
    speak: vi.fn(),
    cancel: vi.fn(),
    dispose: vi.fn(),
  };
  const transport: SessionTransport = {
    connect: vi.fn(async () => snapshot),
    cancel: vi.fn(async () => snapshot),
    mode: vi.fn(async () => snapshot),
    lifecycle: vi.fn(async () => snapshot),
    send: vi.fn(),
    discovery: vi.fn(async (_identity, handoffId) => {
      snapshot = {
        ...snapshot,
        revision: snapshot.revision + 1,
        message: "Your browser discovery is here. The fit is unverified.",
        discoveryReference: {
          handoffId,
          source: {
            url: "https://www.amazon.com/example",
            title: "An inspiration",
          },
          mode: "demo",
          candidate: {
            id: "demo-bag",
            title: "A similar bag",
            url: "https://www.coupang.com/np/search?q=bag",
            price: null,
            match: "similar",
            reasons: ["Similar shape"],
            unknowns: ["Laptop fit"],
            linkKind: "search",
          },
        },
      };
      return { snapshot, turnId: "discovery-turn" };
    }),
  };
  const controller = new SessionController(transport, speech);
  return {
    controller,
    transport,
    speech,
    setMode(mode: "text" | "voice") {
      snapshot = { ...snapshot, conversationMode: mode };
    },
  };
}

describe("extension joins the existing shopper conversation", () => {
  it("resumes the requested session and retains requirements/history through a structured handoff", async () => {
    const h = harness();
    await h.controller.connect("same-conversation");
    expect(h.transport.connect).toHaveBeenCalledWith("same-conversation");
    expect(await h.controller.receiveDiscovery("handoff-1")).toBe(true);
    const state = h.controller.getSnapshot();
    expect(state.snapshot?.sessionId).toBe("same-conversation");
    expect(state.snapshot?.hardConstraints.budgetMax).toBe("15000");
    expect(state.snapshot?.history[0].text).toContain("work and gym");
    expect(state.snapshot?.discoveryReference?.handoffId).toBe("handoff-1");
    expect(state.mode).toBe("text");
    expect(h.speech.speak).not.toHaveBeenCalled();
    expect(h.transport.send).not.toHaveBeenCalled();
  });
  it("does not activate audio just because a voice-mode conversation resumed", async () => {
    const h = harness();
    h.setMode("voice");
    await h.controller.connect("same-conversation");
    await h.controller.receiveDiscovery("handoff-1");
    expect(h.speech.start).not.toHaveBeenCalled();
    expect(h.speech.speak).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot().mode).toBe("voice");
  });
  it("narrates the arrival through the existing activated speech adapter", async () => {
    const h = harness();
    await h.controller.connect();
    await h.controller.chooseMode("voice");
    await h.controller.receiveDiscovery("handoff-1");
    expect(h.speech.speak).toHaveBeenCalledWith(
      expect.stringContaining("browser discovery"),
      expect.objectContaining({
        sessionId: "same-conversation",
        turnId: "discovery-turn",
      }),
      expect.any(Function),
    );
    expect(h.controller.getSnapshot().mode).toBe("voice");
  });
  it("rejects a response for another conversation without replacing current state", async () => {
    const h = harness();
    await h.controller.connect();
    vi.mocked(h.transport.discovery!).mockResolvedValue({
      snapshot: initialSession("another-person"),
      turnId: "wrong",
    });
    expect(await h.controller.receiveDiscovery("handoff-1")).toBe(false);
    expect(h.controller.getSnapshot().snapshot?.sessionId).toBe(
      "same-conversation",
    );
    expect(h.controller.getSnapshot().status).toBe("error");
  });
});
