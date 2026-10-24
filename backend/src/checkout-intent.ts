export type CheckoutReply = "approve" | "assent" | "other";

/** Interpret a whole shopper utterance, never a purchase keyword inside a sentence. */
export function classifyCheckoutReply(text: string): CheckoutReply {
  if (typeof text !== "string" || !text.trim() || text.length > 300) return "other";
  const original = text.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ");
  // Apostrophes inside contractions are fine; quoted speech is not an instruction.
  if (/["“”‘]/.test(original) || /(?:^|\s)'|'(?:$|[\s.,!?])/.test(original)) return "other";
  if (/\b(?:no|not|never|don't|dont|cannot|can't|stop|cancel|wait|hold on|actually|instead|but|unless|if|maybe|perhaps|later|tomorrow|change|different|replace|switch|except|suppose|hypothetically)\b/.test(original)) return "other";
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
    .replace(/^go ahead and\s+/, "");
  if (assent.test(value)) return question || actionRequest ? "other" : "assent";
  const purchase = /^(?:confirm(?: (?:this |the )?(?:simulated )?(?:purchase|order))?|(?:i )?approve (?:this|the) (?:purchase|order)|buy (?:it|this|that|the item|the product)|order it|place (?:the|this|my) order|(?:go ahead|proceed) with (?:the|this|my) (?:purchase|order))(?: now)?(?: for me)?$/;
  return purchase.test(value) ? "approve" : "other";
}

/** Context must come from the server's current order-approval prompt. */
export function isLiveDemoConfirmation(text: string, approvalPromptActive = false): boolean {
  const reply = classifyCheckoutReply(text);
  return reply === "approve" || (reply === "assent" && approvalPromptActive);
}
