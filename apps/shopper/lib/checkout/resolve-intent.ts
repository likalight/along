import { classifyCheckoutReply } from "@concierge/backend/store";
import { getRuntime } from "../integration/runtime";
import { project } from "../integration/projection";
import {
  interpretCheckoutIntent,
  type CheckoutIntentContext,
  type CheckoutIntentDecision,
} from "./intent";

/** Only server-observed conversation and state enter intent interpretation. */
export async function resolveCheckoutIntent(
  sessionId: string,
  text: string,
  context: {
    approvalPromptActive: boolean;
    assentContextCurrent?: boolean;
    lastAssistantMessage?: string;
    latestRequest?: string;
    recentTurns?: CheckoutIntentContext["recentTurns"];
  },
): Promise<CheckoutIntentDecision> {
  const current = getRuntime().store.core.get(sessionId);
  const visible = project(sessionId);
  // A discovered reference is the visible referent. Retained catalog selection
  // or receipt state must not turn its discussion into an old order action.
  if (visible.discoveryReference)
    return {
      intent: "continue_shopping",
      authorization: "none",
      summaryId: null,
    };
  const review = current.stage === "summary" ? current.summary : null;
  const stage: CheckoutIntentContext["stage"] = current.receipt
    ? "complete"
    : review
      ? "review"
      : current.selection
        ? "selected"
        : "shopping";
  // Offline rehearsals retain their deterministic adapter. A live session never
  // falls back to a phrase whitelist when its interpreter fails.
  const fixture =
    (process.env.NODE_ENV === "test" &&
      process.env.ALONG_AGENT_MODE !== "live") ||
    (process.env.NODE_ENV === "development" &&
      process.env.ALONG_AGENT_MODE === "fixture");
  if (fixture) {
    const reply = classifyCheckoutReply(text);
    const intent =
      reply === "approve"
        ? review
          ? "approve_order"
          : "prepare_order"
        : reply === "assent" && review
          ? context.approvalPromptActive
            ? "approve_order"
            : "clarify"
          : review && /\bconfirm(?:ation)?\b/i.test(text)
            ? "clarify"
            : "continue_shopping";
    return {
      intent,
      authorization:
        intent === "approve_order"
          ? reply === "assent"
            ? "assent"
            : "explicit"
          : "none",
      summaryId: intent === "approve_order" ? review!.id : null,
    };
  }
  return interpretCheckoutIntent({
    text,
    ...context,
    stage,
    ...(review
      ? {
          review: {
            id: review.id,
            revision: review.revision,
            displayed: review.displayed,
            product: review.quote.product.name,
            totalMinor: review.quote.total!,
            currency: review.quote.currency,
          },
        }
      : {}),
    lastAssistantMessage: context.lastAssistantMessage ?? visible.message,
    recentTurns: context.recentTurns ?? [
      ...current.history
        .slice(-4)
        .map((entry) => ({ role: "shopper" as const, text: entry.text ?? "" })),
      { role: "assistant" as const, text: visible.message },
      { role: "shopper" as const, text },
    ],
  });
}

// A Live delegation may enter the HTTP handler in-process for non-purchase work.
// Bind its interpretation to the actual Request object; JSON cannot supply it.
const interpretedRequests = new WeakMap<
  Request,
  { sessionId: string; text: string; decision: CheckoutIntentDecision }
>();
export function withCheckoutIntent(
  request: Request,
  sessionId: string,
  text: string,
  decision: CheckoutIntentDecision,
) {
  interpretedRequests.set(request, { sessionId, text, decision });
  return request;
}
export function takeCheckoutIntent(
  request: Request,
  sessionId: string,
  text: string,
) {
  const accepted = interpretedRequests.get(request);
  interpretedRequests.delete(request);
  return accepted?.sessionId === sessionId && accepted.text === text
    ? accepted.decision
    : undefined;
}
