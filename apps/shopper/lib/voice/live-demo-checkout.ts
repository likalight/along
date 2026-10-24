import {
  classifyCheckoutReply,
  isLiveDemoConfirmation,
} from "@concierge/backend/store";
import { getRuntime } from "@/lib/integration/runtime";
import { project } from "@/lib/integration/projection";

export { classifyCheckoutReply, isLiveDemoConfirmation };

/** Only the authenticated server Live sideband calls this; it is not an HTTP
 * action or a model tool. Transcript fragments are never marked final/confident.
 * The backend independently limits completion to a displayed proxy-offer summary. */
export function completeLiveDemoCheckout(input: {
  sessionId: string;
  epoch: number;
  expectedRevision: number;
  summaryId: string;
  summaryRevision: number;
  responseTurnId: string;
  delegationId: string;
  transcript: string;
  affirmationSummaryId?: string;
}) {
  const { sessionId, ...completion } = input;
  const { core } = getRuntime().store;
  if (project(sessionId).discoveryReference)
    throw new Error(
      "This browsing reference is not a catalog order. Open its Coupang link to check and buy, or return to your catalog first.",
    );
  try {
    const result = core.completeLiveDemo(sessionId, completion);
    return { snapshot: project(sessionId), receipt: result.receipt };
  } catch (error) {
    // An acknowledgement can fail after the order was accepted. Inspect the
    // authoritative result before suggesting a retry; never submit again here.
    const current = core.get(sessionId);
    if (
      current.epoch === input.epoch &&
      current.receipt?.completionSource === "live_demo" &&
      current.receipt.summaryId === input.summaryId &&
      current.receipt.summaryRevision === input.summaryRevision
    ) {
      return {
        snapshot: project(sessionId),
        receipt: structuredClone(current.receipt),
      };
    }
    throw error;
  }
}
