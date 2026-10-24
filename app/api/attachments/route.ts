import { NextResponse } from "next/server";
import { addAsset } from "@/lib/session/store";
import { preparedImage, supportedLinks } from "@/lib/session/fixtures";
export const runtime = "nodejs";
const MAX = 5 * 1024 * 1024;
export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !==
        `${new URL(request.headers.get("origin")!).protocol}//${request.headers.get("host")}`
    )
      return NextResponse.json(
        { error: "Cross-origin requests are unavailable." },
        { status: 403 },
      );
    if (Number(request.headers.get("content-length") ?? 0) > MAX + 8192)
      throw new Error("Choose an image of 5 MB or less.");
    if (request.headers.get("content-type")?.includes("application/json")) {
      const { sessionId, kind, url } = await request.json();
      if (kind === "prepared")
        return NextResponse.json(addAsset(sessionId, preparedImage));
      const asset =
        typeof url === "string" && Object.hasOwn(supportedLinks, url)
          ? supportedLinks[url as keyof typeof supportedLinks]
          : undefined;
      if (!asset)
        return NextResponse.json(
          {
            error:
              "Unavailable in this demo. Use https://demo.example/bags/navy or a photo.",
          },
          { status: 422 },
        );
      return NextResponse.json(addAsset(sessionId, asset));
    }
    const form = await request.formData(),
      file = form.get("file"),
      sessionId = form.get("sessionId");
    if (!(file instanceof File) || typeof sessionId !== "string")
      throw new Error("Select a photo and start a session.");
    if (file.size === 0 || file.size > MAX)
      throw new Error("Choose a non-empty image of 5 MB or less.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Use a JPG, PNG or WebP image.");
    const data = Buffer.from(await file.arrayBuffer());
    const valid =
      file.type === "image/jpeg"
        ? data[0] === 255 && data[1] === 216 && data[2] === 255
        : file.type === "image/png"
          ? data
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : data.subarray(0, 4).toString() === "RIFF" &&
            data.subarray(8, 12).toString() === "WEBP";
    if (!valid)
      throw new Error("The file contents do not match its image type.");
    return NextResponse.json(
      addAsset(sessionId, {
        kind: "image",
        name: file.name.slice(0, 120),
        url: `data:${file.type};base64,${data.toString("base64")}`,
        classification: "proxy",
        status: "ready",
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Upload failed. Try again.",
      },
      { status: 400 },
    );
  }
}
