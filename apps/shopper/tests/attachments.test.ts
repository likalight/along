import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/attachments/route";
import { getRuntime } from "@/lib/integration/runtime";
const connect = () => getRuntime().orch.createSession();
const cookie = (id: string) =>
  `along-session-${id}=${getRuntime().store.accessToken(id)}`;
const json = (body: { sessionId: string; [key: string]: unknown }) =>
  new Request("http://localhost/api/attachments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie(body.sessionId),
    },
    body: JSON.stringify(body),
  });
describe("attachment boundary", () => {
  it("maps only exact supported fixture links, including rejecting prototype keys", async () => {
    const { sessionId } = connect();
    for (const url of [
      "https://unsupported.example",
      "__proto__",
      "constructor",
    ])
      expect((await POST(json({ sessionId, kind: "link", url }))).status).toBe(
        400,
      );
    const response = await POST(
      json({
        sessionId,
        kind: "link",
        url: "https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: "link",
      classification: "proxy",
      status: "ready",
    });
  });
  it("rejects invalid signatures and oversized photos while accepting a prepared image", async () => {
    const { sessionId } = connect();
    const form = new FormData();
    form.set("sessionId", sessionId);
    form.set(
      "file",
      new File(["not a real photo"], "fake.png", { type: "image/png" }),
    );
    const invalid = await POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        body: form,
        headers: { Cookie: cookie(sessionId) },
      }),
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toContain("structurally valid");
    const oversized = await POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: { "content-length": String(6 * 1024 * 1024) },
        body: "",
      }),
    );
    expect(oversized.status).toBe(400);
    const prepared = await POST(json({ sessionId, kind: "prepared" }));
    expect((await prepared.json()).url).toBe("/catalog/images/bag.svg");
  });
});
