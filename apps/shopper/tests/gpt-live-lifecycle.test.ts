import { EventEmitter } from "node:events";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_SOLUTION_CHOICES } from "@/lib/canvas/solution-choices";
import { ORDER_APPROVAL_QUESTION } from "@/lib/voice/live-approval-context";
import type { DiscoveryReference } from "@coupang/contract";
import type { CheckoutIntentDecision } from "@/lib/checkout/intent";
const state = vi.hoisted(() => ({
  turn: "",
  revision: 0,
  view: "understanding",
  displayOrder: [] as string[],
  discoveryReference: undefined as DiscoveryReference | undefined,
  summary: null as {
    id: string;
    revision: number;
    responseTurnId: string;
  } | null,
  summaryDisplayed: true,
  receipt: null as {
    id: string;
    acceptedOrder: { deliveryWindow: string };
  } | null,
  message: "Verified result",
  complete: vi.fn(),
  post: vi.fn(),
  barge: vi.fn(),
  intent: vi.fn(),
}));
vi.mock("@/lib/checkout/resolve-intent", () => ({
  resolveCheckoutIntent: state.intent,
  withCheckoutIntent: (request: Request) => request,
}));
vi.mock("@/lib/integration/runtime", () => ({
  getRuntime: () => ({
    store: {
      core: {
        get: () => ({
          revision: state.revision,
          turn: { id: state.turn },
          summary: state.summary
            ? { ...state.summary, displayed: state.summaryDisplayed }
            : null,
          receipt: state.receipt,
        }),
        completeLiveDemo: state.complete,
        enableLiveDemoCheckout: vi.fn(),
      },
    },
    orch: { bargeIn: state.barge },
  }),
}));
vi.mock("@/lib/integration/projection", () => ({
  project: (sessionId: string) => ({
    sessionId,
    epoch: 1,
    revision: state.revision,
    view: state.view,
    displayOrder: state.displayOrder,
    discoveryReference: state.discoveryReference,
    catalog: { products: [{ id: "mic-1", title: "USB microphone" }] },
    cards: [],
    message: state.message,
    summary: state.summary,
    receipt: state.receipt,
  }),
}));
vi.mock("@/lib/integration/activity", () => ({ readActivity: () => null }));
vi.mock("@/app/api/session/route", () => ({ POST: state.post }));
vi.mock("ws", () => ({
  default: class extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    sent: string[] = [];
    constructor() {
      super();
      queueMicrotask(() => this.emit("open"));
      sockets.push(this);
    }
    send(raw: string) {
      this.sent.push(raw);
    }
    close() {
      this.readyState = 3;
      this.emit("close");
    }
  },
}));
const sockets: Array<EventEmitter & { sent: string[]; close(): void }> = [];
import {
  connectGptLive,
  controlGptLive,
  gptLiveState,
  LIVE_SHOPPING_GUARDRAILS,
} from "@/lib/voice/gpt-live-server";
async function connect(id: string) {
  const result = await connectGptLive(
    new Request("http://localhost/api/voice/live/connect", {
      headers: { cookie: "secret" },
    }),
    { sessionId: id, sdp: "v=0\r\n" },
  );
  return { ...result, socket: sockets.at(-1)! };
}
function delegate(
  socket: EventEmitter,
  text: string,
  id: string,
  offset: number,
) {
  socket.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        type: "session.input_transcript.delta",
        event_id: `text-${id}`,
        delta: text,
        start_ms: offset - 10,
        end_ms: offset,
      }),
    ),
  );
  socket.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        type: "session.delegation.created",
        offset_ms: offset,
        delegation: { target: "client", id },
      }),
    ),
  );
}
function transcript(
  socket: EventEmitter,
  speaker: "input" | "output",
  delta: string,
  start: number,
  end: number,
) {
  socket.emit(
    "message",
    Buffer.from(
      JSON.stringify({
        type: `session.${speaker}_transcript.delta`,
        event_id: crypto.randomUUID(),
        delta,
        start_ms: start,
        end_ms: end,
      }),
    ),
  );
}
function reviewedOrder() {
  state.view = "summary";
  state.turn = "summary-turn";
  state.summary = { id: "summary-1", revision: 2, responseTurnId: state.turn };
  state.complete.mockImplementation(() => {
    state.receipt = {
      id: "receipt-1",
      acceptedOrder: { deliveryWindow: "Within 2 days" },
    };
    state.view = "receipt";
    state.message =
      "Your order is confirmed. Expected delivery: within 2 days.";
    state.revision++;
    return { receipt: state.receipt };
  });
}
function nextIntent(
  intent: CheckoutIntentDecision["intent"],
  authorization: CheckoutIntentDecision["authorization"] = "explicit",
) {
  state.intent.mockImplementationOnce(async () => ({
    intent,
    authorization: intent === "approve_order" ? authorization : "none",
    summaryId: intent === "approve_order" ? state.summary?.id : null,
  }));
}
describe("GPT-Live task ownership", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    state.turn = "";
    state.revision = 0;
    state.view = "understanding";
    state.displayOrder = [];
    state.discoveryReference = undefined;
    state.summary = null;
    state.summaryDisplayed = true;
    state.receipt = null;
    state.message = "Verified result";
    state.complete.mockReset();
    state.post.mockReset();
    state.barge.mockReset();
    state.intent.mockReset().mockResolvedValue({
      intent: "continue_shopping",
      authorization: "none",
      summaryId: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          session: { id: crypto.randomUUID() },
          transport: { sdp: "answer" },
        }),
      ),
    );
  });
  afterEach(() => {
    for (const s of sockets) s.close();
    sockets.length = 0;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  const reference = (): DiscoveryReference => ({
    handoffId: "live-browser-handoff",
    mode: "live",
    source: {
      title: "A bag in a video",
      url: "https://www.youtube.com/watch?v=example",
    },
    candidate: {
      id: "search-bag",
      title: "A similar bag",
      url: "https://www.coupang.com/np/search?q=bag",
      linkKind: "search",
      price: null,
      match: "similar",
      reasons: ["Similar shape"],
      unknowns: ["Laptop fit"],
    },
  });
  it("syncs a selected browsing reference into the existing sideband and clears it on return", async () => {
    const c = await connect("discovery-context");
    state.view = "shortlist";
    state.displayOrder = ["mic-1"];
    state.discoveryReference = reference();
    state.revision++;
    await controlGptLive("discovery-context", c.callId, "sync");
    const contexts = () =>
      c.socket.sent
        .map((raw) => JSON.parse(raw))
        .filter(
          (event) =>
            event.type === "session.thinking.append" &&
            event.content.startsWith("{"),
        )
        .map((event) => JSON.parse(event.content));
    expect(
      contexts().find((context) => context.discovery)?.discovery,
    ).toMatchObject({
      handoffId: "live-browser-handoff",
      title: "A similar bag",
      priceSnapshot: null,
      linkKind: "search",
    });
    expect(contexts().find((context) => context.purchase)).toMatchObject({
      purchase: { status: "external_reference" },
      carouselProductCount: 0,
      products: [],
      focusedProduct: null,
    });
    const count = c.socket.sent.length;
    gptLiveState("discovery-context", c.callId);
    expect(c.socket.sent).toHaveLength(count);
    state.discoveryReference = undefined;
    state.revision++;
    await controlGptLive("discovery-context", c.callId, "sync");
    expect(contexts()).toContainEqual({
      discovery: null,
      discoveryAssessment: null,
    });
  });
  it("includes an already imported reference when voice is first connected", async () => {
    state.discoveryReference = reference();
    await connect("discovery-on-start");
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    const inputs = body.session.input[0].content.map(
      (item: { text: string }) => item.text,
    );
    expect(
      inputs.some((text: string) =>
        text.includes('"handoffId":"live-browser-handoff"'),
      ),
    ).toBe(true);
  });
  it("does not confirm a stale catalog review while a browsing reference is active", async () => {
    reviewedOrder();
    state.discoveryReference = reference();
    nextIntent("approve_order");
    state.post.mockResolvedValue(
      Response.json({
        snapshot: { message: "Open the Coupang link to check this reference." },
      }),
    );
    const c = await connect("discovery-no-catalog-checkout");
    delegate(c.socket, "Please buy it", "external-purchase", 100);
    await vi.advanceTimersByTimeAsync(351);
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.intent).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenCalledOnce();
    expect(state.receipt).toBeNull();
  });
  it("stop speaking leaves backend work running", async () => {
    state.post.mockImplementation(async (req: Request) => {
      const b = await req.json();
      state.turn = b.input.turnId;
      return new Promise(() => {});
    });
    const c = await connect("stop");
    delegate(c.socket, "Find bags", "one", 100);
    await vi.advanceTimersByTimeAsync(351);
    await controlGptLive("stop", c.callId, "stop-speaking");
    expect(gptLiveState("stop", c.callId).pending).toBe(true);
    expect(state.barge).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenCalledTimes(1);
    const control = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .find((event) => event.type === "session.instructions.append");
    expect(control.content).toContain(
      "If the correction has already finished, answer it now",
    );
    expect(control.content).toContain("not an ongoing mute instruction");
  });
  it("dispatches an available correction after brief transport buffering", async () => {
    state.post.mockImplementation(async (req: Request) => {
      state.turn = (await req.json()).input.turnId;
      return Response.json({
        snapshot: { message: "Budget updated to fifty dollars" },
      });
    });
    const c = await connect("prompt-correction");
    delegate(c.socket, "Around fifty dollars", "budget", 100);
    await vi.advanceTimersByTimeAsync(49);
    expect(state.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(state.post).toHaveBeenCalledTimes(1);
    const contexts = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter(
        (event) =>
          event.type === "session.thinking.append" &&
          event.content.startsWith("{"),
      );
    expect(JSON.parse(contexts.at(-1).content).shoppingTaskPending).toBe(false);
    expect(c.socket.sent.join(" ")).toContain(
      "Budget updated to fifty dollars",
    );
  });
  it("waits for late timed transcript fragments without demanding a repeated request", async () => {
    state.post.mockImplementation(async (req: Request) => {
      const body = await req.json();
      state.turn = body.input.turnId;
      expect(body.input.text).toBe("Around fifty dollars");
      return Response.json({ snapshot: { message: "Budget updated" } });
    });
    const c = await connect("late-transcript");
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.delegation.created",
          offset_ms: 100,
          delegation: { target: "client", id: "late-budget" },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(100);
    expect(state.post).not.toHaveBeenCalled();
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.input_transcript.delta",
          event_id: "late-text",
          delta: "Around fifty dollars",
          start_ms: 50,
          end_ms: 100,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(50);
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(c.socket.sent.join(" ")).not.toContain("Could you say it again");
  });
  it("coalesces a budget correction whose amount trails an already received prefix", async () => {
    state.post.mockImplementation(async (req: Request) => {
      const body = await req.json();
      state.turn = body.input.turnId;
      expect(body.input.text).toBe("Around fifty dollars");
      return Response.json({ snapshot: { message: "Budget updated" } });
    });
    const c = await connect("split-budget");
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.input_transcript.delta",
          event_id: "budget-prefix",
          delta: "Around ",
          start_ms: 10,
          end_ms: 50,
        }),
      ),
    );
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.delegation.created",
          offset_ms: 100,
          delegation: { target: "client", id: "split-correction" },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(75);
    expect(state.post).not.toHaveBeenCalled();
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.input_transcript.delta",
          event_id: "budget-amount",
          delta: "fifty dollars",
          start_ms: 50,
          end_ms: 100,
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(25);
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(c.socket.sent.join(" ")).not.toContain("Could you say it again");
  });
  it("does not wait for nonexistent transcript coverage across a silence gap", async () => {
    state.post.mockImplementation(async (req: Request) => {
      const body = await req.json();
      state.turn = body.input.turnId;
      expect(body.input.text).toBe("Around fifty dollars");
      return Response.json({ snapshot: { message: "Budget updated" } });
    });
    const c = await connect("speech-before-delegation");
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.input_transcript.delta",
          event_id: "complete-budget",
          delta: "Around fifty dollars",
          start_ms: 10,
          end_ms: 100,
        }),
      ),
    );
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.delegation.created",
          offset_ms: 900,
          delegation: { target: "client", id: "after-silence" },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(200);
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(gptLiveState("speech-before-delegation", c.callId).pending).toBe(
      false,
    );
  });
  it("caps transport settling while text continues arriving before a later delegation offset", async () => {
    state.post.mockImplementation(async (req: Request) => {
      const body = await req.json();
      state.turn = body.input.turnId;
      expect(body.input.text).toBe("Find a small bag for work");
      return Response.json({ snapshot: { message: "Options found" } });
    });
    const c = await connect("bounded-settling");
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.input_transcript.delta",
          event_id: "first-part",
          delta: "Find",
          start_ms: 1,
          end_ms: 10,
        }),
      ),
    );
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.delegation.created",
          offset_ms: 900,
          delegation: { target: "client", id: "bounded" },
        }),
      ),
    );
    for (const [index, delta] of [" a small", " bag", " for work"].entries()) {
      await vi.advanceTimersByTimeAsync(90);
      c.socket.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "session.input_transcript.delta",
            event_id: `part-${index}`,
            delta,
            start_ms: 20 + index * 10,
            end_ms: 30 + index * 10,
          }),
        ),
      );
    }
    expect(state.post).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(80);
    expect(state.post).toHaveBeenCalledTimes(1);
  });
  it("clarifies an unbound assent once without a model turn or losing the displayed order", async () => {
    reviewedOrder();
    nextIntent("clarify");
    nextIntent("approve_order", "assent");
    const c = await connect("rejected-preflight");
    delegate(c.socket, "yes", "ambiguous-confirm", 100);
    await vi.advanceTimersByTimeAsync(50);
    const messages = c.socket.sent.map((raw) => JSON.parse(raw));
    expect(
      messages.filter((event) => event.type === "session.commentary.append"),
    ).toEqual([expect.objectContaining({ content: ORDER_APPROVAL_QUESTION })]);
    const context = messages
      .filter(
        (event) =>
          event.type === "session.thinking.append" &&
          event.content.startsWith("{"),
      )
      .at(-1);
    expect(JSON.parse(context.content).shoppingTaskPending).toBe(false);
    expect(gptLiveState("rejected-preflight", c.callId)).toMatchObject({
      pending: false,
      snapshot: { view: "summary" },
    });
    expect(state.turn).toBe("summary-turn");
    expect(state.post).not.toHaveBeenCalled();
    expect(state.complete).not.toHaveBeenCalled();
    expect(messages.some((event) => event.type === "session.close")).toBe(
      false,
    );
    delegate(c.socket, "yes please", "answer-clarification", 200);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.complete).toHaveBeenCalledWith(
      "rejected-preflight",
      expect.objectContaining({
        transcript: "yes please",
        affirmationSummaryId: "summary-1",
      }),
      expect.objectContaining({
        intent: "approve_order",
        requiresApprovalQuestion: true,
      }),
    );
    expect(state.post).not.toHaveBeenCalled();
  });
  it("binds assent to the server's completed order-review invitation", async () => {
    nextIntent("approve_order", "assent");
    state.post.mockImplementation(async (request: Request) => {
      state.turn = (await request.json()).input.turnId;
      state.view = "summary";
      state.summary = {
        id: "new-summary",
        revision: 3,
        responseTurnId: state.turn,
      };
      state.message = ORDER_APPROVAL_QUESTION;
      return Response.json({ snapshot: { message: state.message } });
    });
    const c = await connect("review-invitation");
    delegate(c.socket, "Proceed with this microphone", "review", 100);
    await vi.advanceTimersByTimeAsync(50);
    state.complete.mockImplementation(() => {
      state.receipt = {
        id: "receipt-new",
        acceptedOrder: { deliveryWindow: "Within 2 days" },
      };
      state.view = "receipt";
      return { receipt: state.receipt };
    });
    delegate(c.socket, "sounds good", "approve-review", 200);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(state.complete).toHaveBeenCalledWith(
      "review-invitation",
      expect.objectContaining({
        transcript: "sounds good",
        summaryId: "new-summary",
        affirmationSummaryId: "new-summary",
      }),
      expect.objectContaining({
        intent: "approve_order",
        requiresApprovalQuestion: true,
      }),
    );
  });
  it("accepts an early approval without cancelling the displayed review's still-pending owner", async () => {
    nextIntent("approve_order", "assent");
    let finish!: (response: Response) => void;
    state.post.mockImplementation(async (request: Request) => {
      state.turn = (await request.json()).input.turnId;
      state.view = "summary";
      state.summary = {
        id: "early-summary",
        revision: 3,
        responseTurnId: state.turn,
      };
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    state.barge.mockImplementation(() => {
      state.summary = null;
      state.view = "shortlist";
    });
    state.complete.mockImplementation(() => {
      state.receipt = {
        id: "receipt-early",
        acceptedOrder: { deliveryWindow: "Within 2 days" },
      };
      state.view = "receipt";
      state.message = "Your order is confirmed.";
      return { receipt: state.receipt };
    });
    const c = await connect("early-approval");
    delegate(c.socket, "Review this microphone", "prepare-review", 100);
    await vi.advanceTimersByTimeAsync(50);
    expect(gptLiveState("early-approval", c.callId).pending).toBe(true);
    transcript(c.socket, "output", ORDER_APPROVAL_QUESTION, 110, 150);
    delegate(c.socket, "yes please", "early-yes", 200);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.barge).not.toHaveBeenCalled();
    expect(state.complete).toHaveBeenCalledWith(
      "early-approval",
      expect.objectContaining({
        summaryId: "early-summary",
        summaryRevision: 3,
        responseTurnId: state.turn,
        affirmationSummaryId: "early-summary",
        transcript: "yes please",
      }),
      expect.objectContaining({
        intent: "approve_order",
        requiresApprovalQuestion: true,
      }),
    );
    finish(Response.json({ snapshot: { message: "OLD REVIEW RESPONSE" } }));
    await vi.advanceTimersByTimeAsync(1);
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(state.view).toBe("receipt");
    expect(c.socket.sent.join(" ")).not.toContain("OLD REVIEW RESPONSE");
    expect(gptLiveState("early-approval", c.callId).pending).toBe(false);
  });
  it("does not preserve an unpresented pending summary as an approved review", async () => {
    state.summaryDisplayed = false;
    state.post
      .mockImplementationOnce(async (request: Request) => {
        state.turn = (await request.json()).input.turnId;
        state.view = "summary";
        state.summary = {
          id: "unshown-summary",
          revision: 3,
          responseTurnId: state.turn,
        };
        return new Promise<Response>(() => {});
      })
      .mockResolvedValueOnce(
        Response.json({ error: "Review the order first." }, { status: 409 }),
      );
    state.barge.mockImplementation(() => {
      state.summary = null;
      state.view = "shortlist";
    });
    const c = await connect("unpresented-pending-review");
    delegate(c.socket, "Review this microphone", "prepare-review", 100);
    await vi.advanceTimersByTimeAsync(50);
    delegate(c.socket, "please buy it", "too-early", 200);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.barge).toHaveBeenCalledTimes(1);
    expect(state.complete).not.toHaveBeenCalled();
  });
  it("does not mistake yes to an unrelated assistant question for ordering", async () => {
    reviewedOrder();
    nextIntent("clarify");
    const c = await connect("returns-question");
    transcript(c.socket, "output", ORDER_APPROVAL_QUESTION, 1, 20);
    transcript(
      c.socket,
      "output",
      " Would you like me to explain returns?",
      20,
      40,
    );
    delegate(c.socket, "yes please", "returns-answer", 100);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
    expect(state.view).toBe("summary");
    expect(
      c.socket.sent
        .map((raw) => JSON.parse(raw))
        .filter((event) => event.type === "session.commentary.append"),
    ).toEqual([expect.objectContaining({ content: ORDER_APPROVAL_QUESTION })]);
  });
  it("does not discard an intervening shopper question when a later yes is delegated", async () => {
    reviewedOrder();
    nextIntent("question");
    state.post.mockResolvedValue(
      Response.json(
        { error: "Your order details are still here." },
        { status: 409 },
      ),
    );
    const c = await connect("intervening-shopper-question");
    transcript(c.socket, "output", ORDER_APPROVAL_QUESTION, 1, 20);
    transcript(c.socket, "input", "Can you explain returns? ", 30, 50);
    transcript(
      c.socket,
      "output",
      "Would you like me to explain the return exclusions?",
      60,
      80,
    );
    delegate(c.socket, "yes please", "answer-returns", 100);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(
      (await (state.post.mock.calls[0][0] as Request).clone().json()).input
        .text,
    ).toBe("Can you explain returns? yes please");
    expect(state.intent).toHaveBeenCalledWith(
      "intervening-shopper-question",
      "Can you explain returns? yes please",
      expect.objectContaining({
        approvalPromptActive: false,
        lastAssistantMessage:
          "Would you like me to explain the return exclusions?",
        recentTurns: [
          { role: "assistant", text: ORDER_APPROVAL_QUESTION },
          { role: "shopper", text: "Can you explain returns?" },
          {
            role: "assistant",
            text: "Would you like me to explain the return exclusions?",
          },
          { role: "shopper", text: "yes please" },
        ],
      }),
    );
  });
  it.each([
    ["It should arrive within four days.", 60],
    ["It should arrive within", 110],
  ])(
    "orders after a delivery answer, including an interrupted answer: %s",
    async (answer, end) => {
      reviewedOrder();
      nextIntent("approve_order");
      const c = await connect("delivery-then-order");
      transcript(c.socket, "input", "When will it arrive? ", 1, 20);
      transcript(c.socket, "output", answer, 30, end);
      delegate(
        c.socket,
        "I want to place the order",
        "order-after-delivery",
        100,
      );
      await vi.advanceTimersByTimeAsync(50);
      expect(state.complete).toHaveBeenCalledWith(
        "delivery-then-order",
        expect.objectContaining({
          transcript: "When will it arrive? I want to place the order",
        }),
        expect.objectContaining({
          intent: "approve_order",
          requiresApprovalQuestion: false,
        }),
      );
      expect(state.post).not.toHaveBeenCalled();
      expect(state.view).toBe("receipt");
      expect(state.intent).toHaveBeenCalledWith(
        "delivery-then-order",
        "When will it arrive? I want to place the order",
        expect.objectContaining({
          lastAssistantMessage: answer,
          recentTurns: [
            { role: "shopper", text: "When will it arrive?" },
            { role: "assistant", text: answer },
            { role: "shopper", text: "I want to place the order" },
          ],
        }),
      );
    },
  );
  it("accepts explicit approval during the offer readout before the order question is spoken", async () => {
    reviewedOrder();
    nextIntent("approve_order");
    const c = await connect("interrupt-offer");
    transcript(
      c.socket,
      "output",
      "Here's the microphone, for a total of",
      1,
      70,
    );
    await controlGptLive("interrupt-offer", c.callId, "stop-speaking");
    delegate(c.socket, "I want to place the order", "interrupt-buy", 100);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.complete).toHaveBeenCalledTimes(1);
    expect(state.complete.mock.calls[0][1]).not.toHaveProperty(
      "affirmationSummaryId",
    );
    expect(state.post).not.toHaveBeenCalled();
    expect(state.barge).not.toHaveBeenCalled();
    expect(state.view).toBe("receipt");
  });
  it("does not reuse approval context for a changed order summary", async () => {
    reviewedOrder();
    nextIntent("clarify");
    const c = await connect("changed-summary");
    transcript(c.socket, "output", ORDER_APPROVAL_QUESTION, 1, 20);
    state.summary = { ...state.summary!, revision: 3 };
    delegate(c.socket, "yes", "stale-assent", 100);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
    expect(c.socket.sent.join(" ")).toContain(ORDER_APPROVAL_QUESTION);
  });
  it("keeps approval bound to an unchanged displayed order across a conversational turn", async () => {
    reviewedOrder();
    nextIntent("approve_order", "assent");
    const c = await connect("stale-review-turn");
    transcript(c.socket, "output", ORDER_APPROVAL_QUESTION, 1, 20);
    state.turn = "intervening-turn";
    delegate(c.socket, "yes", "stale-assent", 100);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.complete).toHaveBeenCalledWith(
      "stale-review-turn",
      expect.objectContaining({
        summaryId: "summary-1",
        responseTurnId: "summary-turn",
      }),
      expect.objectContaining({
        intent: "approve_order",
        requiresApprovalQuestion: true,
      }),
    );
    expect(state.post).not.toHaveBeenCalled();
    expect(state.view).toBe("receipt");
  });
  it.each([
    ["Yes, but change it to two", "change_order"],
    ["No, don't buy it", "cancel_order"],
    ["Buy it if delivery is tomorrow", "question"],
  ] as const)(
    "keeps a change or qualification out of checkout: %s",
    async (text, intent) => {
      reviewedOrder();
      nextIntent(intent);
      state.post.mockResolvedValue(
        Response.json(
          { error: "Please review the requested change." },
          { status: 409 },
        ),
      );
      const c = await connect(`qualified-${text}`);
      transcript(c.socket, "output", ORDER_APPROVAL_QUESTION, 1, 20);
      delegate(c.socket, text, "changed-request", 100);
      await vi.advanceTimersByTimeAsync(50);
      expect(state.complete).not.toHaveBeenCalled();
      expect(state.post).toHaveBeenCalledTimes(1);
      expect(
        (await (state.post.mock.calls[0][0] as Request).clone().json()).input
          .text,
      ).toBe(text);
    },
  );
  it.each([
    ["y", "es please", "yes please", true],
    [
      "Yes I ",
      "approved this, can we just buy this",
      "Yes I approved this, can we just buy this",
      false,
    ],
  ])(
    "keeps fragmented approval intact: %s + %s",
    async (prefix, suffix, full, contextual) => {
      reviewedOrder();
      nextIntent("approve_order", contextual ? "assent" : "explicit");
      const c = await connect(`fragmented-${prefix}`);
      transcript(c.socket, "output", ORDER_APPROVAL_QUESTION, 1, 20);
      transcript(c.socket, "input", prefix as string, 30, 50);
      c.socket.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "session.delegation.created",
            offset_ms: 100,
            delegation: { target: "client", id: "fragmented-approval" },
          }),
        ),
      );
      await vi.advanceTimersByTimeAsync(75);
      expect(state.complete).not.toHaveBeenCalled();
      transcript(c.socket, "input", suffix as string, 50, 100);
      await vi.advanceTimersByTimeAsync(25);
      expect(state.complete).toHaveBeenCalledWith(
        `fragmented-${prefix}`,
        expect.objectContaining({
          transcript: full,
          ...(contextual ? { affirmationSummaryId: "summary-1" } : {}),
        }),
        expect.objectContaining({
          intent: "approve_order",
          requiresApprovalQuestion: contextual,
        }),
      );
      expect(state.post).not.toHaveBeenCalled();
    },
  );
  it("accepts an explicit natural purchase request without another approval question and never duplicates its order", async () => {
    reviewedOrder();
    nextIntent("approve_order");
    nextIntent("acknowledge_order");
    const c = await connect("natural-order");
    delegate(
      c.socket,
      "Yes I approved this, can we just buy this",
      "purchase",
      100,
    );
    await vi.advanceTimersByTimeAsync(50);
    delegate(
      c.socket,
      "Yes I approved this, can we just buy this",
      "purchase",
      100,
    );
    await vi.advanceTimersByTimeAsync(50);
    delegate(c.socket, "please buy it", "purchase-again", 200);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.complete).toHaveBeenCalledTimes(1);
    expect(state.complete.mock.calls[0][1]).not.toHaveProperty(
      "affirmationSummaryId",
    );
    expect(state.post).not.toHaveBeenCalled();
    expect(state.view).toBe("receipt");
    expect(c.socket.sent.join(" ")).toContain("all set");
  });
  it.each(["That's good", "yes", "thanks", "Thank you!"])(
    "keeps a post-purchase acknowledgment conversational: %s",
    async (text) => {
      reviewedOrder();
      nextIntent("acknowledge_order");
      state.receipt = {
        id: "receipt-1",
        acceptedOrder: { deliveryWindow: "Within 2 days" },
      };
      state.view = "receipt";
      const c = await connect(`post-purchase-${text}`);
      delegate(c.socket, text, "acknowledgment", 100);
      await vi.advanceTimersByTimeAsync(50);
      expect(state.complete).not.toHaveBeenCalled();
      expect(state.post).not.toHaveBeenCalled();
      const commentary = c.socket.sent
        .map((raw) => JSON.parse(raw))
        .filter((event) => event.type === "session.commentary.append");
      expect(commentary).toHaveLength(1);
      expect(commentary[0].content).toMatch(/hope you enjoy it/i);
      expect(commentary[0].content).not.toContain("Expected delivery");
    },
  );
  it("holds an in-flight approval when a correction arrives before another delegation", async () => {
    reviewedOrder();
    let finish!: (decision: CheckoutIntentDecision) => void;
    state.intent.mockImplementationOnce(
      () =>
        new Promise<CheckoutIntentDecision>((resolve) => {
          finish = resolve;
        }),
    );
    nextIntent("cancel_order");
    state.post.mockResolvedValue(
      Response.json({ error: "Order held." }, { status: 409 }),
    );
    const c = await connect("correction-during-intent");
    delegate(c.socket, "Please make the purchase. ", "original-approval", 100);
    await vi.advanceTimersByTimeAsync(50);
    expect(state.intent).toHaveBeenCalledTimes(1);
    expect(gptLiveState("correction-during-intent", c.callId).pending).toBe(
      true,
    );
    transcript(c.socket, "input", "Wait, don't buy it.", 110, 150);
    finish({
      intent: "approve_order",
      authorization: "explicit",
      summaryId: "summary-1",
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.post).not.toHaveBeenCalled();
    expect(gptLiveState("correction-during-intent", c.callId).pending).toBe(
      false,
    );
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.delegation.created",
          offset_ms: 150,
          delegation: { target: "client", id: "corrected-request" },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(50);
    expect(state.intent).toHaveBeenLastCalledWith(
      "correction-during-intent",
      "Please make the purchase. Wait, don't buy it.",
      expect.any(Object),
    );
    expect(state.complete).not.toHaveBeenCalled();
    expect(state.post).toHaveBeenCalledTimes(1);
    expect(
      (await (state.post.mock.calls[0][0] as Request).clone().json()).input
        .text,
    ).toBe("Please make the purchase. Wait, don't buy it.");
  });
  it("does not speak an old failure after a newer typed turn takes ownership", async () => {
    let finish!: (response: Response) => void;
    state.post.mockImplementation(async (req: Request) => {
      state.turn = (await req.json()).input.turnId;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const c = await connect("stale-failure");
    delegate(c.socket, "Show options", "old-work", 100);
    await vi.advanceTimersByTimeAsync(50);
    state.turn = "newer-typed-turn";
    finish(Response.json({ error: "OLD FAILURE" }, { status: 409 }));
    await vi.advanceTimersByTimeAsync(1);
    expect(c.socket.sent.join(" ")).not.toContain("OLD FAILURE");
    expect(gptLiveState("stale-failure", c.callId).error).toBeUndefined();
  });
  it("routes spoken confirm to the displayed order and announces its receipt once", async () => {
    nextIntent("approve_order");
    state.view = "summary";
    state.turn = "summary-turn";
    state.summary = {
      id: "summary-1",
      revision: 2,
      responseTurnId: state.turn,
    };
    state.complete.mockImplementation(() => {
      state.receipt = {
        id: "receipt-1",
        acceptedOrder: { deliveryWindow: "Within 2 days" },
      };
      state.view = "receipt";
      state.message =
        "Your order is confirmed. Expected delivery: within 2 days.";
      state.revision++;
      return { receipt: state.receipt };
    });
    const c = await connect("voice-checkout");
    delegate(c.socket, "Confirm.", "checkout-one", 100);
    await vi.advanceTimersByTimeAsync(351);
    expect(state.post).not.toHaveBeenCalled();
    expect(state.complete).toHaveBeenCalledWith(
      "voice-checkout",
      expect.objectContaining({
        summaryId: "summary-1",
        summaryRevision: 2,
        responseTurnId: "summary-turn",
        transcript: "Confirm.",
        delegationId: expect.stringContaining("checkout-one"),
      }),
      expect.objectContaining({
        intent: "approve_order",
        transcript: "Confirm.",
      }),
    );
    gptLiveState("voice-checkout", c.callId);
    gptLiveState("voice-checkout", c.callId);
    const commentary = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter((event) => event.type === "session.commentary.append");
    expect(commentary).toHaveLength(1);
    expect(commentary[0].content).toBe(state.message);
    const contexts = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter((event) => event.type === "session.thinking.append");
    expect(contexts).toHaveLength(1);
    expect(JSON.parse(contexts[0].content).purchase.status).toBe("confirmed");
    expect(state.view).toBe("receipt");
  });
  it("keeps the order in view when live checkout is not ready", async () => {
    nextIntent("approve_order");
    state.view = "summary";
    state.turn = "summary-turn";
    state.summary = {
      id: "summary-1",
      revision: 2,
      responseTurnId: state.turn,
    };
    state.complete.mockImplementation(() => {
      throw new Error("Review the current order details before confirming.");
    });
    const c = await connect("unready-checkout");
    delegate(c.socket, "confirm", "checkout-two", 100);
    await vi.advanceTimersByTimeAsync(351);
    expect(state.post).not.toHaveBeenCalled();
    expect(state.view).toBe("summary");
    expect(gptLiveState("unready-checkout", c.callId).pending).toBe(false);
    expect(gptLiveState("unready-checkout", c.callId).error).toContain(
      "Review the current order",
    );
    expect(c.socket.sent.join(" ")).toContain(
      "Review the current order details",
    );
  });
  it("speaks a receipt completed in text once while a voice call is open", async () => {
    const c = await connect("typed-checkout");
    state.receipt = {
      id: "receipt-typed",
      acceptedOrder: { deliveryWindow: "Within 3 days" },
    };
    state.view = "receipt";
    state.message = "You're all set. Expected delivery: within 3 days.";
    state.revision++;
    gptLiveState("typed-checkout", c.callId);
    gptLiveState("typed-checkout", c.callId);
    const commentary = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter((event) => event.type === "session.commentary.append");
    expect(commentary.map((event) => event.content)).toEqual([state.message]);
  });
  it("correction supersedes earlier work and cannot speak its stale result", async () => {
    const resolve: Array<(value: Response) => void> = [];
    state.post.mockImplementation(async (req: Request) => {
      const b = await req.json();
      state.turn = b.input.turnId;
      return new Promise<Response>((r) => resolve.push(r));
    });
    const c = await connect("correct");
    delegate(c.socket, "Find bags", "first", 100);
    await vi.advanceTimersByTimeAsync(351);
    delegate(c.socket, "Actually under eighty", "second", 200);
    await vi.advanceTimersByTimeAsync(351);
    expect(state.barge).toHaveBeenCalledTimes(1);
    resolve[0](Response.json({ snapshot: { message: "OLD RESULT" } }));
    resolve[1](Response.json({ snapshot: { message: "NEW RESULT" } }));
    await vi.advanceTimersByTimeAsync(1);
    expect(c.socket.sent.join(" ")).not.toContain("OLD RESULT");
    expect(c.socket.sent.join(" ")).toContain("NEW RESULT");
  });
  it("cancellation invalidates a delegation still waiting for transcripts", async () => {
    const c = await connect("cancel-buffer");
    delegate(c.socket, "Find bags", "waiting", 100);
    await controlGptLive("cancel-buffer", c.callId, "cancel-task");
    await vi.advanceTimersByTimeAsync(2000);
    expect(state.post).not.toHaveBeenCalled();
    expect(gptLiveState("cancel-buffer", c.callId).pending).toBe(false);
  });
  it("empty delegation does not orphan an already running task", async () => {
    let finish!: (value: Response) => void;
    state.post.mockImplementation(async (req: Request) => {
      const body = await req.json();
      state.turn = body.input.turnId;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const c = await connect("empty");
    delegate(c.socket, "Find bags", "original", 100);
    await vi.advanceTimersByTimeAsync(351);
    c.socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: "session.delegation.created",
          offset_ms: 200,
          delegation: { target: "client", id: "empty" },
        }),
      ),
    );
    await vi.advanceTimersByTimeAsync(2000);
    finish(Response.json({ snapshot: { message: "Useful completed result" } }));
    await vi.advanceTimersByTimeAsync(1);
    expect(gptLiveState("empty", c.callId).pending).toBe(false);
    expect(c.socket.sent.join(" ")).toContain("Useful completed result");
    expect(state.barge).not.toHaveBeenCalled();
    const feedback = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter((event) => event.type === "session.commentary.append");
    expect(
      feedback.some((event) =>
        event.content.includes("Could you say it again?"),
      ),
    ).toBe(true);
  });
  it("refreshes verified context when a typed turn changes the session", async () => {
    const c = await connect("sync-state");
    state.revision++;
    gptLiveState("sync-state", c.callId);
    const messages = c.socket.sent.map((raw) => JSON.parse(raw));
    expect(
      messages.some((message) => message.type === "session.thinking.append"),
    ).toBe(true);
  });
  it("does not repeat unchanged context through sync or bookkeeping-only revisions", async () => {
    const c = await connect("deduplicate-context");
    state.revision++;
    gptLiveState("deduplicate-context", c.callId);
    await controlGptLive("deduplicate-context", c.callId, "sync");
    state.revision++;
    gptLiveState("deduplicate-context", c.callId);
    gptLiveState("deduplicate-context", c.callId);
    const contexts = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter((event) => event.type === "session.thinking.append");
    expect(contexts).toHaveLength(1);
    const call = (globalThis as any).__alongGptLiveCalls.get(
      "deduplicate-context",
    );
    expect(call.contextRevision).toBe(state.revision);
  });
  it("does not mark changed context sent when the sideband cannot send it", async () => {
    const c = await connect("unsent-context");
    state.revision++;
    Object.assign(c.socket, { readyState: 0 });
    gptLiveState("unsent-context", c.callId);
    expect(c.socket.sent).toHaveLength(0);
    Object.assign(c.socket, { readyState: 1 });
    gptLiveState("unsent-context", c.callId);
    expect(c.socket.sent.map((raw) => JSON.parse(raw))).toEqual([
      expect.objectContaining({ type: "session.thinking.append" }),
    ]);
  });
  it("tells voice that no products are visible before it claims options are ready", async () => {
    await connect("empty-display");
    const request = JSON.parse(
      vi.mocked(fetch).mock.calls[0][1]!.body as string,
    );
    const context = request.session.input[0].content[0].text;
    expect(context).toContain('"carouselProductCount":0');
    expect(context).toContain('"shoppingTaskPending":false');
    expect(request.session.instructions).toContain(LIVE_SHOPPING_GUARDRAILS);
  });
  it("refreshes guardrails on an existing call once without restarting shopping", async () => {
    const c = await connect("old-policy");
    const registry = (globalThis as any).__alongGptLiveCalls;
    registry.get("old-policy").guardrails = "older policy";
    gptLiveState("old-policy", c.callId);
    gptLiveState("old-policy", c.callId);
    const instructions = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter((event) => event.type === "session.instructions.append");
    expect(instructions).toHaveLength(1);
    expect(instructions[0].content).toBe(LIVE_SHOPPING_GUARDRAILS);
    expect(instructions[0].content.length).toBeLessThanOrEqual(1500);
    expect(state.post).not.toHaveBeenCalled();
    expect(state.barge).not.toHaveBeenCalled();
  });
  it("uses the canvas catalog for product names and distinguishes hidden shortlists", async () => {
    state.view = "shortlist";
    state.displayOrder = ["mic-1"];
    const c = await connect("product-context");
    const request = JSON.parse(
      vi.mocked(fetch).mock.calls[0][1]!.body as string,
    );
    const context = JSON.parse(
      request.session.input[0].content[0].text.replace(
        "Current verified shopping state: ",
        "",
      ),
    );
    expect(context.carouselProductCount).toBe(1);
    expect(context.products).toEqual([
      { id: "mic-1", title: "USB microphone" },
    ]);
    state.view = "understanding";
    state.revision++;
    gptLiveState("product-context", c.callId);
    const updated = JSON.parse(
      c.socket.sent.map((raw) => JSON.parse(raw)).at(-1).content,
    );
    expect(updated.carouselProductCount).toBe(0);
  });
  it("gives voice the same ordered direction choices shown on the canvas", async () => {
    state.view = "solution_types";
    await connect("direction-context");
    const request = JSON.parse(
      vi.mocked(fetch).mock.calls[0][1]!.body as string,
    );
    const context = JSON.parse(
      request.session.input[0].content[0].text.replace(
        "Current verified shopping state: ",
        "",
      ),
    );
    expect(context.carouselProductCount).toBe(0);
    expect(context.solutionType).toBeNull();
    expect(context.solutionChoices).toEqual(
      AUDIO_SOLUTION_CHOICES.map((choice, index) => ({
        position: index + 1,
        solutionType: choice.solutionType,
        title: choice.title,
      })),
    );
  });
  it("clears pending context when a task ends without a state revision change", async () => {
    let finish!: (value: Response) => void;
    state.post.mockImplementation(async (req: Request) => {
      state.turn = (await req.json()).input.turnId;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    const c = await connect("pending-context");
    delegate(c.socket, "Show me the actual options", "show", 100);
    await vi.advanceTimersByTimeAsync(351);
    gptLiveState("pending-context", c.callId);
    finish(Response.json({ snapshot: { message: "Three choices are ready" } }));
    await vi.advanceTimersByTimeAsync(1);
    gptLiveState("pending-context", c.callId);
    const contexts = c.socket.sent
      .map((raw) => JSON.parse(raw))
      .filter(
        (event) =>
          event.type === "session.thinking.append" &&
          event.content.startsWith("{"),
      )
      .map((event) => JSON.parse(event.content));
    expect(contexts.some((context) => context.shoppingTaskPending)).toBe(true);
    expect(contexts.at(-1).shoppingTaskPending).toBe(false);
    expect(contexts).toHaveLength(2);
    expect(state.post).toHaveBeenCalledTimes(1);
  });
  it("rejects a different call identity and does not execute events on a closed socket", async () => {
    const c = await connect("closed");
    await expect(
      controlGptLive("closed", "wrong", "cancel-task"),
    ).rejects.toThrow("disconnected");
    c.socket.close();
    delegate(c.socket, "Find bags", "closed-delegation", 100);
    await vi.advanceTimersByTimeAsync(351);
    expect(state.post).not.toHaveBeenCalled();
  });
});
