import { describe, it, expect } from "vitest";
import { DELETE, POST } from "@/app/api/attachments/route";
import { connect } from "@/lib/session/store";
import { MAX_IMAGE_BYTES } from "@/lib/attachments/limits";
import { readFile } from "node:fs/promises";
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
      "http://127.0.0.1/private",
      "https://demo.example@private.example/bags/navy",
      "https://demo.example/bags/navy?variant=other",
      "file:///etc/passwd",
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
    expect(oversized.status).toBe(413);
    const prepared = await POST(json({ sessionId, kind: "prepared" }));
    expect((await prepared.json()).url).toBe("/fixtures/navy-bag.svg");
  });
  it("rejects magic-prefix counterfeits and truncated images without changing accepted context", async () => {
    const session = connect();
    for (const [type, bytes] of [
      ["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
      ["image/jpeg", Buffer.from([255, 216, 255, 217])],
      ["image/webp", Buffer.from("RIFF\x04\x00\x00\x00WEBP")],
    ] as const) {
      const form = new FormData();
      form.set("sessionId", session.sessionId);
      form.set("file", new File([bytes], "counterfeit", { type }));
      const result = await POST(
        new Request("http://localhost/api/attachments", {
          method: "POST",
          body: form,
        }),
      );
      expect(result.status).toBe(400);
      expect((await result.json()).error).toContain("complete supported image");
      expect(connect(session.sessionId)).toEqual(session);
    }
  });
  it("accepts complete PNG, JPEG and WebP uploads with opaque IDs and no cached response", async () => {
    const { sessionId } = connect();
    const image = await readFile(
      new URL("../public/fixtures/perlin-noise.png", import.meta.url),
    );
    const form = new FormData();
    form.set("sessionId", sessionId);
    form.set("file", new File([image], "sample.png", { type: "image/png" }));
    const result = await POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        body: form,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.json()).toMatchObject({
      kind: "image",
      status: "ready",
      classification: "proxy",
      name: "sample.png",
    });
    // Original one-pixel image fixtures encoded by libvips, independent of the validator.
    for (const [type, base64] of [
      [
        "image/jpeg",
        "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKpAB//Z",
      ],
      [
        "image/webp",
        "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vz0AAA=",
      ],
    ]) {
      const upload = new FormData();
      upload.set("sessionId", sessionId);
      upload.set(
        "file",
        new File([Buffer.from(base64, "base64")], "pixel", { type }),
      );
      const accepted = await POST(
        new Request("http://localhost/api/attachments", {
          method: "POST",
          body: upload,
        }),
      );
      expect(accepted.status).toBe(200);
      expect((await accepted.json()).id).toMatch(/^[a-f0-9-]{36}$/);
    }
  });
  it("caps actual chunked bytes even without a Content-Length header", async () => {
    for (const [type, length] of [
      ["application/json", 8193],
      ["multipart/form-data; boundary=fixture", MAX_IMAGE_BYTES + 8193],
    ] as const) {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(length));
        },
        cancel() {
          cancelled = true;
        },
      });
      const request = new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: { "Content-Type": type },
        body,
        duplex: "half",
      } as RequestInit);
      expect(request.headers.has("content-length")).toBe(false);
      expect((await POST(request)).status).toBe(413);
      expect(cancelled).toBe(true);
    }
  });
  it("removal frees unshared uploads only in their own session", async () => {
    const { sessionId } = connect(),
      other = connect();
    const assets: { id: string }[] = [];
    for (let n = 0; n < 12; n++)
      assets.push(
        await (await POST(json({ sessionId, kind: "prepared" }))).json(),
      );
    expect((await POST(json({ sessionId, kind: "prepared" }))).status).toBe(
      400,
    );
    const remove = (owner: string) =>
      DELETE(
        new Request("http://localhost/api/attachments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: owner,
            attachmentId: assets[0].id,
          }),
        }),
      );
    expect(await (await remove(other.sessionId)).json()).toEqual({
      removed: false,
    });
    expect((await POST(json({ sessionId, kind: "prepared" }))).status).toBe(
      400,
    );
    expect(await (await remove(sessionId)).json()).toEqual({ removed: true });
    expect((await POST(json({ sessionId, kind: "prepared" }))).status).toBe(
      200,
    );
  });
  it("rejects mismatched origins and malformed reference kinds before adding assets", async () => {
    const { sessionId } = connect();
    expect(
      (
        await POST(
          new Request("http://localhost/api/attachments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: "https://untrusted.example",
              Host: "untrusted.example",
            },
            body: JSON.stringify({ sessionId, kind: "prepared" }),
          }),
        )
      ).status,
    ).toBe(403);
    for (const kind of ["untrusted", null, 1])
      expect(
        (
          await POST(
            json({ sessionId, kind, url: "https://demo.example/bags/navy" }),
          )
        ).status,
      ).toBe(400);
  });
  it("uses the browser-facing loopback authority when Next normalizes its internal request URL", async () => {
    const { sessionId } = connect();
    const post = (origin: string, host = "127.0.0.1:3173") =>
      POST(
        new Request("http://localhost:3173/api/attachments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: origin,
            Host: host,
          },
          body: JSON.stringify({ sessionId, kind: "prepared" }),
        }),
      );
    expect((await post("http://127.0.0.1:3173")).status).toBe(200);
    for (const origin of [
      "http://localhost:3173",
      "http://127.0.0.1:3000",
      "https://127.0.0.1:3173",
      "null",
    ])
      expect((await post(origin)).status).toBe(403);
    expect(
      (await post("http://untrusted.example:3173", "untrusted.example:3173"))
        .status,
    ).toBe(403);
    expect((await post("http://127.0.0.1:3000", "127.0.0.1:3000")).status).toBe(
      403,
    );
  });
});
