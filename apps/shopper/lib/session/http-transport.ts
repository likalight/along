import type { Session, SessionTransport } from "./contract";
export class TransportError extends Error {
  constructor(
    message: string,
    public snapshot?: Session,
  ) {
    super(message);
  }
}
async function post(
  action: string,
  input?: unknown,
  extra = {},
  signal?: AbortSignal,
) {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, input, ...extra }),
    signal,
  });
  const data = await response.json();
  if (!response.ok) throw new TransportError(data.error, data.snapshot);
  return data;
}
export const httpTransport: SessionTransport = {
  connect: (sessionId) => post("connect", undefined, { sessionId }),
  discovery: (input, handoffId) => post("discovery", input, { handoffId }),
  send: (input, signal) => post("input", input, {}, signal),
  cancel: (input) => post("cancel", input),
  mode: (input, mode) => post("mode", input, { mode }),
  presented: (identity, summary) =>
    post(
      "presented",
      { ...identity, turnId: summary.responseTurnId },
      { summaryId: summary.id, textHash: summary.textHash },
    ),
  lifecycle: (input) => post("lifecycle", input),
};
