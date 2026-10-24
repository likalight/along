import { getRuntime } from "./runtime";
export function assertSessionAccess(req: Request, id: string) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !== (req.headers.get("host") ?? new URL(req.url).host)
  )
    throw new Error("cross_origin_request");
  const key = `along-session-${id}=`;
  const token = req.headers
    .get("cookie")
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(key))
    ?.slice(key.length);
  if (!token) throw new Error("unauthorized_session");
  getRuntime().store.authenticate(id, decodeURIComponent(token));
}
export function sessionPayload(id: string) {
  const { store } = getRuntime();
  return {
    snapshot: store.get(id),
    summary: store.summaryDetails(id),
    receipt: store.core.get(id).receipt,
    offers: store.quotes(id),
  };
}
