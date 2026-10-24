export const ORDER_APPROVAL_QUESTION = "Would you like me to place this order?";

export type ApprovalSummary = {
  id: string;
  revision: number;
  responseTurnId?: string | null;
};

function identity(summary: ApprovalSummary | null | undefined) {
  return summary?.responseTurnId
    ? JSON.stringify([summary.id, summary.revision, summary.responseTurnId])
    : undefined;
}

function lastQuestion(text: string) {
  return text
    .match(/[^.!?]+\?/g)
    ?.at(-1)
    ?.trim();
}

/** Deliberately narrow: a question about returns, alternatives or changes does
 * not make the shopper's next "yes" an instruction to place an order. */
export function asksForOrderApproval(text: string) {
  const question = lastQuestion(text)
    ?.toLowerCase()
    .replace(/^(?:so|okay|ok|and)[, ]+/, "");
  if (!question) return false;
  const invitation =
    "(?:(?:(?:would|do) you like|do you want) (?:(?:me|us) to|to)|(?:shall|should|can) (?:i|we)|(?:are you )?ready (?:(?:for me|for us) to|to))";
  const action =
    "(?:(?:go ahead and )?(?:(?:place|confirm) (?:this|the|your) order|(?:order|buy) (?:it|this|that))|go ahead with (?:this|the|your) order)";
  return new RegExp(
    `^(?:${invitation} ${action}(?: for you)?|do you approve (?:this|the) order)\\?$`,
  ).test(question);
}

/** Conversation context only, never transcript finality or playback completion.
 * The store independently checks the current displayed summary and eligible offer. */
export class LiveApprovalContext {
  private invited?: string;
  private active?: string;
  private inputEnd = -1;
  private output: Array<{
    id?: string;
    text: string;
    start: number;
    end: number;
  }> = [];

  expect(summary: ApprovalSummary | null | undefined) {
    const next = identity(summary);
    if (this.invited !== next) {
      this.invited = next;
      this.active = undefined;
      this.output = [];
    }
  }

  arm(summary: ApprovalSummary | null | undefined) {
    this.expect(summary);
    this.active = this.invited;
    this.output = [];
  }

  consume(summary: ApprovalSummary | null | undefined) {
    const current = identity(summary);
    const accepted = !!current && this.active === current;
    this.active = undefined;
    if (this.invited !== current) this.expect(summary);
    return accepted;
  }

  clear() {
    this.invited = undefined;
    this.active = undefined;
    this.output = [];
  }

  observeInput(event: Record<string, unknown>) {
    // A partial "y" or "Yes I" is not a negative/changed request. The server
    // classifies the accumulated text only when processing its delegation.
    if (typeof event.end_ms === "number" && event.end_ms > this.inputEnd) {
      this.inputEnd = event.end_ms;
      this.output = [];
    }
  }

  observeOutput(
    event: Record<string, unknown>,
    summary: ApprovalSummary | null | undefined,
  ) {
    this.expect(summary);
    if (
      !this.invited ||
      typeof event.delta !== "string" ||
      typeof event.start_ms !== "number" ||
      !Number.isFinite(event.start_ms) ||
      typeof event.end_ms !== "number" ||
      !Number.isFinite(event.end_ms) ||
      event.end_ms <= this.inputEnd
    )
      return;
    const id = typeof event.event_id === "string" ? event.event_id : undefined;
    if (id && this.output.some((part) => part.id === id)) return;
    this.output.push({
      id,
      text: event.delta,
      start: event.start_ms,
      end: event.end_ms,
    });
    this.output.sort((a, b) => a.start - b.start);
    this.output = this.output.slice(-128);
    const text = this.output
      .map((part) => part.text)
      .join("")
      .slice(-4000);
    if (lastQuestion(text))
      this.active = asksForOrderApproval(text) ? this.invited : undefined;
  }
}
