import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/session/route";
import { getRuntime } from "@/lib/integration/runtime";
import { project } from "@/lib/integration/projection";

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
    expect(providerRequests).toEqual([
      "https://api.openai.com/v1/live/sessions",
    ]);

    emit(h.socket, {
      type: "session.delegation.created",
      offset_ms: 200,
      delegation: { target: "client", id: "place-order" },
    });
    delegate(h.socket, "Please buy it", "repeat-approval", 300);
    await vi.advanceTimersByTimeAsync(100);
    expect(h.store.core.get(h.sessionId)).toEqual(accepted);
    expect(commentary(h.socket).at(-1)).toMatch(/already confirmed/i);
    expect(modelRequests).toHaveLength(0);
  });

  it("separates an already answered delivery question from the next explicit purchase", async () => {
    const h = await displayedReview();
    transcript(h.socket, "input", "When will it arrive?", 150, 180);
    transcript(h.socket, "output", deliveryAnswer, 190, 240);
    delegate(
      h.socket,
      "I want to place the order",
      "after-delivery-answer",
      300,
    );
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    const accepted = h.store.core.get(h.sessionId);
    expect(accepted.receipt!.summaryId).toBe(h.review.id);
    expect(accepted.history.at(-1)!.text).toBe("I want to place the order");
    expect(modelRequests).toHaveLength(0);
  });

  it("keeps the review through a delegated read-only question and speaks its answer before checkout", async () => {
    const h = await displayedReview();
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

    delegate(
      h.socket,
      "Let's lock this order in. Purchase this",
      "after-discussion",
      300,
    );
    await vi.waitFor(() => expect(project(h.sessionId).view).toBe("receipt"));
    expect(h.store.core.get(h.sessionId).receipt!.summaryId).toBe(h.review.id);
    expect(modelRequests).toHaveLength(1);
  });
});
