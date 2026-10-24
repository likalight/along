import { expect, it, vi } from "vitest";
import { POST } from "@/app/api/session/route";
import { getRuntime } from "@/lib/integration/runtime";
import { project } from "@/lib/integration/projection";
import { completeLiveDemoCheckout } from "@/lib/voice/live-demo-checkout";

async function review(mode: "voice" | "text" = "voice") {
  const connected = await POST(
    new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect" }),
    }),
  );
  const initial = await connected.json();
  const cookie = connected.headers.get("set-cookie")!.split(";")[0];
  const { store } = getRuntime();
  let s = store.core.get(initial.sessionId);
  // Exercise the authoritative review with one known product; enumerating the
  // entire catalog here repeats full integrity validation for every offer.
  const quote = store
    .quotes(s.id, "BAG-001")
    .find((candidate) => candidate.eligible)!;
  s = store.core.input(s.id, {
    sessionId: s.id,
    epoch: s.epoch,
    eventId: crypto.randomUUID(),
    turnId: crypto.randomUUID(),
    baseRevision: s.revision,
    modality: mode,
    text: "Review this order",
    visibleRevision: s.revision,
    visibleProductIds: s.displayOrder,
  });
  s = store.core.propose(s.id, {
    expectedRevision: s.revision,
    turnId: s.turn!.id,
    shortlist: [quote.product.id],
    selection: { offerId: quote.offer.id, quantity: 1 },
  }).session;
  s = store.core.summarize(s.id, s.revision, s.turn!.id);
  s = store.core.presentation(s.id, {
    summaryId: s.summary!.id,
    turnId: s.summary!.responseTurnId,
    textHash: s.summary!.textHash,
    event: "displayed",
  });
  const snapshot = project(s.id);
  const send = (text: string, extras: Record<string, unknown> = {}) =>
    POST(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({
          action: "input",
          input: {
            sessionId: s.id,
            epoch: s.epoch,
            turnId: crypto.randomUUID(),
            eventId: crypto.randomUUID(),
            baseRevision: s.revision,
            modality: mode,
            text,
            visibleRevision: s.revision,
            visibleProductIds: s.displayOrder,
          },
          ...extras,
        }),
      }),
    );
  return { store, s, snapshot, send };
}

it("preserves the displayed order when ordinary Live captions attempt confirmation without trusted evidence", async () => {
  const h = await review();
  for (const text of [
    "confirm",
    "confirm purchase",
    "Confirm this simulated purchase",
    "yes",
    "yes please",
    "go ahead",
    '"confirm"',
    "confirm, no wait",
  ]) {
    const response = await h.send(text);
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.snapshot.summary.id).toBe(h.snapshot.summary!.id);
    expect(data.snapshot.view).toBe("summary");
    expect(h.store.core.get(h.s.id)).toEqual(h.s);
    expect(data.snapshot.receipt).toBeNull();
  }
});

it("accepts natural typed confirm through the original exact-summary approval guard", async () => {
  const h = await review("text");
  const response = await h.send("confirm");
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.snapshot.view).toBe("receipt");
  expect(data.snapshot.receipt.simulated).toBe(true);
  expect(h.store.core.get(h.s.id).receipt!.completionSource).toBeUndefined();
});

it.each([
  "Yes I approved this, can we just buy this",
  "Yes, go ahead and place the order",
  "Please buy it",
  "yes please",
  "sounds good",
])(
  "accepts a natural response to the displayed order question: %s",
  async (text) => {
    const h = await review("text");
    const response = await h.send(text);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.snapshot.view).toBe("receipt");
    expect(data.snapshot.receipt.acceptedOrder.productId).toBe(
      h.snapshot.summary!.productId,
    );
  },
);

it("does not treat yes to an intervening question as order approval", async () => {
  const h = await review("text");
  const current = h.store.core.get(h.s.id);
  const followup = h.store.core.input(h.s.id, {
    sessionId: h.s.id,
    epoch: h.s.epoch,
    eventId: crypto.randomUUID(),
    turnId: crypto.randomUUID(),
    baseRevision: current.revision,
    modality: "text",
    text: "Can you explain the returns?",
    visibleRevision: current.revision,
    visibleProductIds: current.displayOrder,
  });
  // send() references the same identity object; retain the current revision.
  Object.assign(h.s, followup);
  const response = await h.send("yes");
  expect(response.status).toBe(409);
  const data = await response.json();
  expect(data.snapshot.receipt).toBeNull();
  expect(data.snapshot.summary.id).toBe(current.summary!.id);
});

it("server-only Live completion projects the existing receipt and deduplicates the delegated confirmation", async () => {
  const h = await review();
  expect(h.s.summary!.spokenText).not.toMatch(
    /\b(?:demo|simulated|synthetic|hypothetical|proxy|fictional)\b/i,
  );
  const input = {
    sessionId: h.s.id,
    epoch: h.s.epoch,
    expectedRevision: h.s.revision,
    summaryId: h.s.summary!.id,
    summaryRevision: h.s.summary!.revision,
    responseTurnId: h.s.summary!.responseTurnId,
    delegationId: "server-confirmation",
    transcript: "confirm",
  };
  const first = completeLiveDemoCheckout(input);
  expect(first.snapshot.view).toBe("receipt");
  expect(first.receipt.completionSource).toBe("live_demo");
  expect(first.snapshot.receipt!.id).toBe(first.receipt.id);
  const replay = completeLiveDemoCheckout({
    ...input,
    expectedRevision: first.snapshot.revision,
  });
  expect(replay.receipt.id).toBe(first.receipt.id);
  expect(replay.snapshot.revision).toBe(first.snapshot.revision);
});

