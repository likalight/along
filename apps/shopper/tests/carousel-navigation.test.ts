import { expect, it } from "vitest";
import { POST } from "@/app/api/session/route";

it("HTTP carousel commands preserve product positions and reject stale navigation", async () => {
  let cookie = "";
  async function request(body: unknown) {
    const response = await POST(
      new Request("http://localhost/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify(body),
      }),
    );
    const nextCookie = response.headers.get("set-cookie");
    if (nextCookie) cookie = nextCookie.split(";")[0]!;
    return { response, data: await response.json() };
  }
  let snapshot = (await request({ action: "connect" })).data;
  const send = async (text: string, baseRevision = snapshot.revision) => {
    const result = await request({
      action: "input",
      input: {
        sessionId: snapshot.sessionId,
        epoch: snapshot.epoch,
        turnId: crypto.randomUUID(),
        eventId: crypto.randomUUID(),
        baseRevision,
        modality: "text",
        text,
        visibleRevision: snapshot.revision,
        visibleProductIds: snapshot.displayOrder,
      },
    });
    if (result.response.status === 200) snapshot = result.data.snapshot;
    return result;
  };
  expect(
    (await send("I need a work and gym bag under 150 dollars")).response.status,
  ).toBe(200);
  const order = [...snapshot.displayOrder];
  expect(order.length).toBeGreaterThan(1);
  expect((await send("Show me the second one")).response.status).toBe(200);
  expect(snapshot.focusedProductId).toBe(order[1]);
  const oldRevision = snapshot.revision;
  await send("Go back");
  expect(snapshot.focusedProductId).toBe(order[0]);
  await send("Previous");
  expect(snapshot.focusedProductId).toBe(order.at(-1));
  await send("Next");
  expect(snapshot.focusedProductId).toBe(order[0]);
  expect(snapshot.displayOrder).toEqual(order);
  expect(snapshot.receipt).toBeFalsy();
  expect((await send("Next", oldRevision)).response.status).not.toBe(200);
});
