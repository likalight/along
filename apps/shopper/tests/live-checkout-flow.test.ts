import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/session/route";
import { getRuntime } from "@/lib/integration/runtime";
import { project } from "@/lib/integration/projection";
import type {
  CheckoutIntentContext,
  CheckoutIntentDecision,
} from "@/lib/checkout/intent";

const sockets: Array<EventEmitter & { sent: string[]; close(): void }> = [];
vi.mock("ws", () => ({
  default: class extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    sent: string[] = [];
    constructor() {
      super();
      sockets.push(this);
      queueMicrotask(() => this.emit("open"));
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
import {
  connectGptLive,
  controlGptLive,
  gptLiveState,
} from "@/lib/voice/gpt-live-server";

const deliveryAnswer =
  "The delivery estimate shown belongs to this selected offer.";
let modelRequests: string[] = [];
let providerRequests: string[] = [];
let intentRequests: CheckoutIntentContext[] = [];
let intentResponses: Array<
  (context: CheckoutIntentContext) => Response | Promise<Response>
> = [];

function intentResponse(
  context: CheckoutIntentContext,
  intent: CheckoutIntentDecision["intent"],
  authorization: CheckoutIntentDecision["authorization"] = "explicit",
) {
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              intent,
              authorization:
                intent === "approve_order" ? authorization : "none",
              summaryId: intent === "approve_order" ? context.review?.id : null,
            }),
          },
        ],
      },
    ],
  });
}

// Each test supplies its semantic decision; this fake provider contains no
// phrase classifier that could duplicate production's interpretation rules.
function nextIntent(
  intent: CheckoutIntentDecision["intent"],
  authorization: CheckoutIntentDecision["authorization"] = "explicit",
) {
  intentResponses.push((context) =>
    intentResponse(context, intent, authorization),
  );
}

function emit(socket: EventEmitter, event: Record<string, unknown>) {
  socket.emit("message", Buffer.from(JSON.stringify(event)));
}
function transcript(
  socket: EventEmitter,
  speaker: "input" | "output",
  text: string,
  start: number,
  end: number,
) {
  emit(socket, {
    type: `session.${speaker}_transcript.delta`,
    event_id: crypto.randomUUID(),
    delta: text,
    start_ms: start,
    end_ms: end,
  });
}
function delegate(
  socket: EventEmitter,
  text: string,
  id: string,
  offset: number,
) {
  transcript(socket, "input", text, offset - 10, offset);
  emit(socket, {
    type: "session.delegation.created",
    offset_ms: offset,
    delegation: { target: "client", id },
  });
}
function commentary(socket: { sent: string[] }) {
  return socket.sent
    .map((raw) => JSON.parse(raw))
    .filter((event) => event.type === "session.commentary.append")
    .map((event) => event.content as string);
}

async function selectedOrder() {
  const connected = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect" }),
    }),
  );
  expect(connected.status).toBe(200);
  const initial = await connected.json();
  const cookie = connected.headers.get("set-cookie")!.split(";")[0];
  const { store } = getRuntime();
  let state = store.core.get(initial.sessionId);
  const quote = store
    .quotes(state.id)
    .find(
      (candidate) =>
        candidate.eligible && candidate.offer.classification === "proxy",
    )!;
  expect(quote).toBeDefined();
  state = store.core.input(state.id, {
    sessionId: state.id,
    epoch: state.epoch,
    eventId: crypto.randomUUID(),
    turnId: crypto.randomUUID(),
    baseRevision: state.revision,
    modality: "voice",
    text: "I choose this offer",
    visibleRevision: state.revision,
    visibleProductIds: state.displayOrder,
  });
  state = store.core.propose(
    state.id,
    {
      expectedRevision: state.revision,
      turnId: state.turn!.id,
      shortlist: [quote.product.id],
      stage: "offers",
      selection: { offerId: quote.offer.id, quantity: 1 },
    },
    { includeOffers: false },
  ).session;
  expect(state.summary).toBeNull();
  const live = await connectGptLive(
    new Request("http://localhost/api/voice/live/connect", {
      headers: { cookie },
    }),
    { sessionId: state.id, sdp: "v=0\r\n" },
  );
  return {
    sessionId: state.id,
    cookie,
    store,
    ...live,
    socket: sockets.at(-1)!,
  };
}

