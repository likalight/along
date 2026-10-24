import { parseBudget, parseCompatibility } from "../intent/requirements.js";
import type {
  AgentProposal,
  InputEvent,
  SessionSnapshot,
  SpeakableResult,
} from "@coupang/contract";
import {
  audioPriorityProposal,
  audioSolutionTypesProposal,
  buildAudioShortlist,
  parsePriority,
  parseSolutionType,
} from "../scenarios/audio.js";
import {
  bagClarifyShapeColour,
  buildBagDiscovery,
  parseBagPrefs,
} from "../scenarios/bags.js";
import {
  beddingOpeningProposal,
  buildBeddingShortlist,
  parseBeddingPrefs,
} from "../scenarios/bedding.js";
import {
  EVIDENCE,
  getProduct,
  KNOWN_LINKS,
  offersForProduct,
  PREPARED_ATTACHMENTS,
} from "../fixtures/catalog.js";
import { type Route, resolveReference } from "../intent/router.js";
import type { FixtureSessionStore } from "../session/FixtureSessionStore.js";
import type { SessionThread } from "../thread/SessionThread.js";
import { reduce } from "../thread/reduce.js";

export interface LoopResult {
  proposals: AgentProposal[];
  speakable: SpeakableResult[];
  cancelled: boolean;
}

function baseProposal(
  input: InputEvent,
  eventSuffix: string,
): Omit<AgentProposal, "action" | "payload" | "evidenceIds"> {
  return {
    sessionId: input.sessionId,
    epoch: input.epoch,
    turnId: input.turnId,
    baseRevision: input.baseRevision,
    eventId: `${input.eventId}-${eventSuffix}`,
  };
}

/**
 * Deterministic shopping agent loop (custom harness).
 * Emits contract v1 proposals only; bounded steps; cancel-aware.
 */
