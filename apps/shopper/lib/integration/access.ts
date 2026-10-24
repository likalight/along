import { getRuntime } from "./runtime";
export function assertOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !== (req.headers.get("host") ?? new URL(req.url).host)
  )
    throw new Error("Cross-origin request rejected.");
}
export function authorize(req: Request, id: string) {
  assertOrigin(req);
  if (typeof id !== "string") throw new Error("Session required.");
  const key = `along-session-${id}=`;
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(key))
    ?.slice(key.length);
  if (!token) throw new Error("Unauthorized session.");
  getRuntime().store.authenticate(id, decodeURIComponent(token));
}
