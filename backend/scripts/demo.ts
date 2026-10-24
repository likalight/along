/** Deterministic HTTP rehearsal. Presentation callbacks are emulated, never claimed as live voice proof. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createApp } from "../src/server.ts";
import { IntegrationClient, type ShoppingSnapshot } from "../src/integration-client.ts";

const agentToken = process.env.AGENT_API_TOKEN ?? randomBytes(32).toString("hex");
let server: ReturnType<typeof createApp>["server"] | undefined;
let base = process.env.BACKEND_URL;
if (!base) {
  server = createApp({ agentToken }).server;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
try {
  for (const scenario of [
    { id: "cafe-dictation", offerId: "MIC-044-B", total: 14800, modality: "voice" as const },
    { id: "work-gym", offerId: "BAG-001-B", total: 11900, modality: "text" as const },
    { id: "warm-room", offerId: "BED-003-B", total: 6399, modality: "text" as const },
  ]) {
    const client: IntegrationClient = new IntegrationClient(base, { agentToken });
    let session: ShoppingSnapshot = await client.create(scenario.id);
    session = await client.input(session, scenario.modality, { text: "I need it tomorrow." });
    session = await client.action(session, "set_constraints", { constraints: { deliveryWithinDays: 1 } });
    const offers = await client.request("/catalog/search", { constraints: session.hardConstraints });
    assert(offers.eligible.some((q: any) => q.offer.id === scenario.offerId));
    assert(offers.ineligible.some((q: any) => q.offer.id === scenario.offerId.replace(/B$/, "A") &&
      q.conflicts.some((x: any) => x.code === "DELIVERY_CONFLICT")));
    session = await client.action(session, "select_offer", { offerId: scenario.offerId, quantity: 1 });
    session = await client.action(session, "prepare_summary", {});
    assert.equal(session.summary!.totalMinor, scenario.total);
    session = await client.presentation(session.summary!, "displayed");
    if (scenario.modality === "voice") {
      session = await client.presentation(session.summary!, "playback_started");
      session = await client.presentation(session.summary!, "playback_completed");
    }
    const transcript = "Confirm this simulated purchase.";
    session = await client.input(session, scenario.modality, { text: transcript });
    const evidence = scenario.modality === "voice"
      ? { transcript, final: true, confidence: 0.99, source: "shopper" as const, echoDetected: false }
      : undefined;
    const eventId = crypto.randomUUID();
    const first = await client.confirm(session, scenario.modality, evidence, eventId);
    const duplicate = await client.confirm(session, scenario.modality, evidence, eventId);
    assert.equal(first.receipt.id, duplicate.receipt.id);
    assert.equal(first.receipt.simulated, true);
    assert.equal(first.receipt.acceptedOrder.totalMinor, scenario.total);
    console.log(`${scenario.id}: ${scenario.modality} path; USD ${(scenario.total / 100).toFixed(2)}; duplicate confirmation returned one simulated receipt.`);
  }
  console.log("All three HTTP journeys passed. Display/playback callbacks were emulated; live speech and frontend rehearsal remain separate.");
} finally {
  server?.closeAllConnections();
  server?.close();
}