export async function agentLoop(opts: {
  input: InputEvent;
  route: Route;
  thread: SessionThread;
  store: FixtureSessionStore;
  cancel: AbortSignal;
}): Promise<LoopResult> {
  const { input, route, thread, store, cancel } = opts;
  const proposals: AgentProposal[] = [];
  const speakable: SpeakableResult[] = [];
  let snapshot = thread.snapshot;

  const push = (proposal: AgentProposal) => {
    if (cancel.aborted) return false;
    reduce(thread, {
      type: "tool_call",
      data: {
        turnId: input.turnId,
        intent: proposal.action,
        payload: proposal.payload,
      },
    });
    const result = store.apply(proposal);
    reduce(
      thread,
      {
        type: "tool_result",
        data: {
          turnId: input.turnId,
          ok: result.ok,
          summary: result.reason ?? result.speakable.content,
        },
      },
      result.snapshot,
    );
    proposals.push(proposal);
    speakable.push(result.speakable);
    snapshot = result.snapshot;
    // Keep baseRevision in sync for chained proposals within the same turn
    input.baseRevision = snapshot.revision;
    return result.ok;
  };

  if (cancel.aborted) return { proposals, speakable, cancelled: true };

  switch (route) {
    case "stop_decline": {
      push({
        ...baseProposal(input, "cancel"),
        action: "cancel",
        payload: { reason: "shopper_stop" },
        evidenceIds: [],
      });

      break;
    }
    case "save": {
      const ref = resolveReference(
        input.text ?? "",
        snapshot,
        input.visibleProductIds,
      );
      const productId =
        ref.productId ?? snapshot.focusedProductId ?? snapshot.displayOrder[0];
      if (!productId) {
        push({
          ...baseProposal(input, "clarify"),
          action: "clarify",
          payload: { question: "Which option should I save?" },
          evidenceIds: [],
        });
      } else {
        push({
          ...baseProposal(input, "save"),
          action: "save",
          payload: {
            productId,
            rationale: input.text ?? "Saved from conversation",
          },
          evidenceIds: [],
        });
      }
      break;
    }
    case "approve_candidate": {
      push({
        ...baseProposal(input, "propose_approval"),
        action: "propose_approval",
        payload: {
          modality: input.modality === "text" ? "text" : "voice",
          summaryId: snapshot.summaryId,
        },
        evidenceIds: [],
      });
      break;
    }
    case "cold_start": {
      const scenario = inferScenario(input.text ?? "", snapshot);
      push({
        ...baseProposal(input, "constraints"),
        action: "set_constraints",
        payload: {
          needs: scenario.needs,
          hardConstraints: {},
          preferences: { scenarioHint: scenario.id },
        },
        evidenceIds: [],
      });
      // Update scenario on snapshot via constraints history — set on store snapshot manually
      const s = store.get(input.sessionId)!;
      s.scenarioId = scenario.id;
      // re-fetch after mutating — actually we need to patch store. Use clarify openings:
      if (scenario.id === "cafe_dictation") {
        push(audioSolutionTypesProposal(baseProposal(input, "open")));
      } else if (scenario.id === "bag_inspiration") {
        push(bagClarifyShapeColour(baseProposal(input, "open")));
      } else {
        push(beddingOpeningProposal(baseProposal(input, "open")));
      }
      patchScenario(store, input.sessionId, scenario.id);
      break;
    }
    case "solution_type": {
      const st = parseSolutionType(input.text ?? "");
      // Provisional host for café demo quotes — shopper can revise (USB-A/C).
      // Without it every mic stays HOST_CONNECTION_REQUIRED and offers never checkout.
      const host =
        parseCompatibility(input.text ?? "").hostConnection ?? "usb-c";
      push({
        ...baseProposal(input, "set"),
        action: "set_constraints",
        payload: {
          preferences: { solutionType: st },
          needs: ["café dictation mic"],
          hardConstraints: { compatibility: { hostConnection: host } },
        },
        evidenceIds: [],
      });
      push(audioPriorityProposal(baseProposal(input, "ask-priority")));
      patchStage(store, input.sessionId, "buying_priorities");
      break;
    }
    case "priority": {
      const priority = parsePriority(input.text ?? "") ?? "best_value";
      const removeHardBudget =
        priority === "best_supported_quality" &&
        /remove (the )?budget|no hard budget|exceed/i.test(input.text ?? "");
      push({
        ...baseProposal(input, "priority"),
        action: "set_priority",
        payload: { priority, removeHardBudget },
        evidenceIds: [],
      });
      const snap = store.get(input.sessionId)!;
      const solutionType = snap.preferences["solutionType"] as
        "headset" | "clip_on" | "directional_desktop" | undefined;
      const entries = buildAudioShortlist(snap, solutionType, priority);
      push({
        ...baseProposal(input, "shortlist"),
        action: "shortlist",
        payload: { entries },
        evidenceIds: [],
      });
      break;
    }
    case "strong_intent":
    case "weak_intent":
    case "revise": {
      runGuidedNeed(input, snapshot, push, store, route);
      break;
    }
    case "ordinal_ref": {
      const ref = resolveReference(
        input.text ?? "",
        snapshot,
        input.visibleProductIds,
      );
      if (ref.ambiguous || !ref.productId) {
        push({
          ...baseProposal(input, "clarify"),
          action: "clarify",
          payload: { question: ref.ambiguous ?? "Which option do you mean?" },
          evidenceIds: [],
        });
      } else {
        push({
          ...baseProposal(input, "focus"),
          action: "focus",
          payload: { productId: ref.productId },
          evidenceIds: [],
        });
      }
      break;
    }
    case "compare": {
      const ids = pickCompareIds(input, snapshot);
      if (ids.length < 2) {
        push({
          ...baseProposal(input, "clarify"),
          action: "clarify",
          payload: { question: "Which two visible products should I compare?" },
          evidenceIds: [],
        });
      } else {
        push({
          ...baseProposal(input, "compare"),
          action: "compare",
          payload: { productIds: ids },
          evidenceIds: [],
        });
      }
      break;
    }
    case "evidence_q": {
      const productId =
        snapshot.focusedProductId ??
        resolveReference(input.text ?? "", snapshot, input.visibleProductIds)
          .productId ??
        snapshot.displayOrder[0];
      if (!productId) {
        push({
          ...baseProposal(input, "clarify"),
          action: "clarify",
          payload: { question: "Which product should I pull evidence for?" },
          evidenceIds: [],
        });
        break;
      }
      const prod = getProduct(productId)!;
      const productEv = EVIDENCE.filter(
        (e) => e.subjectType === "product" && e.subjectId === productId,
      );
      const offer = offersForProduct(productId)[0];
      const sellerEv = offer
        ? EVIDENCE.filter(
            (e) => e.subjectType === "seller" && e.subjectId === offer.sellerId,
          )
        : [];
      // Progressive: synthesis ids first
      const evidenceIds = [...productEv, ...sellerEv].map((e) => e.id);
      push({
        ...baseProposal(input, "focus"),
        action: "focus",
        payload: { productId },
        evidenceIds: [],
      });
      push({
        ...baseProposal(input, "evidence"),
        action: "show_evidence",
        payload: {
          evidenceIds,
          progression: [
            "synthesis",
            "excerpts",
            "problem_relevance",
            "videos",
            "takeaway",
          ],
          productVsSellerSeparated: true,
          notes: progressiveNotes(prod.category, input.text ?? ""),
        },
        evidenceIds,
      });
      break;
    }
    case "image_ingest": {
      handleImage(input, snapshot, push, store, thread, false);
      break;
    }
    case "image_correct": {
      handleImage(input, snapshot, push, store, thread, true);
      break;
    }
    case "link_ingest": {
      const url = (input.text ?? "").trim();
      const resolved = store.resolveLink(url);
      if (resolved.status === "unavailable" || !("productId" in resolved)) {
        speakable.push({
          turnId: input.turnId,
          revision: snapshot.revision,
          content:
            "That link isn't in our curated demo mappings, so I won't invent a product from it.",
          channel: "commentary",
        });
        reduce(thread, {
          type: "compact_error",
          data: { turnId: input.turnId, message: "unsupported_link" },
        });
        break;
      }
      push({
        ...baseProposal(input, "link"),
        action: "set_constraints",
        payload: {
          needs: [`reference:${resolved.productId}`],
          preferences: { linkSource: url, linkNote: resolved.note },
        },
        evidenceIds: [],
      });
      push({
        ...baseProposal(input, "focus-link"),
        action: "shortlist",
        payload: {
          entries: [
            {
              productId: resolved.productId,
              rank: "gold",
              fitReason: `Cited from curated link (${resolved.note}).`,
              compromise: "Link context is fixture-bounded, not a live crawl.",
            },
          ],
        },
        evidenceIds: [],
      });
      break;
    }
    default: {
      push({
        ...baseProposal(input, "clarify"),
        action: "clarify",
        payload: { question: "What would you like to explore next?" },
        evidenceIds: [],
      });
    }
  }

  return { proposals, speakable, cancelled: cancel.aborted };
}

