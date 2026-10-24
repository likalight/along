export type CheckoutReply = "approve" | "assent" | "other";

function classifyClause(original: string): CheckoutReply {
  const question = original.endsWith("?");
  let value = original.replace(/[.!?]$/, "").trim().replace(/,?\s+please$/, "");
  if (/[!?]/.test(value)) return "other";
  const assent = /^(?:yes(?: please)?|yeah|yep|ok(?:ay)?|sure|all right|alright|go ahead|(?:let's )?do it|looks good|sounds good|that's good|that is good)$/;
  if (assent.test(value)) return question ? "other" : "assent";
  for (let i = 0; i < 3; i++) value = value.replace(/^(?:yes|yeah|yep|ok(?:ay)?|sure|all right|alright)[, ]+/, "");
  if (assent.test(value)) return question ? "other" : "assent";
  // A frustrated shopper can acknowledge the earlier approval and then make
  // the actual current request, e.g. "Yes I approved this, can we just buy this".
  value = value.replace(/^i (?:already )?approved (?:this|it)[,.]?\s+/, "");
  const actionRequest = /^(?:(?:can|could) (?:you|we)|would you please)\s+/.test(value);
  if (actionRequest) value = value.replace(/^(?:(?:can|could) (?:you|we)|would you please)\s+(?:just\s+)?(?:please\s+)?/, "");
  if (question && !actionRequest) return "other";
  if (actionRequest && value === "confirm") return "other";
  value = value
    .replace(/^(?:i (?:would like|want) to|i'd like to|let's)\s+/, "")
    .replace(/^please\s+/, "")
    .replace(/,?\s+please$/, "")
    .replace(/^go ahead and\s+/, "")
    .replace(/^i,?\s+(?=(?:place|confirm)\b)/, "");
  if (assent.test(value)) return question || actionRequest ? "other" : "assent";
  const purchase = /^(?:confirm(?: (?:this |the )?(?:simulated )?(?:purchase|order))?|(?:i )?approve (?:this|the) (?:purchase|order)|(?:buy|purchase) (?:it|this|that|the item|the product)|order it|place (?:the|this|my) order|lock (?:(?:the|this|my) order in|in (?:the|this|my) order)|(?:go ahead|proceed) with (?:the|this|my) (?:purchase|order))(?: (?:right )?now)?(?: for me)?$/;
  return purchase.test(value) ? "approve" : "other";
}

/** Interpret a whole shopper utterance, never a purchase keyword inside a sentence. */
export function classifyCheckoutReply(text: string): CheckoutReply {
  if (typeof text !== "string" || !text.trim() || text.length > 300) return "other";
  const original = text.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  // Keep these checks before speech cleanup and clause parsing: a later purchase
  // phrase must never discard an earlier cancellation, condition, or changed term.
  if (/["“”‘]/.test(original) || /(?:^|\s)'|'(?:$|[\s.,!?])/.test(original)) return "other";
  if (/\b(?:no|not|never|don't|dont|cannot|can't|stop|cancel|wait|hold on|actually|instead|but|unless|if|maybe|perhaps|later|tomorrow|change|different|replace|switch|except|suppose|hypothetically)\b/.test(original)) return "other";
  let value = original.replace(/\b(?:uh|um|erm|er)\b[, ]*/g, " ").replace(/\s+/g, " ").trim();
  // ASR commonly preserves a restarted pronoun or request lead-in.
  for (let i = 0; i < 3; i++) value = value.replace(/\b(i|we|let's|can|could|please)(?:,?\s+)\1\b/g, "$1");
  const direct = classifyClause(value);
  if (direct !== "other") return direct;

  const clauses = value.replace(/[.!]$/, "").split(/\s*[,.;]\s*|\s+and\s+(?=(?:please\s+)?(?:buy|purchase|order|place|lock|confirm|approve)\b)/);
  if (clauses.length < 2 || clauses.length > 6 || clauses.some((clause) => !clause)) return "other";
  let explicitApproval = false;
  for (const clause of clauses) {
    const reply = classifyClause(clause);
    if (reply === "approve") explicitApproval = true;
    // A bounded compatibility acknowledgment can precede a purchase request.
    // Arbitrary statements/questions are not discarded to find an approval.
    const acknowledgment = /^(?:(?:yes|yeah|yep|ok(?:ay)?|sure) )?(?:i (?:do )?have (?:both|it|that connection|the (?:connection|adapter))|i (?:already )?approved (?:this|it)|i understand)$/;
    if (reply === "other" && !acknowledgment.test(clause)) return "other";
  }
  return explicitApproval ? "approve" : "other";
}

/** Context must come from the server's current order-approval prompt. */
export function isLiveDemoConfirmation(text: string, approvalPromptActive = false): boolean {
  const reply = classifyCheckoutReply(text);
  return reply === "approve" || (reply === "assent" && approvalPromptActive);
}
