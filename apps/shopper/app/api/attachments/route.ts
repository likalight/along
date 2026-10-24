import { NextResponse } from "next/server";
import { agreedCatalog } from "@coupang/contract";
import { authorize } from "@/lib/integration/access";
import { getRuntime } from "@/lib/integration/runtime";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  try {
    const b = await request.json();
    authorize(request, b.sessionId);
    const { store } = getRuntime();
    if (typeof b.attachmentId !== "string")
      throw new Error("Reference required.");
    if (store.acceptedReferences(b.sessionId).includes(b.attachmentId))
      throw new Error("Remove a shared reference through the conversation.");
    const s = store.core.get(b.sessionId);
    if (s.attachmentIds.includes(b.attachmentId))
      store.removeReference(s.id, s.revision, b.attachmentId);
    return NextResponse.json({ removed: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unable to remove reference." },
      { status: 400 },
    );
  }
}
export async function POST(request: Request) {
  try {
    if (
      Number(request.headers.get("content-length") ?? 0) >
      2 * 1024 * 1024 + 8192
    )
      throw new Error("Images must be at most 2 MiB.");
    const { store } = getRuntime();
    if (request.headers.get("content-type")?.includes("application/json")) {
      const b = await request.json();
      authorize(request, b.sessionId);
      const s = store.core.get(b.sessionId);
      if (b.kind === "prepared") {
        const p = agreedCatalog.imageFixtures.find(
          (x: any) => x.id === "IMG-BAG-INSPIRATION",
        );
        store.core.usePreparedImage(s.id, s.revision, p.id);
        return NextResponse.json({
          id: p.id,
          kind: "image",
          name: "Prepared blue tote illustration",
          url: p.image.url,
          classification: "proxy",
          status: "ready",
        });
      }
      if (
        b.kind !== "link" ||
        !agreedCatalog.knownLinks.some((l: any) => l.url === b.url)
      )
        throw new Error(
          "Link unavailable in this demo. Use a source link from the catalog; no arbitrary URL is fetched.",
        );
      return NextResponse.json({
        id: b.url,
        kind: "link",
        name: "Curated source link",
        url: b.url,
        classification: "proxy",
        status: "ready",
      });
    }
    const form = await request.formData(),
      id = String(form.get("sessionId")),
      file = form.get("file");
    authorize(request, id);
    if (!(file instanceof File)) throw new Error("Image required.");
    const s = store.core.get(id);
    const r = store.core.addAttachment(
      id,
      s.revision,
      file.type,
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json({
      id: r.attachment.id,
      kind: "image",
      name: file.name,
      url: `/api/attachments?sessionId=${id}&id=${r.attachment.id}`,
      classification: "proxy",
      status: "ready",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed." },
      { status: 400 },
    );
  }
}
export async function GET(request: Request) {
  try {
    const u = new URL(request.url),
      id = u.searchParams.get("sessionId")!;
    authorize(request, id);
    const a = getRuntime().store.core.attachment(id, u.searchParams.get("id")!);
    return new Response(new Uint8Array(a.bytes), {
      headers: {
        "Content-Type": a.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Attachment unavailable." },
      { status: 404 },
    );
  }
}