function runGuidedNeed(
  input: InputEvent,
  snapshot: SessionSnapshot,
  push: (p: AgentProposal) => boolean,
  store: FixtureSessionStore,
  route: Route,
) {
  const text = input.text ?? "";
  const scenario = snapshot.scenarioId ?? inferScenario(text, snapshot).id;

  if (scenario === "cafe_dictation") {
    const st =
      parseSolutionType(text) ??
      (snapshot.preferences["solutionType"] as
        "headset" | "clip_on" | "directional_desktop" | undefined);
    const budget = parseBudget(text);
    const hard: Record<string, unknown> = {
      category: "audio",
      compatibility: parseCompatibility(text),
    };
    if (budget !== undefined) hard["budgetMinor"] = budget;
    if (/tomorrow|need it tomorrow/i.test(text)) hard["maxDeliveryDays"] = 1;

    push({
      ...baseProposal(input, "constraints"),
      action: "set_constraints",
      payload: {
        needs: ["noisy café dictation"],
        hardConstraints: hard,
        preferences: st ? { solutionType: st } : {},
        exclusions: /remove |not the |exclude /i.test(text)
          ? extractExclusion(text, snapshot)
          : [],
      },
      evidenceIds: [],
    });

    if (!st && route !== "strong_intent") {
      push(audioSolutionTypesProposal(baseProposal(input, "ask-type")));
      patchScenario(store, input.sessionId, "cafe_dictation");
      return;
    }
    if (!snapshot.buyingPriority && !parsePriority(text)) {
      push(audioPriorityProposal(baseProposal(input, "ask-priority")));
      patchScenario(store, input.sessionId, "cafe_dictation");
      return;
    }
    const priority =
      parsePriority(text) ?? snapshot.buyingPriority ?? "best_value";
    push({
      ...baseProposal(input, "priority"),
      action: "set_priority",
      payload: { priority },
      evidenceIds: [],
    });
    const snap = store.get(input.sessionId)!;
    const entries = buildAudioShortlist(
      snap,
      (snap.preferences["solutionType"] as typeof st) ?? st,
      priority,
    );
    push({
      ...baseProposal(input, "shortlist"),
      action: "shortlist",
      payload: { entries },
      evidenceIds: [],
    });
    if (hard["maxDeliveryDays"] === 1 && entries[0]) {
      const offers = offersForProduct(entries[0].productId);
      const fast = offers.find((o) => o.deliveryWindow?.latestOffsetDays === 1);
      if (fast) {
        push({
          ...baseProposal(input, "offer"),
          action: "select_offer",
          payload: { offerId: fast.id },
          evidenceIds: [],
        });
      }
    }
    patchScenario(store, input.sessionId, "cafe_dictation");
    return;
  }

  if (scenario === "bag_inspiration") {
    const prefs = parseBagPrefs(text);
    if (
      !prefs.shape &&
      !prefs.color &&
      !prefs.budgetMinor &&
      !prefs.needTomorrow &&
      !Object.keys(parseCompatibility(text)).length &&
      route !== "strong_intent"
    ) {
      push(bagClarifyShapeColour(baseProposal(input, "ask-bag")));
      patchScenario(store, input.sessionId, "bag_inspiration");
      return;
    }
    push({
      ...baseProposal(input, "constraints"),
      action: "set_constraints",
      payload: {
        needs: ["bag for work and gym"],
        hardConstraints: {
          ...(prefs.budgetMinor ? { budgetMinor: prefs.budgetMinor } : {}),
          ...(prefs.needTomorrow ? { maxDeliveryDays: 1 } : {}),
          category: "bags",
          compatibility: parseCompatibility(text),
          ...(/separate.*shoes?|shoe compartment/i.test(text)
            ? { requiredSpecifications: { separateShoeCompartment: true } }
            : {}),
        },
        preferences: {
          ...(prefs.color ? { color: prefs.color } : {}),
          ...(prefs.shape ? { shape: prefs.shape } : {}),
        },
      },
      evidenceIds: [],
    });
    const snap = store.get(input.sessionId)!;
    const discovery = buildBagDiscovery(snap);
    // Land on shortlist so the demo shows flying tiles + ranks. Offers come
    // from a deliberate next turn (“show offers” / select), not auto-jump.
    push({
      ...baseProposal(input, "shortlist"),
      action: "shortlist",
      payload: {
        entries: discovery.narrowed,
        closeMatches: discovery.closeMatches,
        relatedDiscoveries: discovery.related,
      },
      evidenceIds: [],
    });
    patchScenario(store, input.sessionId, "bag_inspiration");
    return;
  }

  // bedding
  const prefs = parseBeddingPrefs(text);
  if (
    !prefs.bedSize &&
    !prefs.budgetMinor &&
    !Object.keys(parseCompatibility(text)).length &&
    route !== "strong_intent"
  ) {
    push(beddingOpeningProposal(baseProposal(input, "ask-bed")));
    patchScenario(store, input.sessionId, "warm_bedding");
    return;
  }
  push({
    ...baseProposal(input, "constraints"),
    action: "set_constraints",
    payload: {
      needs: ["bedsheets for a warm room"],
      hardConstraints: {
        category: "bedding",
        compatibility: parseCompatibility(text),
        ...(/100\s*%?\s*(percent )?cotton/i.test(text)
          ? { requiredSpecifications: { cotton100Percent: true } }
          : {}),
        ...(prefs.budgetMinor ? { budgetMinor: prefs.budgetMinor } : {}),
      },
      preferences: {
        ...(prefs.material ? { material: prefs.material } : {}),
        ...(prefs.bedSize ? { bedSize: prefs.bedSize } : {}),
      },
    },
    evidenceIds: [],
  });
  const snap = store.get(input.sessionId)!;
  push({
    ...baseProposal(input, "shortlist"),
    action: "shortlist",
    payload: { entries: buildBeddingShortlist(snap) },
    evidenceIds: [],
  });
  patchScenario(store, input.sessionId, "warm_bedding");
}