it("client supplied trusted flags and Live completion actions cannot invoke the server-only path", async () => {
  const h = await review();
  const response = await h.send("confirm", {
    action: "completeLiveDemo",
    trusted: true,
    final: true,
    confidence: 1,
  });
  expect(response.status).toBe(409);
  expect(h.store.core.get(h.s.id)).toEqual(h.s);
});

it("blocks server-only completion of a previous review after a browser reference is imported", async () => {
  const h = await review();
  h.store.importDiscovery(
    h.s.id,
    {
      handoffId: "discovery-after-review",
      mode: "live",
      source: {
        title: "Bag inspiration",
        url: "https://www.youtube.com/watch?v=example",
      },
      candidate: {
        id: "bag-search",
        title: "A similar bag",
        url: "https://www.coupang.com/np/search?q=bag",
        price: null,
        match: "similar",
        linkKind: "search",
        reasons: ["Similar shape"],
        unknowns: ["Laptop fit"],
      },
    },
    { epoch: h.s.epoch, baseRevision: h.s.revision },
  );
  const completion = vi.spyOn(h.store.core, "completeLiveDemo");
  try {
    expect(() =>
      completeLiveDemoCheckout({
        sessionId: h.s.id,
        epoch: h.s.epoch,
        expectedRevision: h.s.revision,
        summaryId: h.s.summary!.id,
        summaryRevision: h.s.summary!.revision,
        responseTurnId: h.s.summary!.responseTurnId,
        delegationId: "old-order-confirmation",
        transcript: "Please buy it",
      }),
    ).toThrow("not a catalog order");
    expect(completion).not.toHaveBeenCalled();
    expect(h.store.core.get(h.s.id).receipt).toBeNull();
  } finally {
    completion.mockRestore();
  }
});

it("checks the authoritative receipt after a lost completion acknowledgement without resubmitting", async () => {
  const h = await review();
  const original = h.store.core.completeLiveDemo.bind(h.store.core);
  const completion = vi
    .spyOn(h.store.core, "completeLiveDemo")
    .mockImplementationOnce((id, input) => {
      original(id, input);
      throw new Error("Completion acknowledgement interrupted");
    });
  try {
    const result = completeLiveDemoCheckout({
      sessionId: h.s.id,
      epoch: h.s.epoch,
      expectedRevision: h.s.revision,
      summaryId: h.s.summary!.id,
      summaryRevision: h.s.summary!.revision,
      responseTurnId: h.s.summary!.responseTurnId,
      delegationId: "lost-acknowledgement",
      transcript: "Please buy it",
    });
    expect(result.snapshot.view).toBe("receipt");
    expect(result.receipt.id).toBe(h.store.core.get(h.s.id).receipt!.id);
    expect(completion).toHaveBeenCalledTimes(1);
    expect(
      h.store.core
        .get(h.s.id)
        .history.filter((entry) => entry.modality === "live_demo"),
    ).toHaveLength(1);
  } finally {
    completion.mockRestore();
  }
});

it("preserves an uncompleted review and surfaces the failure when status confirms no receipt", async () => {
  const h = await review();
  const completion = vi
    .spyOn(h.store.core, "completeLiveDemo")
    .mockImplementationOnce(() => {
      throw new Error("Checkout is temporarily unavailable");
    });
  try {
    expect(() =>
      completeLiveDemoCheckout({
        sessionId: h.s.id,
        epoch: h.s.epoch,
        expectedRevision: h.s.revision,
        summaryId: h.s.summary!.id,
        summaryRevision: h.s.summary!.revision,
        responseTurnId: h.s.summary!.responseTurnId,
        delegationId: "failed-completion",
        transcript: "Please buy it",
      }),
    ).toThrow("Checkout is temporarily unavailable");
    expect(h.store.core.get(h.s.id)).toEqual(h.s);
    expect(completion).toHaveBeenCalledTimes(1);
  } finally {
    completion.mockRestore();
  }
});

it("never treats a receipt from a different review as this request's success", async () => {
  const h = await review();
  const input = {
    sessionId: h.s.id,
    epoch: h.s.epoch,
    expectedRevision: h.s.revision,
    summaryId: h.s.summary!.id,
    summaryRevision: h.s.summary!.revision,
    responseTurnId: h.s.summary!.responseTurnId,
    delegationId: "first-order",
    transcript: "Please buy it",
  };
  const first = completeLiveDemoCheckout(input);
  expect(() =>
    completeLiveDemoCheckout({
      ...input,
      summaryId: "another-review",
      expectedRevision: first.snapshot.revision,
      delegationId: "another-order",
    }),
  ).toThrow();
  expect(h.store.core.get(h.s.id).receipt!.id).toBe(first.receipt.id);
});