async function displayedReview() {
  const h = await selectedOrder();
  nextIntent("prepare_order");
  delegate(h.socket, "I want to place the order", "prepare-review", 100);
  await vi.waitFor(() => {
    expect(h.store.core.get(h.sessionId).summary).not.toBeNull();
    expect(gptLiveState(h.sessionId, h.callId).pending).toBe(false);
  });
  let state = h.store.core.get(h.sessionId);
  expect(state.receipt).toBeNull();
  expect(state.summary!.displayed).toBe(false);
  const response = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: h.cookie },
      body: JSON.stringify({
        action: "presented",
        summaryId: state.summary!.id,
        textHash: state.summary!.textHash,
        input: {
          sessionId: state.id,
          epoch: state.epoch,
          turnId: state.summary!.responseTurnId,
          eventId: crypto.randomUUID(),
        },
      }),
    }),
  );
  expect(response.status).toBe(200);
  state = h.store.core.get(h.sessionId);
  expect(state.summary!.displayed).toBe(true);
  expect(state.summary!.playback).toBe("pending");
  expect(state.summary!.approvalNonce).toBeNull();
  expect(modelRequests).toHaveLength(0);
  expect(intentRequests).toHaveLength(1);
  expect(intentRequests[0]).toMatchObject({
    text: "I want to place the order",
    stage: "selected",
  });
  return { ...h, review: state.summary! };
}