function handleImage(
  input: InputEvent,
  snapshot: SessionSnapshot,
  push: (p: AgentProposal) => boolean,
  store: FixtureSessionStore,
  thread: SessionThread,
  correction: boolean,
) {
  const attachmentId =
    input.attachmentId ??
    snapshot.attachmentIds[0] ??
    PREPARED_ATTACHMENTS[0]?.id;
  if (!attachmentId) {
    push({
      ...baseProposal(input, "clarify"),
      action: "clarify",
      payload: {
        question:
          "I don't have an image attachment yet. You can use a prepared bag reference or upload one.",
      },
      evidenceIds: [],
    });
    return;
  }

  if (!correction) {
    push({
      ...baseProposal(input, "ask"),
      action: "clarify",
      payload: {
        question:
          "This is a prepared illustration, not a vision result. Which shape or colour do you like? Tell me the required dimensions, capacity and material; I cannot infer them from this image.",
      },
      evidenceIds: [],
    });
    return;
  }

  const prefs = parseBagPrefs(input.text ?? "");
  reduce(thread, {
    type: "image_correction",
    data: { attachmentId, correctedFields: prefs },
  });
  push({
    ...baseProposal(input, "correct"),
    action: "set_constraints",
    payload: {
      // Shape/colour are preferences only — never hard constraints on the authoritative store.
      hardConstraints: {
        ...(prefs.budgetMinor ? { budgetMinor: prefs.budgetMinor } : {}),
        category: "bags",
      },
      preferences: {
        ...(prefs.color ? { color: prefs.color } : {}),
        ...(prefs.shape ? { shape: prefs.shape } : {}),
        imageCorrection: true,
      },
    },
    evidenceIds: [],
  });
  const snap = store.get(input.sessionId)!;
  const discovery = buildBagDiscovery(snap);
  push({
    ...baseProposal(input, "shortlist"),
    action: "shortlist",
    payload: { entries: discovery.narrowed },
    evidenceIds: [],
  });
}

