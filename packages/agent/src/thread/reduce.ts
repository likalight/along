import type { SessionSnapshot } from "@coupang/contract";
import type { SessionThread, ThreadEvent } from "./SessionThread.js";

/** Stateless-style reducer: apply a thread event onto snapshot when needed (Factor 12). */
export function reduce(
  thread: SessionThread,
  event: ThreadEvent,
  nextSnapshot?: SessionSnapshot,
): SessionThread {
  thread.append(event);
  if (nextSnapshot) {
    thread.snapshot = nextSnapshot;
  }
  return thread;
}
