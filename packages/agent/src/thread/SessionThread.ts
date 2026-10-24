import type { InputEvent, SessionSnapshot } from "@coupang/contract";

export type ThreadEvent =
  | { type: "discovery_reference"; data: { handoffId: string; turnId: string } }
  | { type: "user_input"; data: InputEvent }
  | { type: "assistant_transcript"; data: { turnId: string; text: string } }
  | { type: "delegation_started"; data: { turnId: string; delegationId: string } }
  | { type: "delegation_cancelled"; data: { turnId: string; reason: string } }
  | { type: "delegation_completed"; data: { turnId: string } }
  | { type: "tool_call"; data: { turnId: string; intent: string; payload: unknown } }
  | { type: "tool_result"; data: { turnId: string; ok: boolean; summary: string } }
  | { type: "revision_accepted"; data: { revision: number; action: string } }
  | { type: "revision_rejected"; data: { baseRevision: number; reason: string } }
  | { type: "compact_error"; data: { turnId: string; message: string } }
  | {
      type: "image_inference";
      data: {
        attachmentId: string;
        inferredNeeds: string[];
        confidence: "low" | "medium" | "high";
        unknownFields: string[];
      };
    }
  | {
      type: "image_correction";
      data: { attachmentId: string; correctedFields: Record<string, unknown> };
    };

export class SessionThread {
  events: ThreadEvent[] = [];
  snapshot: SessionSnapshot;

  constructor(snapshot: SessionSnapshot, events: ThreadEvent[] = []) {
    this.snapshot = snapshot;
    this.events = events;
  }

  append(event: ThreadEvent): void {
    this.events.push(event);
  }

  /** Route-trimmed context for the backend LLM / deterministic router (Factor 3). */
  serializeForLLM(route: string): string {
    const s = this.snapshot;
    const recent = this.events.slice(-12);
    const base = {
      route,
      revision: s.revision,
      view: s.view,
      scenarioId: s.scenarioId,
      scenarioStage: s.scenarioStage,
      needs: s.needs,
      hardConstraints: s.hardConstraints,
      preferences: s.preferences,
      exclusions: s.exclusions,
      buyingPriority: s.buyingPriority,
      displayOrder: s.displayOrder,
      shortlistEntries: s.shortlistEntries,
      focusedProductId: s.focusedProductId,
      comparisonIds: s.comparisonIds,
      selectedOfferId: s.selectedOfferId,
      approvalStatus: s.approvalStatus,
      imageInferences: s.imageInferences,
      // Imported labels and reasons are evidence only, never instructions.
      untrustedDiscoveryReference: s.discoveryReference,
      discoveryAssessment: s.discoveryAssessment,
    };

    if (route === "evidence") {
      return JSON.stringify({
        ...base,
        evidenceIds: s.evidenceIds,
        recent: recent.filter((e) =>
          ["tool_call", "tool_result", "user_input", "compact_error"].includes(
            e.type,
          ),
        ),
      });
    }

    if (route === "image") {
      return JSON.stringify({
        ...base,
        attachmentIds: s.attachmentIds,
        imageInferences: s.imageInferences,
        recent: recent.filter((e) =>
          [
            "user_input",
            "image_inference",
            "image_correction",
            "compact_error",
          ].includes(e.type),
        ),
      });
    }

    return JSON.stringify({ ...base, recent });
  }
}