describe("real checkout route and store behind the Live sideband", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("OPENAI_API_KEY", "test-provider-key");
    // Exercise the real orchestrator for the read-only turn, with only its
    // provider response mocked. All catalog offers and receipts remain local.
    vi.stubEnv("ALONG_AGENT_MODE", "live");
    modelRequests = [];
    providerRequests = [];
    intentRequests = [];
    intentResponses = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const target = String(url);
        providerRequests.push(target);
        if (target === "https://api.openai.com/v1/live/sessions")
          return Response.json({
            session: { id: crypto.randomUUID() },
            transport: { sdp: "answer" },
          });
        if (target === "https://api.openai.com/v1/responses") {
          const body = JSON.parse(String(init?.body));
          if (body.text?.format?.name === "checkout_intent") {
            const context = JSON.parse(
              body.input[0].content,
            ) as CheckoutIntentContext;
            intentRequests.push(context);
            const response = intentResponses.shift();
            if (!response)
              throw new Error("Unexpected semantic intent request");
            return response(context);
          }
          modelRequests.push(String(init?.body));
          return Response.json({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      heading: "Delivery details",
                      message: deliveryAnswer,
                      segments: [{ text: deliveryAnswer, productId: null }],
                    }),
                  },
                ],
              },
            ],
          });
        }
        throw new Error(`Unexpected network request: ${target}`);
      }),
    );
  });
  afterEach(() => {
    for (const socket of sockets) socket.close();
    sockets.length = 0;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("completes 'make the purchase' against the displayed review without asking the shopping model to repeat it", async () => {
    const h = await displayedReview();
    nextIntent("approve_order");
    delegate(h.socket, "make the purchase", "natural-completion", 200);
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    const accepted = h.store.core.get(h.sessionId);
    expect(accepted.receipt!.summaryId).toBe(h.review.id);
    expect(accepted.receipt!.quote).toEqual(h.review.quote);
    expect(modelRequests).toHaveLength(0);
    expect(intentRequests).toHaveLength(2);
    expect(intentRequests[1]).toMatchObject({
      text: "make the purchase",
      stage: "review",
      review: { id: h.review.id, revision: h.review.revision, displayed: true },
    });
    expect(accepted.history.at(-1)!.text).toBe("make the purchase");
    expect(commentary(h.socket).at(-1)).toMatch(/confirmed/i);
  });

  it("prepares the selected offer, accepts an interrupted compound purchase, and never duplicates it", async () => {
    const h = await displayedReview();
    transcript(
      h.socket,
      "output",
      "Here's your order, with the selected delivery estimate",
      110,
      150,
    );
    await controlGptLive(h.sessionId, h.callId, "stop-speaking");
    const approval = "Yeah, uh, let's lock this order in. Purchase this.";
    nextIntent("approve_order");
    delegate(h.socket, approval, "place-order", 200);
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    const accepted = h.store.core.get(h.sessionId);
    expect(accepted.receipt!.summaryId).toBe(h.review.id);
    expect(accepted.receipt!.quote).toEqual(h.review.quote);
    expect(accepted.receipt!.completionSource).toBe("live_demo");
    expect(accepted.receipt!.simulated).toBe(true);
    expect(accepted.summary!.playback).toBe("pending");
    expect(accepted.summary!.approvalNonce).toBeNull();
    expect(accepted.history.at(-1)!.text).toBe(approval);
    expect(modelRequests).toHaveLength(0);
    expect(intentRequests).toHaveLength(2);
    expect(intentRequests[1].text).toBe(approval);
    expect(providerRequests).toEqual([
      "https://api.openai.com/v1/live/sessions",
      "https://api.openai.com/v1/responses",
      "https://api.openai.com/v1/responses",
    ]);

    emit(h.socket, {
      type: "session.delegation.created",
      offset_ms: 200,
      delegation: { target: "client", id: "place-order" },
    });
    nextIntent("acknowledge_order");
    delegate(h.socket, "Please buy it", "repeat-approval", 300);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.store.core.get(h.sessionId)).toEqual(accepted);
    expect(commentary(h.socket).at(-1)).toMatch(/order is confirmed/i);
    expect(modelRequests).toHaveLength(0);
  });

  it("separates an already answered delivery question from the next explicit purchase", async () => {
    const h = await displayedReview();
    transcript(
      h.socket,
      "output",
      "Would you like me to place this order?",
      110,
      140,
    );
    transcript(h.socket, "input", "When will it arrive?", 150, 180);
    transcript(h.socket, "output", deliveryAnswer, 190, 240);
    nextIntent("approve_order");
    delegate(
      h.socket,
      "I want to place the order",
      "after-delivery-answer",
      300,
    );
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    const accepted = h.store.core.get(h.sessionId);
    expect(accepted.receipt!.summaryId).toBe(h.review.id);
    const rawText = "When will it arrive?I want to place the order";
    expect(accepted.history.at(-1)!.text).toBe(rawText);
    expect(modelRequests).toHaveLength(0);
    expect(intentRequests[1].text).toBe(rawText);
    expect(intentRequests[1].lastAssistantMessage).toContain(deliveryAnswer);
    expect(intentRequests[1].recentTurns?.slice(-3)).toEqual([
      { role: "shopper", text: "When will it arrive?" },
      { role: "assistant", text: deliveryAnswer },
      { role: "shopper", text: "I want to place the order" },
    ]);
  });

  it("does not borrow an older approval question for yes after an unrelated intervening question", async () => {
    const h = await displayedReview();
    transcript(
      h.socket,
      "output",
      "Would you like me to place this order?",
      110,
      140,
    );
    transcript(h.socket, "input", "I have an adapter question", 150, 180);
    transcript(h.socket, "output", "Do you already have an adapter?", 190, 240);
    nextIntent("clarify");
    delegate(h.socket, "Yes", "answer-to-adapter-question", 300);
    await vi.waitFor(() => {
      expect(intentRequests).toHaveLength(2);
      expect(gptLiveState(h.sessionId, h.callId).pending).toBe(false);
    });
    expect(intentRequests[1].text).toBe("I have an adapter questionYes");
    expect(intentRequests[1].lastAssistantMessage).toBe(
      "Do you already have an adapter?",
    );
    expect(intentRequests[1].recentTurns?.slice(-3)).toEqual([
      { role: "shopper", text: "I have an adapter question" },
      { role: "assistant", text: "Do you already have an adapter?" },
      { role: "shopper", text: "Yes" },
    ]);
    expect(h.store.core.get(h.sessionId).receipt).toBeNull();
    expect(h.store.core.get(h.sessionId).summary!.id).toBe(h.review.id);
    expect(modelRequests).toHaveLength(0);
    expect(commentary(h.socket).at(-1)).toMatch(
      /would you like me to place this order/i,
    );
  });

  it("keeps the review through a delegated read-only question and speaks its answer before checkout", async () => {
    const h = await displayedReview();
    nextIntent("question");
    delegate(
      h.socket,
      "Can you explain the delivery estimate?",
      "delivery-question",
      200,
    );
    await vi.waitFor(() => {
      expect(modelRequests).toHaveLength(1);
      expect(gptLiveState(h.sessionId, h.callId).pending).toBe(false);
    });
    const discussed = h.store.core.get(h.sessionId);
    expect(discussed.turn!.id).not.toBe(h.review.responseTurnId);
    expect(discussed.summary!.id).toBe(h.review.id);
    expect(discussed.summary!.quote).toEqual(h.review.quote);
    expect(discussed.receipt).toBeNull();
    expect(commentary(h.socket).at(-1)).toBe(deliveryAnswer);
    expect(intentRequests).toHaveLength(2);

    nextIntent("approve_order");
    delegate(
      h.socket,
      "Let's lock this order in. Purchase this",
      "after-discussion",
      300,
    );
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    expect(h.store.core.get(h.sessionId).receipt!.summaryId).toBe(h.review.id);
    expect(modelRequests).toHaveLength(1);
    expect(intentRequests).toHaveLength(3);
  });

  it("completes an unfamiliar conversational instruction from its meaning and preserves the exact transcript", async () => {
    const h = await displayedReview();
    const text = "Go ahead and get that sorted for me, I'd love to have it.";
    nextIntent("approve_order");
    delegate(h.socket, text, "unfamiliar-approval", 200);
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    expect(h.store.core.get(h.sessionId).history.at(-1)?.text).toBe(text);
    expect(h.store.core.get(h.sessionId).receipt!.summaryId).toBe(h.review.id);
    expect(intentRequests[1].text).toBe(text);
    expect(modelRequests).toHaveLength(0);
  });

  it.each([
    ["question", "Buy this, but only if it will reach me before my trip."],
    [
      "change_order",
      "Make the purchase, but change the quantity to two first.",
    ],
    [
      "question",
      "Before making the purchase, can I ask about the return policy?",
    ],
    ["cancel_order", "I was going to purchase it, but cancel that order."],
  ] as const)(
    "does not purchase when the semantic intent is %s",
    async (intent, text) => {
      const h = await displayedReview();
      nextIntent(intent);
      delegate(h.socket, text, `non-approval-${intent}`, 200);
      await vi.waitFor(() => {
        expect(intentRequests).toHaveLength(2);
        expect(gptLiveState(h.sessionId, h.callId).pending).toBe(false);
      });
      expect(h.store.core.get(h.sessionId).receipt).toBeNull();
      expect(intentRequests[1].text).toBe(text);
      expect(h.store.core.get(h.sessionId).history.at(-1)?.text).toBe(text);
      expect(modelRequests).toHaveLength(1);
      expect(JSON.stringify(JSON.parse(modelRequests[0]).input)).toContain(
        text,
      );
    },
  );

  it("speaks an interpreter failure while preserving the review, then permits a fresh successful request", async () => {
    const h = await displayedReview();
    const before = h.store.core.get(h.sessionId);
    intentResponses.push(
      () => new Response("provider unavailable", { status: 503 }),
    );
    delegate(h.socket, "Please go ahead with that", "intent-failure", 200);
    await vi.waitFor(() => {
      expect(intentRequests).toHaveLength(2);
      expect(gptLiveState(h.sessionId, h.callId).pending).toBe(false);
    });
    expect(h.store.core.get(h.sessionId)).toEqual(before);
    expect(project(h.sessionId).view).toBe("summary");
    expect(commentary(h.socket).at(-1)).toMatch(
      /couldn't interpret.*try again/i,
    );
    expect(modelRequests).toHaveLength(0);

    nextIntent("approve_order");
    delegate(
      h.socket,
      "All right, take care of it",
      "after-intent-failure",
      300,
    );
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    expect(h.store.core.get(h.sessionId).receipt!.summaryId).toBe(h.review.id);
    expect(h.store.core.get(h.sessionId).history.at(-1)?.text).toBe(
      "Please go ahead with thatAll right, take care of it",
    );
  });

  it("rejects a semantic approval if accepted state changes while interpretation is pending", async () => {
    const h = await displayedReview();
    let finishIntent!: () => void;
    intentResponses.push(
      (context) =>
        new Promise<Response>((resolve) => {
          finishIntent = () =>
            resolve(intentResponse(context, "approve_order"));
        }),
    );
    delegate(h.socket, "Get that arranged for me", "stale-interpretation", 200);
    await vi.waitFor(() => expect(intentRequests).toHaveLength(2));
    const before = h.store.core.get(h.sessionId);
    const newer = h.store.core.beginTurn(h.sessionId, before.revision);
    finishIntent();
    await vi.waitFor(() =>
      expect(gptLiveState(h.sessionId, h.callId).pending).toBe(false),
    );
    expect(h.store.core.get(h.sessionId)).toEqual(newer);
    expect(h.store.core.get(h.sessionId).receipt).toBeNull();
    expect(commentary(h.socket).at(-1)).toMatch(/order changed.*checking/i);
    expect(modelRequests).toHaveLength(0);
  });
});
