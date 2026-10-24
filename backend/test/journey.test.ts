import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createApp } from "../src/server.ts";
import { ConciergeClient, BackendError } from "../src/client.ts";
import { SessionStore } from "../src/store.ts";
import type { Session, VoiceObservation } from "../src/contracts.ts";

async function harness(t: any) {
  const agentToken = randomBytes(32).toString("hex");
  const { server, store } = createApp({ agentToken });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}`;
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { url, store, client: new ConciergeClient(url, { agentToken }) };
}
async function summary(c: ConciergeClient) {
  let s = await c.create("urgent-bag");
  s = await c.turn(s.revision);
  s = (
    await c.propose({
      turnId: s.turn!.id,
      expectedRevision: s.revision,
      shortlist: ["commuter-tote"],
      selection: { offerId: "commuter-tote-express", quantity: 1 },
    })
  ).session;
  s = await c.summarize(s.revision, s.turn!.id);
  return s;
}
async function ready(c: ConciergeClient) {
  let s = await summary(c);
  s = await c.presentation(s.summary!, "displayed");
  s = await c.presentation(s.summary!, "playback_started");
  s = await c.presentation(s.summary!, "playback_completed");
  return c.turn(s.revision);
}
function approval(s: Session): VoiceObservation {
  return {
    expectedRevision: s.revision,
    turnId: s.turn!.id,
    summaryId: s.summary!.id,
    approvalNonce: s.turn!.approvalWindow!.nonce,
    transcript: "Confirm this simulated purchase.",
    final: true,
    confidence: 0.99,
    source: "shopper",
    echoDetected: false,
  };
}
const rejects = (p: Promise<unknown>, code: string) =>
  assert.rejects(p, (e: any) => e instanceof BackendError && e.code === code);

test("HTTP journey: late offer rejected; exact summary; concurrent confirmation creates one receipt", async (t) => {
  const { client: c } = await harness(t);
  const results = await c.search({
    category: "bags",
    deliveryWithinDays: 1,
    budgetMinor: 10000,
  });
  assert(
    results.ineligible.some(
      (q: any) =>
        q.offer.id === "commuter-tote-value" &&
        q.conflicts.some((x: any) => x.code === "DELIVERY_CONFLICT"),
    ),
  );
  let s = await ready(c);
  assert.equal(s.summary!.quote.total, 8900);
  assert.match(s.summary!.spokenText, /shipping SGD 5.00/);
  const observations = approval(s);
  const [a, b] = await Promise.all([
    c.approve(observations),
    c.approve(observations),
  ]);
  assert.equal(a.receipt.id, b.receipt.id);
  assert.equal(a.receipt.simulated, true);
  assert.match(a.receipt.label, /no payment/);
});
test("HTTP constraints: budget change clears selection and approval; no silent relaxation", async (t) => {
  const { client: c } = await harness(t);
  let s = await ready(c);
  const stale = approval(s);
  s = (
    await c.propose({
      expectedRevision: s.revision,
      turnId: s.turn!.id,
      constraints: {
        category: "bags",
        budgetMinor: 7500,
        deliveryWithinDays: 1,
      },
    })
  ).session;
  assert.equal(s.selection, null);
  assert.equal(s.summary, null);
  assert.equal(s.constraints.budgetMinor, 7500);
  await rejects(c.approve(stale), "STALE_REVISION");
  const results = await c.search(s.constraints);
  assert(!results.eligible.some((x: any) => x.product.id === "commuter-tote"));
});
test("HTTP cancelled, superseded and reset turns cannot commit delayed actions", async (t) => {
  const { client: c } = await harness(t);
  let s = await c.create();
  s = await c.turn(s.revision);
  const old = s.turn!.id;
  s = await c.cancel(old);
  await rejects(
    c.propose({
      expectedRevision: s.revision,
      turnId: old,
      needs: ["delayed"],
    }),
    "STALE_TURN",
  );
  s = await c.turn(s.revision);
  const second = s.turn!.id;
  s = await c.turn(s.revision);
  await rejects(
    c.propose({ expectedRevision: s.revision, turnId: second, needs: ["old"] }),
    "STALE_TURN",
  );
  const third = s.turn!.id;
  s = await c.reset(s.revision);
  assert.equal(s.epoch, 1);
  await rejects(
    c.propose({
      expectedRevision: s.revision,
      turnId: third,
      needs: ["pre reset"],
    }),
    "STALE_TURN",
  );
  assert.deepEqual((await c.snapshot()).needs, []);
});
test("HTTP approval matrix rejects uncertain, ambiguous, background, echo and stale speech", async (t) => {
  const { client: c } = await harness(t);
  const s = await ready(c);
  const ok = approval(s);
  for (const change of [
    { transcript: "looks good" },
    { transcript: "yes" },
    { confidence: 0.6 },
    { confidence: null },
    { final: false },
    { source: "assistant" },
    { source: "background" },
    { echoDetected: true },
    { approvalNonce: "wrong" },
  ]) {
    await assert.rejects(c.approve({ ...ok, ...change } as VoiceObservation));
    assert.equal((await c.snapshot()).receipt, null);
  }
  assert.equal((await c.snapshot()).revision, s.revision);
});
test("HTTP interrupted or incomplete summary never opens an approval window", async (t) => {
  const { client: c } = await harness(t);
  let s = await summary(c);
  await rejects(
    c.presentation(s.summary!, "playback_completed"),
    "INVALID_PLAYBACK",
  );
  s = await c.presentation(s.summary!, "displayed");
  s = await c.presentation(s.summary!, "playback_started");
  s = await c.presentation(s.summary!, "playback_interrupted");
  assert.equal(s.summary!.approvalNonce, null);
  await rejects(
    c.presentation(s.summary!, "playback_completed"),
    "INVALID_PLAYBACK",
  );
  s = await c.turn(s.revision);
  assert.equal(s.summary, null);
  assert.equal(s.turn!.approvalWindow, null);
});
test("HTTP unknown fees/IDs and malformed proposals preserve last accepted state", async (t) => {
  const { client: c } = await harness(t);
  let s = await c.create();
  s = await c.turn(s.revision);
  const b = { expectedRevision: s.revision, turnId: s.turn!.id };
  await rejects(
    c.propose({
      ...b,
      selection: { offerId: "microfiber-set-value", quantity: 1 },
    }),
    "SELECTION_CONFLICT",
  );
  await rejects(
    c.propose({ ...b, shortlist: ["invented-id"] }),
    "UNKNOWN_PRODUCT",
  );
  await rejects(
    c.propose({
      ...b,
      selection: { offerId: "commuter-tote-express", quantity: 1.5 },
    }),
    "INVALID_SELECTION",
  );
  assert.deepEqual(await c.snapshot(), s);
  const q = await c.search({ category: "bags" }, 2);
  assert.equal(
    q.eligible.find((x: any) => x.offer.id === "commuter-tote-value").total,
    14300,
  );
});
test("HTTP auth boundary: browser token cannot propose or approve; wrong session cannot read", async (t) => {
  const { client: c, url } = await harness(t);
  await c.create();
  const browser = new ConciergeClient(url, {
    sessionId: c.sessionId,
    accessToken: c.accessToken,
  });
  let s = await browser.snapshot();
  s = await browser.turn(s.revision);
  await rejects(
    browser.propose({
      expectedRevision: s.revision,
      turnId: s.turn!.id,
      needs: ["inject"],
    }),
    "AGENT_UNAUTHORIZED",
  );
  const intruder = new ConciergeClient(url, {
    sessionId: c.sessionId,
    accessToken: "incorrect",
  });
  await rejects(intruder.snapshot(), "UNAUTHORIZED");
  const cors = await fetch(url + "/health", {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(cors.status, 403);
});
test("HTTP reconnect stream sends authoritative snapshot and subsequent updates", async (t) => {
  const { client: c } = await harness(t);
  const s = await c.create();
  const controller = new AbortController();
  const stream = c.events(controller.signal);
  const first = await stream.next();
  assert.equal((first.value as any).session.revision, 0);
  await c.turn(s.revision);
  const second = await stream.next();
  assert.equal((second.value as any).session.revision, 1);
  await stream.return(undefined);
  controller.abort();
});
test("expired sessions release data and cannot be resurrected", async () => {
  const store = new SessionStore(-1);
  const { session } = store.create();
  assert.throws(() => store.get(session.id), /expired/i);
});

test("AI adapter uses accepted constraints and cannot expose approval capabilities or continue cancelled work", async (t) => {
  const { createShoppingTools, modelSessionView } = await import(
    "../src/agent-tools.ts"
  );
  const { client: c } = await harness(t);
  let s = await c.create("urgent-bag");
  s = await c.turn(s.revision);
  const tools = createShoppingTools(c, s);
  const result: any = await tools.execute("search_current_offers", {});
  assert(
    !result.eligible.some((q: any) => q.offer.id === "commuter-tote-value"),
  );
  await tools.execute("propose_shopping_state", {
    selection: { offerId: "commuter-tote-express", quantity: 1 },
  });
  const prepared: any = await tools.execute("prepare_purchase_summary", {});
  assert(!("approvalNonce" in prepared.session.summary));
  assert(!("approvalWindow" in prepared.session.turn));
  await assert.rejects(
    tools.execute("approve_purchase", {}),
    (e: any) => e.code === "UNKNOWN_TOOL",
  );
  await c.cancel(s.turn!.id);
  await assert.rejects(
    tools.execute("search_current_offers", {}),
    (e: any) => e.code === "STALE_TURN",
  );
  const readyState = await ready(c);
  const view = modelSessionView(readyState);
  assert(!JSON.stringify(view).includes(readyState.summary!.approvalNonce!));
});
