import {
  AgentProposalSchema,
  type AgentProposal,
  ProposalActionSchema,
} from "@coupang/contract";

/** Validate outbound proposals against contract v1 before apply. */
export function parseProposal(raw: unknown): AgentProposal {
  return AgentProposalSchema.parse(raw);
}

export function assertKnownAction(action: string): void {
  ProposalActionSchema.parse(action);
}

/** Actions never exposed to the model. */
export const FORBIDDEN_TOOLS = [
  "place_order",
  "create_receipt",
  "charge_payment",
  "contact_seller",
] as const;

export function isForbiddenTool(name: string): boolean {
  return (FORBIDDEN_TOOLS as readonly string[]).includes(name);
}
