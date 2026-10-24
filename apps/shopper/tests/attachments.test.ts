import { describe, it, expect } from "vitest";
import { POST, DELETE, GET } from "@/app/api/attachments/route";
import { getRuntime } from "@/lib/integration/runtime";
import { POST as sessionPost } from "@/app/api/session/route";
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

describe("reference lifecycle through authoritative routes", () => {
  const input = (sessionId: string, extra: Record<string, unknown>) => {
    const s = getRuntime().store.core.get(sessionId);
    return {
      sessionId,
      epoch: s.epoch,
      turnId: crypto.randomUUID(),
      eventId: crypto.randomUUID(),
      baseRevision: s.revision,
      visibleRevision: s.revision,
      visibleProductIds: s.displayOrder,
      modality: "text",
      ...extra,
    };
  };
  const send = (sessionId: string, i: Record<string, unknown>) =>
    sessionPost(json({ sessionId, action: "input", input: i }));
  it("removes shared image bytes only after a current conversation command; another session cannot delete them", async () => {
    const { sessionId } = connect();
    const { sessionId: stranger } = connect();
    const form = new FormData();
    form.set("sessionId", sessionId);
    form.set(
      "file",
      new File(
        [
          Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=",
            "base64",
          ),
        ],
        "reference.png",
        { type: "image/png" },
      ),
    );
    const uploaded = await POST(
      new Request("http://localhost/api/attachments", {
        method: "POST",
        body: form,
        headers: { Cookie: cookie(sessionId) },
      }),
    );
    expect(uploaded.status).toBe(200);
    const asset = await uploaded.json();
    const { store } = getRuntime();
    expect(() =>
      store.removeReference(
        stranger,
        store.core.get(stranger).revision,
        asset.id,
      ),
    ).toThrow();
    expect(
      store.core.attachment(sessionId, asset.id).bytes.length,
    ).toBeGreaterThan(0);
    store.ingestInput(
      input(sessionId, { modality: "image", attachmentId: asset.id }) as any,
    );
    expect(
      (await DELETE(json({ sessionId, attachmentId: asset.id }))).status,
    ).toBe(400);
    const stale = input(sessionId, { text: `Remove reference ${asset.id}` });
    store.core.beginTurn(sessionId, store.core.get(sessionId).revision);
    expect((await send(sessionId, stale)).status).toBe(409);
    expect(store.acceptedReferences(sessionId)).toContain(asset.id);
    const removed = await send(
      sessionId,
      input(sessionId, { text: `Remove reference ${asset.id}` }),
    );
    expect(removed.status).toBe(200);
    const result = await removed.json();
    expect(result.snapshot.sharedReferenceIds).not.toContain(asset.id);
    expect(result.snapshot.summary).toBeFalsy();
    expect(
      (
        await GET(
          new Request(`http://localhost${asset.url}`, {
            headers: { Cookie: cookie(sessionId) },
          }),
        )
      ).status,
    ).toBe(404);
    expect(
      (await DELETE(json({ sessionId, attachmentId: asset.id }))).status,
    ).toBe(200);
  });
  it("tracks accepted curated links separately from uploaded images and removes URLs with slashes", async () => {
    const { sessionId } = connect();
    const url = "https://www.apple.com/shop/product/myqy3am/a/earpods-usb-c";
    const store = getRuntime().store;
    const shared = input(sessionId, { modality: "link", text: url });
    store.ingestInput(shared as any);
    expect(store.acceptedReferences(sessionId)).toContain(url);
    expect(store.core.get(sessionId).attachmentIds).not.toContain(url);
    const response = await send(
      sessionId,
      input(sessionId, { text: `Remove reference ${url}` }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).snapshot.sharedReferenceIds).not.toContain(
      url,
    );
    store.ingestInput(shared as any);
    expect(store.acceptedReferences(sessionId)).not.toContain(url);
  });
});
