/** Real HTTP rehearsal: can run against your running backend or a disposable local instance. */
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { createApp } from "../src/server.ts";
import { ConciergeClient } from "../src/client.ts";
const agentToken =
  process.env.AGENT_API_TOKEN ?? randomBytes(32).toString("hex");
let server: ReturnType<typeof createApp>["server"] | undefined;
let base = process.env.BACKEND_URL;
if (!base) {
  server = createApp({ agentToken }).server;
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
try {
  const c = new ConciergeClient(base, { agentToken });
  let s = await c.create("cafe-dictation");
  console.log("1. Created cafe-dictation session", s.id);
  const offers = await c.search({
    ...s.constraints,
    budgetMinor: 15000,
    deliveryWithinDays: 1,
    compatibility: { hostConnection: "usb-a" },
  });
  for (const q of [...offers.eligible, ...offers.ineligible].filter(
    (q: any) => q.product.id === "MIC-020",
  ))
    console.log(
      "2. Seller comparison",
      q.offer.sellerName,
      q.total,
      q.eligible ? "eligible" : q.conflicts.map((x: any) => x.code).join(","),
    );
  s = await c.turn(s.revision);
  s = (
    await c.propose({
      expectedRevision: s.revision,
      turnId: s.turn!.id,
      needs: ["Microphone for cafe dictation"],
      constraints: {
        category: "audio-accessories",
        currency: "USD",
        budgetMinor: 15000,
        deliveryWithinDays: 1,
        compatibility: { hostConnection: "usb-a" },
      },
      shortlist: ["MIC-020"],
      selection: { offerId: "MIC-020-B", quantity: 1 },
    })
  ).session;
  s = await c.summarize(s.revision, s.turn!.id);
  console.log("3. Exact summary to speak AND display:", s.summary!.spokenText);
  for (const event of [
    "displayed",
    "playback_started",
    "playback_completed",
  ] as const)
    s = await c.presentation(s.summary!, event);
  console.log(
    "4. Rehearsal emulated frontend playback callbacks (no real audio in this CLI).",
  );
  s = await c.turn(s.revision);
  const observation = {
    expectedRevision: s.revision,
    turnId: s.turn!.id,
    summaryId: s.summary!.id,
    approvalNonce: s.turn!.approvalWindow!.nonce,
    transcript: "Confirm this simulated purchase.",
    final: true,
    confidence: 0.99,
    source: "shopper" as const,
    echoDetected: false,
  };
  const first = await c.approve(observation),
    duplicate = await c.approve(observation);
  console.log(
    "5. SIMULATED receipt",
    first.receipt.id,
    "total",
    first.receipt.quote.total,
    "cents",
  );
  console.log(
    "6. Retry returned same receipt:",
    first.receipt.id === duplicate.receipt.id,
  );
} finally {
  server?.closeAllConnections();
  server?.close();
}