function inferScenario(
  text: string,
  snapshot: SessionSnapshot,
): { id: NonNullable<SessionSnapshot["scenarioId"]>; needs: string[] } {
  if (snapshot.scenarioId) {
    return { id: snapshot.scenarioId, needs: snapshot.needs };
  }
  if (/bag|backpack|gym|tote|sling/i.test(text)) {
    return { id: "bag_inspiration", needs: ["bag inspiration"] };
  }
  if (/sheet|bedding|linen|percale|mattress/i.test(text)) {
    return { id: "warm_bedding", needs: ["warm room bedding"] };
  }
  if (/mic|café|cafe|dictation|headset|noisy/i.test(text)) {
    return { id: "cafe_dictation", needs: ["café dictation"] };
  }
  // default opening — café is scenario 1
  return { id: "cafe_dictation", needs: [] };
}

function patchScenario(
  store: FixtureSessionStore,
  sessionId: string,
  scenarioId: NonNullable<SessionSnapshot["scenarioId"]>,
) {
  store.patch(sessionId, { scenarioId });
}

function patchStage(
  store: FixtureSessionStore,
  sessionId: string,
  stage: SessionSnapshot["scenarioStage"],
) {
  store.patch(sessionId, { scenarioStage: stage });
}

function pickCompareIds(
  input: InputEvent,
  snapshot: SessionSnapshot,
): string[] {
  const text = input.text ?? "";
  const order =
    input.visibleProductIds.length > 0
      ? input.visibleProductIds
      : snapshot.displayOrder;
  if (/\bfirst two\b|\bthe first two\b/i.test(text) && order.length >= 2) {
    return order.slice(0, 2);
  }
  const ids = order.filter((id) => text.toUpperCase().includes(id));
  if (ids.length >= 2) return ids.slice(0, 2);
  return order.slice(0, 2);
}

function extractExclusion(text: string, snapshot: SessionSnapshot): string[] {
  const ref = resolveReference(text, snapshot, snapshot.displayOrder);
  return ref.productId ? [ref.productId] : [];
}

function progressiveNotes(category: string, text: string): string {
  if (category === "audio") {
    return "Hearing-side ANC is distinct from microphone output processing; customer music/call reviews do not establish café dictation WER.";
  }
  if (category === "bags") {
    return "Style resemblance is tentative without attribution; no invented waterproofing or laptop fit.";
  }
  return "No unsupported cooling or health effects.";
}

// silence unused import in some paths
void KNOWN_LINKS;
