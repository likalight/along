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
  const result = getRuntime().store.core.completeLiveDemo(
    sessionId,
    completion,
  );
  return { snapshot: project(sessionId), receipt: result.receipt };
}
