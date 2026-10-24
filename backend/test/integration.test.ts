import { IntegrationClient } from "../src/integration-client.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/server.ts";
import { teamProfile } from "../src/team-catalog.ts";
import { quoteOffer } from "../src/catalog.ts";
async function harness(t: any) {
  const agentToken = randomUUID(),
    { server } = createApp({ agentToken });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const base = `http://127.0.0.1:${(server.address() as any).port}/v1/integration`;
  let token = "",
    id = "";
  const req = async (path: string, body?: unknown) => {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Agent-Token": agentToken,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, body: await r.json() };
  };
  const created = await req("/sessions", { scenarioId: "work-gym-bag" });
  token = created.body.accessToken;
  id = created.body.session.sessionId;
  return {
    base,
    token,
    id,
    req,
    initial: created.body.session,
    post: (action: string, body: unknown) =>
      req(`/sessions/${id}/${action}`, body),
    get: () => req(`/sessions/${id}`),
  };
}
const input = (s: any, text: string, modality = "text") => ({
  sessionId: s.sessionId,
  epoch: s.epoch,
  eventId: randomUUID(),
  turnId: randomUUID(),
  baseRevision: s.revision,
  modality,
  text,
  visibleRevision: s.revision,
  visibleProductIds: s.displayOrder,
});
const action = (s: any, name: string, payload: unknown) => ({
  sessionId: s.sessionId,
  epoch: s.epoch,
  eventId: randomUUID(),
  turnId: s.turn.id,
  baseRevision: s.revision,
  action: name,
  payload,
  evidenceIds: [],
});
const approval = (s: any) => ({
  sessionId: s.sessionId,
  epoch: s.epoch,
  eventId: randomUUID(),
  turnId: s.turn.id,
  baseRevision: s.revision,
  summaryId: s.summary.id,
  summaryRevision: s.summary.revision,
  modality: "text",
  explicitIntent: "confirm_simulated_purchase",
});
async function textSummary(h: any) {
  let s = (
    await h.post(
      "inputs",
      input(h.initial, "I want the work and gym bag tomorrow."),
    )
  ).body.session;
  s = (
    await h.post(
      "actions",
      action(s, "set_constraints", {
        constraints: {
          category: "bags",
          currency: "USD",
          budgetMinor: 15000,
          deliveryWithinDays: 1,
          compatibility: { laptopInches: 14 },
        },
      }),
    )
  ).body.session;
  s = (
    await h.post(
      "actions",
      action(s, "select_offer", { offerId: "BAG-001-B", quantity: 1 }),
    )
  ).body.session;
  s = (await h.post("actions", action(s, "prepare_summary", {}))).body.session;
  assert.equal(s.summary.totalMinor, 11900);
  assert.equal(s.summary.presentationMode, "text");
  s = (
    await h.post("presentation", {
      summaryId: s.summary.id,
      turnId: s.summary.responseTurnId,
      textHash: s.summary.textHash,
      event: "displayed",
    })
  ).body.session;
  return s;
}
test("contract #2: three category constraints reject unavailable, missing hardware, wrong depth and deadline", () => {
  assert.equal(teamProfile.catalog.products.length, 24);
  const q = (id: string, c: any = {}) =>
    quoteOffer(id, 1, c, [], teamProfile.catalog, teamProfile.destination);
  assert(
    q("MIC-025-economy", {
      compatibility: { hostConnection: "USB-C" },
    }).conflicts.some((x) => x.code === "UNAVAILABLE"),
  );
  assert(
    q("MIC-038-express", {
      compatibility: { hostConnection: "USB-C" },
    }).conflicts.some((x) => x.code === "UNAVAILABLE"),
  );
  assert(
    q("MIC-047-economy", {
      compatibility: { hostConnection: "USB-C" },
    }).conflicts.some((x) => x.code === "SETUP_UNKNOWN"),
  );
  assert(q("MIC-020-economy").conflicts.some((x) => x.code === "HOST_UNKNOWN"));
  assert(
    q("MIC-020-economy", { compatibility: { hostConnection: "USB-C" } })
      .eligible,
  );
  const bed = {
    category: "bedding",
    budgetMinor: 7000,
    compatibility: {
      bedWidthInches: 60,
      bedLengthInches: 80,
      mattressDepthInches: 12,
    },
  };
  assert(!q("BED-001-A", bed).eligible);
  assert(q("BED-003-A", bed).eligible);
  assert(q("BED-002-A", bed).eligible);
  assert(
    !q("BED-003-A", {
      ...bed,
      requiredSpecifications: { cotton100Percent: true },
    }).eligible,
  );
  assert(!q("BAG-001-A", { deliveryWithinDays: 1 }).eligible);
  assert(
    q("BAG-001-B", { deliveryWithinDays: 1, budgetMinor: 12000 }).eligible,
  );
  assert(!q("BAG-004-B", { compatibility: { laptopInches: 14 } }).eligible);
});
test("contract #2: typed display + fresh exact confirmation creates one receipt; input/action retries do not duplicate mutations", async (t) => {
  const h = await harness(t);
  let s = h.initial;
  const publicClient = new IntegrationClient(
    h.base.replace("/v1/integration", ""),
    { sessionId: h.id, accessToken: h.token },
  );
  const stream = publicClient.events();
  const first = await stream.next();
  assert.equal(first.value?.type, "session.updated");
  if (first.value?.type === "session.updated")
    assert.equal(first.value.snapshot.sessionId, h.id);
  await stream.return(undefined);
  assert.equal((await publicClient.catalog()).products.length, 24);
  const i = input(s, "Show bags");
  const a = await h.post("inputs", i),
    b = await h.post("inputs", i);
  assert.equal(a.body.session.revision, b.body.session.revision);
  s = a.body.session;
  const save = action(s, "save", {
    productIds: ["BAG-001"],
    rationale: "Separate shoes and laptop",
  });
  const saved = await h.post("actions", save);
  assert.equal(saved.body.session.savedItems.length, 1);
  assert.equal(
    (await h.post("actions", save)).body.session.savedItems.length,
    1,
  );
  const changed = await h.post("inputs", { ...i, text: "Something else" });
  assert.equal(changed.body.error.code, "EVENT_CONFLICT");
  const reset = await h.post("reset", {
    expectedRevision: saved.body.session.revision,
  });
  h.initial = reset.body.session;
  s = await textSummary(h);
  assert.equal(s.approvalStatus, "awaiting_approval");
  // A generated explicitIntent with an unrelated shopper text cannot authorize anything.
  s = (await h.post("inputs", input(s, "Looks good"))).body.session;
  assert.equal(
    (await h.post("confirm", approval(s))).body.error.code,
    "AMBIGUOUS_APPROVAL",
  );
  s = (await h.post("inputs", input(s, "Confirm this simulated purchase.")))
    .body.session;
  const confirm = approval(s),
    [r1, r2] = await Promise.all([
      h.post("confirm", confirm),
      h.post("confirm", confirm),
    ]);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.receipt.id, r2.body.receipt.id);
  assert.equal(r1.body.receipt.acceptedOrder.totalMinor, 11900);
  assert.equal(r1.body.receipt.acceptedOrder.destination, "DEMO-DESTINATION");
  assert.equal(r1.body.session.view, "receipt");
});
test("contract #2: stale display, stop race, mode switch and reset cannot revive approval or session images", async (t) => {
  const h = await harness(t);
  let s = await textSummary(h);
  assert.equal(
    (
      await h.post("inputs", {
        ...input(s, "second one"),
        visibleRevision: s.revision - 1,
      })
    ).body.error.code,
    "STALE_DISPLAY",
  );
  s = (await h.post("inputs", input(s, "Confirm this simulated purchase.")))
    .body.session;
  const pending = approval(s);
  s = (await h.post("cancel", { turnId: s.turn.id })).body.session;
  assert.notEqual((await h.post("confirm", pending)).status, 200);
  s = (await h.post("mode", { expectedRevision: s.revision, mode: "voice" }))
    .body.session;
  assert.equal(s.summary, null);
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  const uploaded = await fetch(`${h.base}/sessions/${h.id}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${h.token}`,
      "Content-Type": "image/png",
      "X-Session-Revision": String(s.revision),
    },
    body: bytes,
  });
  assert.equal(uploaded.status, 201);
  const result = await uploaded.json();
  s = result.session;
  const imageUrl = `${h.base}/sessions/${h.id}/attachments/${result.attachment.id}`;
  assert.equal(
    (await fetch(imageUrl, { headers: { Authorization: `Bearer ${h.token}` } }))
      .status,
    200,
  );
  const bad = await fetch(`${h.base}/sessions/${h.id}/attachments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${h.token}`,
      "Content-Type": "image/svg+xml",
      "X-Session-Revision": String(s.revision),
    },
    body: "<svg>not allowed</svg>",
  });
  assert.equal(bad.status, 422);
  assert.equal((await h.get()).body.session.revision, s.revision);
  const unsupported = await h.post("inputs", {
    ...input(s, "see link", "link"),
    url: "http://127.0.0.1/private",
  });
  assert.equal(unsupported.body.error.code, "UNSUPPORTED_LINK");
  const reset = await h.post("reset", { expectedRevision: s.revision });
  assert.deepEqual(reset.body.session.attachmentIds, []);
  assert.equal(
    (await fetch(imageUrl, { headers: { Authorization: `Bearer ${h.token}` } }))
      .status,
    404,
  );
  assert.equal(
    (await h.post("confirm", pending)).body.error.code,
    "STALE_EPOCH",
  );
});
