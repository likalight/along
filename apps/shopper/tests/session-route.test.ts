import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/session/route";

describe("session HTTP boundary", () => {
  it("bounds actual streamed JSON even when Content-Length is absent or understated", async () => {
    for (const contentLength of [undefined, "1"]) {
      const response = await POST(
        new Request("http://localhost/api/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(contentLength ? { "Content-Length": contentLength } : {}),
          },
          body: JSON.stringify({
            action: "connect",
            padding: "x".repeat(40_000),
          }),
        }),
      );
      expect(response.status).toBe(413);
    }
  });
  it("rejects non-JSON and malformed request shapes without creating a session", async () => {
    for (const body of ["null", "[]", "{"]) {
      const response = await POST(
        new Request("http://localhost/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).not.toHaveProperty("sessionId");
    }
    expect(
      (
        await POST(
          new Request("http://localhost/api/session", {
            method: "POST",
            body: "{}",
          }),
        )
      ).status,
    ).toBe(415);
  });
});
