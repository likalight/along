import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/attachments/route";
import { connect } from "@/lib/session/store";
const json = (body: object) =>
  new Request("http://localhost/api/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
        422,
      );
    const response = await POST(
      json({ sessionId, kind: "link", url: "https://demo.example/bags/navy" }),
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
      }),
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error).toContain("contents");
    const oversized = await POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: { "content-length": String(6 * 1024 * 1024) },
        body: "",
      }),
    );
    expect(oversized.status).toBe(400);
    const prepared = await POST(json({ sessionId, kind: "prepared" }));
    expect((await prepared.json()).url).toBe("/fixtures/navy-bag.svg");
  });
});
