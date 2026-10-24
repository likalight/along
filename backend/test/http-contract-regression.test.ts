import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { test, type TestContext } from "node:test";
import { createApp } from "../src/server.ts";
import { IntegrationClient, type ShoppingSnapshot } from "../src/integration-client.ts";
import { BackendError, ConciergeClient } from "../src/client.ts";
import { getCatalog } from "../../catalog/src/index.ts";
import { sessionView } from "../src/integration.ts";

async function harness(t: TestContext) {
  const agentToken = randomUUID();
  const { server, store } = createApp({ agentToken });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const bridge = new IntegrationClient(base, { agentToken });
  const initial = await bridge.create("work-gym");
  const shopper = new IntegrationClient(base, { sessionId: bridge.sessionId, accessToken: bridge.accessToken });
  const post = async (action: string, body: unknown, trusted = false, legacyPath = false) => {
    const response = await fetch(`${base}/v1${legacyPath ? "" : "/integration"}/sessions/${initial.sessionId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bridge.accessToken}`,
        ...(trusted ? { "X-Agent-Token": agentToken } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  return { base, store, bridge, shopper, initial, post };
}

async function preparedVoice(h: Awaited<ReturnType<typeof harness>>) {
  let s = await h.bridge.input(h.initial, "voice", { text: "I want the work and gym bag tomorrow." });
  s = await h.bridge.action(s, "select_offer", { offerId: "BAG-001-B", quantity: 1 });
  return h.bridge.action(s, "prepare_summary", {});
}

function lifecycle(s: ShoppingSnapshot, type: string, playbackId: string) {
  return { sessionId: s.sessionId, epoch: s.epoch, eventId: randomUUID(), turnId: s.turn?.id,
    revision: s.revision, type, playbackId, summaryId: s.summary?.id, summaryRevision: s.summary?.revision };
}

test("HTTP default catalog preserves the complete shared USD fixtures and serves bounded illustrations", async (t) => {
  const h = await harness(t);
  const catalog = await h.shopper.catalog();
  const shared = getCatalog();
  assert.equal(catalog.products.length, 24);
  assert.equal(catalog.offers.length, 48);
  assert.equal(catalog.currency, "USD");
  assert.deepEqual(catalog.products, shared.products);
  assert.deepEqual(catalog.offers, shared.offers);
  assert.deepEqual(catalog.evidence, shared.evidence);
  assert.deepEqual(catalog.sellers, shared.sellers);
  assert.deepEqual([...new Set(catalog.products.map((p: any) => p.category))].sort(),
    ["audio-accessories", "bedsheet-sets", "everyday-bags"]);
  for (const path of new Set(shared.products.map(p => p.image.url))) {
    const response = await fetch(h.base + path);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type")!, /image\/svg\+xml/);
    assert.match(await response.text(), /DEMO ILLUSTRATION/);
  }
  assert.equal((await fetch(h.base + "/catalog/images/private.svg")).status, 404);
});

test("HTTP trust boundary rejects forged voice and playback; guarded lifecycle binds exact summary and receipt", async (t) => {
  const h = await harness(t);
  await assert.rejects(h.shopper.input(h.initial, "voice", { text: "Confirm this simulated purchase." }),
    (error: unknown) => error instanceof BackendError && error.code === "AGENT_UNAUTHORIZED");
  assert.equal((await h.shopper.snapshot()).revision, h.initial.revision);
  let s = await preparedVoice(h);
  s = await h.shopper.presentation(s.summary!, "displayed", s);
  const audio = randomUUID();
  const start = lifecycle(s, "audio.started", audio);
  assert.equal((await h.post("lifecycle", start)).status, 403);
  assert.equal((await h.post("presentation", {
    summaryId: s.summary!.id, turnId: s.turn!.id, textHash: s.summary!.textHash, event: "playback_completed",
  })).status, 403);
  assert.equal((await h.shopper.snapshot()).revision, s.revision);
  const started = await h.post("lifecycle", start, true);
  assert.equal(started.status, 200);
  s = started.body.session;
  const replay = await h.post("lifecycle", start, true);
  assert.equal(replay.body.session.revision, s.revision);
  const wrong = await h.post("lifecycle", lifecycle(s, "audio.completed", randomUUID()), true);
  assert.equal(wrong.body.error.code, "STALE_PLAYBACK");
  assert.equal(wrong.body.error.details.session.revision, s.revision);
  s = await h.bridge.lifecycle(s, "audio.completed", {
    playbackId: audio, summaryId: s.summary!.id, summaryRevision: s.summary!.revision,
  });
  assert.equal(s.approvalStatus, "awaiting_approval");
  const text = "Confirm this simulated purchase.";
  s = await h.bridge.input(s, "voice", { text });
  const observation = { transcript: text, final: true, confidence: 0.99, source: "shopper" as const, echoDetected: false };
  await assert.rejects(h.shopper.confirm(s, "voice", observation),
    (error: unknown) => error instanceof BackendError && error.code === "AGENT_UNAUTHORIZED");
  await assert.rejects(h.bridge.confirm(s, "voice", { ...observation, transcript: "Confirm purchase." }),
    (error: unknown) => error instanceof BackendError && error.code === "UNTRUSTED_APPROVAL");
  const eventId = randomUUID();
  const [first, retry] = await Promise.all([
    h.bridge.confirm(s, "voice", observation, eventId), h.bridge.confirm(s, "voice", observation, eventId),
  ]);
  assert.equal(first.receipt.id, retry.receipt.id);
  assert.equal(first.receipt.simulated, true);
  assert.equal(first.receipt.acceptedOrder.totalMinor, 11900);
  assert.equal(first.receipt.acceptedOrder.product.id, "BAG-001");
  assert.equal(first.receipt.acceptedOrder.offer.id, "BAG-001-B");
  const stored = h.store.get(s.sessionId);
  stored.summary!.quote.total = 1;
  assert.equal(sessionView(stored).receipt!.acceptedOrder.totalMinor, 11900,
    "Receipt projection must use its immutable accepted quote, not a live summary.");
});

test("HTTP input interruption and epoch changes reject callbacks without altering accepted state", async (t) => {
  const h = await harness(t);
  let s = await preparedVoice(h);
  s = await h.shopper.presentation(s.summary!, "displayed", s);
  const audio = randomUUID();
  s = await h.bridge.lifecycle(s, "audio.started", { playbackId: audio, summaryId: s.summary!.id, summaryRevision: s.summary!.revision });
  const delayed = lifecycle(s, "audio.completed", audio);
  s = await h.shopper.input(s, "text", { text: "Stop, I need a cheaper option." });
  const rejected = await h.post("lifecycle", delayed, true);
  assert.notEqual(rejected.status, 200);
  assert.equal(rejected.body.error.details.session.revision, s.revision);
  assert.equal(s.summary, null);
  assert.equal(s.mediaOwner, null);
  s = await h.shopper.reset(s);
  assert.equal((await h.post("lifecycle", { ...delayed, revision: s.revision }, true)).body.error.code, "STALE_EPOCH");
  assert.equal((await h.shopper.snapshot()).revision, s.revision);
});

test("canonical HTTP cancellation cannot affect a reused provider turn ID after reset", async (t) => {
  const h = await harness(t);
  const input = (s: ShoppingSnapshot) => ({
    sessionId: s.sessionId, epoch: s.epoch, eventId: randomUUID(), turnId: "providerturn-1",
    baseRevision: s.revision, modality: "text", text: "Show bags.",
    visibleRevision: s.revision, visibleProductIds: s.displayOrder,
  });
  let s = (await h.post("inputs", input(h.initial))).body.session as ShoppingSnapshot;
  const oldCancel = { epoch: s.epoch, eventId: randomUUID(), expectedRevision: s.revision, turnId: s.turn!.id };
  s = await h.shopper.reset(s);
  s = (await h.post("inputs", input(s))).body.session;
  assert.equal(s.turn!.id, oldCancel.turnId);
  for (const legacy of [false, true]) {
    const stale = await h.post("cancel", oldCancel, false, legacy);
    assert.equal(stale.body.error.code, "STALE_EPOCH");
    assert.equal((await h.shopper.snapshot()).revision, s.revision);
    assert.equal((await h.shopper.snapshot()).turn!.status, "active");
    assert.equal((await h.post("cancel", { turnId: s.turn!.id }, false, legacy)).body.error.code,
      "INVALID_CANCELLATION_ENVELOPE");
  }
  s = await h.shopper.cancel(s);
  assert.equal(s.turn!.status, "cancelled");
});

test("canonical HTTP presentation requires complete identity guards on both route surfaces", async (t) => {
  const h = await harness(t);
  const s = await preparedVoice(h);
  const guarded: Record<string, unknown> = {
    summaryId: s.summary!.id, turnId: s.turn!.id, textHash: s.summary!.textHash, event: "displayed",
    epoch: s.epoch, eventId: randomUUID(), expectedRevision: s.revision, summaryRevision: s.summary!.revision,
  };
  for (const legacy of [false, true]) {
    for (const field of ["epoch", "eventId", "expectedRevision", "summaryRevision"]) {
      const incomplete = { ...guarded };
      delete incomplete[field];
      const result = await h.post("presentation", incomplete, false, legacy);
      assert.equal(result.body.error.code, "INVALID_PRESENTATION_ENVELOPE");
      assert.equal((await h.shopper.snapshot()).revision, s.revision);
    }
  }
  const shown = await h.shopper.presentation(s.summary!, "displayed", s);
  assert.equal(shown.summary!.displayed, true);
});

test("canonical HTTP cannot bypass guarded confirmation through input-less legacy turns and approval", async (t) => {
  const h = await harness(t);
  let s = await preparedVoice(h);
  s = await h.shopper.presentation(s.summary!, "displayed", s);
  const playbackId = randomUUID();
  s = await h.bridge.lifecycle(s, "audio.started", { playbackId, summaryId: s.summary!.id, summaryRevision: s.summary!.revision });
  s = await h.bridge.lifecycle(s, "audio.completed", { playbackId, summaryId: s.summary!.id, summaryRevision: s.summary!.revision });
  s = (await h.post("turns", { expectedRevision: s.revision })).body.session;
  assert.equal(s.turn!.input, undefined);
  const observation = {
    transcript: "Confirm this simulated purchase.", final: true, confidence: 0.99,
    source: "shopper" as const, echoDetected: false,
  };
  for (const legacy of [false, true]) {
    const rejected = await h.post("approval", {
      ...observation, expectedRevision: s.revision, turnId: s.turn!.id,
      summaryId: s.summary!.id, approvalNonce: s.turn!.approvalWindow?.nonce,
    }, true, legacy);
    assert.equal(rejected.body.error.code, "LEGACY_APPROVAL_DISABLED");
    assert.equal((await h.shopper.snapshot()).receipt, null);
    assert.equal((await h.shopper.snapshot()).revision, s.revision);
  }
  await assert.rejects(h.bridge.confirm(s, "voice", observation),
    (error: unknown) => error instanceof BackendError && error.code === "UNTRUSTED_APPROVAL");
  s = await h.bridge.input(s, "voice", { text: observation.transcript });
  const accepted = await h.bridge.confirm(s, "voice", observation);
  assert.equal(accepted.receipt.simulated, true);
  assert.equal(accepted.receipt.acceptedOrder.totalMinor, 11900);
});

test("HTTP action shortcuts validate evidence before any save, restore, summary or cancellation", async (t) => {
  const h = await harness(t);
  const s = await h.shopper.input(h.initial, "text", { text: "Show work and gym bags." });
  const cases: [string, Record<string, unknown>][] = [
    ["save", { productIds: ["BAG-001"], rationale: "Laptop and shoes" }],
    ["restore", { savedId: "unknown" }], ["prepare_summary", {}], ["defer", {}], ["cancel", {}],
  ];
  for (const [action, payload] of cases) {
    const response = await h.post("actions", {
      sessionId: s.sessionId, epoch: s.epoch, eventId: randomUUID(), turnId: s.turn!.id,
      baseRevision: s.revision, action, payload, evidenceIds: ["fabricated-evidence"],
    }, true);
    assert.equal(response.body.error.code, "UNKNOWN_EVIDENCE");
    assert.deepEqual(response.body.error.details.session, s);
  }
});

test("HTTP assets are session scoped, failures preserve state, and end closes streams and erases assets", async (t) => {
  const h = await harness(t);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==", "base64");
  const uploaded = await h.shopper.upload(h.initial, new Blob([png], { type: "image/png" }));
  const s = uploaded.session;
  assert.equal((await h.shopper.attachment(uploaded.attachment.id)).size, png.length);
  const stranger = new IntegrationClient(h.base);
  await stranger.create();
  await assert.rejects(stranger.attachment(uploaded.attachment.id), (error: unknown) => error instanceof BackendError && error.status === 404);
  await assert.rejects(h.shopper.upload(s, new Blob(["<svg></svg>"], { type: "image/svg+xml" })));
  await assert.rejects(h.shopper.input(s, "link", { url: h.base + "/health" }),
    (error: unknown) => error instanceof BackendError && error.code === "UNSUPPORTED_LINK");
  assert.equal((await h.shopper.snapshot()).revision, s.revision);
  const stream = h.shopper.events();
  const latest = await stream.next();
  assert.equal(latest.value?.type, "session.updated");
  if (latest.value?.type === "session.updated") assert.equal(latest.value.snapshot.revision, s.revision);
  assert.equal(h.store.events.listenerCount(s.sessionId), 1);
  assert.equal((await h.post("end", { expectedRevision: s.revision })).status, 200);
  assert.equal((await stream.next()).value?.type, "session.ended");
  assert.equal((await stream.next()).done, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.store.events.listenerCount(s.sessionId), 0);
  await assert.rejects(h.shopper.attachment(uploaded.attachment.id), (error: unknown) => error instanceof BackendError && error.status === 404);
  await assert.rejects(h.shopper.snapshot());
});

test("browser clients refuse an embedded trusted bridge credential", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  try {
    assert.throws(() => new IntegrationClient("http://localhost", { agentToken: "secret" }), /server-only/);
    assert.throws(() => new ConciergeClient("http://localhost", { agentToken: "secret" }), /server-only/);
    assert.doesNotThrow(() => new IntegrationClient("http://localhost"));
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
