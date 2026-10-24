import { describe, expect, it, vi } from "vitest";
import {
  SessionController,
  canAutoImportDiscovery,
} from "@/lib/session/controller";
import { initialSession } from "@/lib/session/fixtures";
import type { Session, SessionTransport } from "@/lib/session/contract";
import type { SpeechAdapter, SpeechCallbacks } from "@/lib/voice/adapter";

function harness() {
  let snapshot: Session = {
    ...initialSession("same-conversation"),
    hardConstraints: { budgetMax: "15000" },
    history: [{ role: "user", text: "A work and gym bag, under USD 150" }],
    conversationMode: "text",
  };
  let callbacks: SpeechCallbacks | undefined;
  const speech: SpeechAdapter = {
    start: vi.fn(async (value) => {
      callbacks = value;
      value.capture(true);
    }),
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
    get callbacks() {
      return callbacks;
    },
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
      expect.any(Function),
      undefined,
    );
    expect(h.controller.getSnapshot().mode).toBe("voice");
  });
  it("keeps a deliberately paused browser microphone paused after a manual import", async () => {
    const h = harness();
    await h.controller.connect();
    await h.controller.chooseMode("voice");
    h.controller.pauseListening();
    vi.mocked(h.speech.start).mockClear();
    expect(await h.controller.receiveDiscovery("paused-reference")).toBe(true);
    expect(h.speech.start).not.toHaveBeenCalled();
    expect(h.speech.speak).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({
      status: "paused",
      capturing: false,
    });
  });
  it("supersedes pending Live work, imports, then syncs the same call without synthetic narration", async () => {
    const h = harness();
    const sequence: string[] = [];
    Object.defineProperty(h.speech, "fullDuplex", { value: true });
    h.speech.prepareTurn = vi.fn(async () => {
      sequence.push("supersede");
    });
    h.speech.sync = vi.fn(async () => {
      sequence.push("sync");
    });
    const discover = h.transport.discovery!;
    h.transport.discovery = vi.fn(
      async (...args: Parameters<typeof discover>) => {
        sequence.push("import");
        return discover(...args);
      },
    );
    await h.controller.connect();
    await h.controller.chooseMode("voice");
    sequence.length = 0;
    const oldCallbacks = h.callbacks!;
    oldCallbacks.backend?.({ pending: true });
    expect(await h.controller.receiveDiscovery("live-reference")).toBe(true);
    expect(sequence).toEqual(["supersede", "import", "sync"]);
    expect(h.speech.speak).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({
      mode: "voice",
      status: "listening",
      capturing: true,
      livePending: false,
    });
    oldCallbacks.backend?.({
      pending: false,
      snapshot: {
        ...initialSession("same-conversation"),
        revision: 999,
        message: "Old product task",
      },
    });
    expect(
      h.controller.getSnapshot().snapshot?.discoveryReference?.handoffId,
    ).toBe("live-reference");
    expect(h.controller.getSnapshot().snapshot?.revision).toBe(1);
  });
  it.each(["not-started", "paused"])(
    "does not restart Live voice when %s",
    async (condition) => {
      const h = harness();
      Object.defineProperty(h.speech, "fullDuplex", { value: true });
      h.speech.sync = vi.fn(async () => {});
      h.setMode("voice");
      await h.controller.connect("same-conversation");
      if (condition === "paused") {
        await h.controller.chooseMode("voice");
        h.controller.pauseListening();
      }
      vi.mocked(h.speech.start).mockClear();
      expect(await h.controller.receiveDiscovery("quiet-reference")).toBe(true);
      expect(h.speech.sync).toHaveBeenCalledOnce();
      expect(h.speech.start).not.toHaveBeenCalled();
      expect(h.speech.speak).not.toHaveBeenCalled();
      expect(h.controller.getSnapshot().capturing).toBe(false);
    },
  );
  it("respects a pause made while the Live context sync is in flight", async () => {
    const h = harness();
    Object.defineProperty(h.speech, "fullDuplex", { value: true });
    let synced!: () => void;
    h.speech.sync = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          synced = resolve;
        }),
    );
    await h.controller.connect();
    await h.controller.chooseMode("voice");
    vi.mocked(h.speech.start).mockClear();
    const importing = h.controller.receiveDiscovery("pause-during-sync");
    await vi.waitFor(() => expect(h.speech.sync).toHaveBeenCalledOnce());
    h.controller.pauseListening();
    synced();
    expect(await importing).toBe(true);
    expect(h.speech.start).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot()).toMatchObject({
      capturing: false,
      status: "paused",
    });
  });
  it("queues automatic imports during a draft, microphone capture, task, pause or order review", async () => {
    const h = harness();
    await h.controller.connect();
    const idle = h.controller.getSnapshot();
    expect(canAutoImportDiscovery(idle, false)).toBe(true);
    expect(canAutoImportDiscovery(idle, true)).toBe(false);
    expect(canAutoImportDiscovery({ ...idle, capturing: true }, false)).toBe(
      false,
    );
    expect(canAutoImportDiscovery({ ...idle, livePending: true }, false)).toBe(
      false,
    );
    expect(canAutoImportDiscovery({ ...idle, status: "paused" }, false)).toBe(
      false,
    );
    expect(
      canAutoImportDiscovery(
        { ...idle, snapshot: { ...idle.snapshot!, view: "summary" } },
        false,
      ),
    ).toBe(false);
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
