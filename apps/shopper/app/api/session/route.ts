import {
  beginActivity,
  readActivity,
  updateActivity,
  turnHeadings,
} from "@/lib/integration/activity";
import { NextResponse } from "next/server";
import {
  parseProductNavigation,
  resolveProductNavigation,
} from "@coupang/agent";
import { agreedCatalog } from "@coupang/contract";
import { getRuntime, narrationSegments } from "@/lib/integration/runtime";
import { authorize, assertOrigin } from "@/lib/integration/access";
import { project, messages } from "@/lib/integration/projection";
import type { Input } from "@/lib/session/contract";
import { consumeVoiceEvidence } from "@/lib/voice/server";
import {
  classifyCheckoutReply,
  isLiveDemoConfirmation,
} from "@concierge/backend/store";
export const runtime = "nodejs";
const playbacks = new Map<
  string,
  { summaryId: string; turnId: string; epoch: number; playbackId: string }
>();
export async function POST(request: Request) {
  let id: string | undefined,
    authenticated = false;
  let activityIdentity: { epoch: number; turnId: string } | undefined;
  const { store, orch } = getRuntime();
  try {
    assertOrigin(request);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "JSON body required." },
        { status: 415 },
      );
    }
    const raw = await request.text();
    if (raw.length > 32768) {
      return NextResponse.json({ error: "Turn too large." }, { status: 413 });
    }
    let b: Record<string, any>;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "Invalid request shape." },
          { status: 400 },
        );
      }
      b = parsed;
    } catch {
      return NextResponse.json({ error: "Malformed JSON." }, { status: 400 });
    }
    const i = b.input;
    id = b.action === "connect" ? b.sessionId : i?.sessionId;
    if (b.action === "connect" && !id) {
      const s = orch.createSession();
      const res = NextResponse.json(project(s.sessionId));
      res.cookies.set(
        `along-session-${s.sessionId}`,
        store.accessToken(s.sessionId)!,
        {
          httpOnly: true,
          sameSite: "strict",
          secure: new URL(request.url).protocol === "https:",
          path: "/",
          maxAge: 7200,
        },
      );
      return res;
    }
    authorize(request, id!);
    authenticated = true;
    const sessionId = id!,
      c = store.core.get(sessionId);
    if (b.action === "connect") return NextResponse.json(project(sessionId));
    if (!i || i.epoch !== c.epoch || typeof i.turnId !== "string")
      throw new Error("Stale session identity; reconnect.");
    if (b.action === "activity") {
      return NextResponse.json({
        activity:
          c.turn?.id === i.turnId
            ? readActivity(sessionId, c.epoch, i.turnId)
            : null,
      });
    }
    if (b.action === "cancel") {
      // Client sends cancellation only for actual in-flight work, never ordinary typing.
      if (
        c.turn?.id === i.turnId &&
        c.turn?.status === "active" &&
        !c.receipt
      ) {
        updateActivity(sessionId, c.epoch, i.turnId, {
          phase: "done",
          label: "Stopped. Ready when you are.",
        });
        await orch.bargeIn(sessionId, i.turnId);
        if (store.core.get(sessionId).turn?.status === "active")
          store.core.cancel(sessionId, i.turnId);
      }
      return NextResponse.json(project(sessionId));
    }
    if (b.action === "mode") {
      if (!c.receipt) store.core.switchMode(sessionId, i.revision, b.mode);
      return NextResponse.json(project(sessionId));
    }
    if (b.action === "presented") {
      const m = c.summary;
      if (
        !m ||
        b.summaryId !== m.id ||
        b.textHash !== m.textHash ||
        i.turnId !== m.responseTurnId
      )
        throw new Error("Summary changed; review the current one.");
      if (!m.displayed)
        store.acknowledge(sessionId, {
          summaryId: m.id,
          turnId: m.responseTurnId,
          textHash: m.textHash,
          event: "displayed",
          epoch: c.epoch,
          eventId: i.eventId ?? `presented-${m.id}`,
          expectedRevision: c.revision,
          summaryRevision: m.revision,
        });
      return NextResponse.json(project(sessionId));
    }
    if (b.action === "lifecycle") {
      const type = i.type as string;
      // A receipt may be narrated, but its committed order cannot be mutated by
      // subsequent audio lifecycle acknowledgments.
      if (c.receipt) return NextResponse.json(project(sessionId));
      if (type === "video.started" || type === "video.stopped") {
        store.lifecycle(sessionId, {
          sessionId,
          epoch: i.epoch,
          eventId: i.eventId ?? crypto.randomUUID(),
          turnId: i.turnId,
          revision: i.revision ?? c.revision,
          type,
          playbackId: i.playbackId,
          videoId: i.videoId,
        });
        return NextResponse.json(project(sessionId));
      }
      if (type === "turn.cancelled") {
        store.lifecycle(sessionId, {
          sessionId,
          epoch: i.epoch,
          eventId: i.eventId ?? crypto.randomUUID(),
          turnId: i.turnId,
          revision: i.revision ?? c.revision,
          type,
          playbackId: i.playbackId ?? "cancel",
        });
        return NextResponse.json(project(sessionId));
      }
      const m = c.summary;
      if (!m || !i.summaryId) return NextResponse.json(project(sessionId));
      if (m.id !== i.summaryId || m.responseTurnId !== i.turnId)
        throw new Error("Stale playback.");
      if (!i.playbackId || typeof i.playbackId !== "string")
        throw new Error("Playback identity required.");
      if (type === "audio.started")
        playbacks.set(sessionId, {
          summaryId: m.id,
          turnId: i.turnId,
          epoch: c.epoch,
          playbackId: i.playbackId,
        });
      const active = playbacks.get(sessionId);
      if (
        !active ||
        active.playbackId !== i.playbackId ||
        active.summaryId !== m.id ||
        active.epoch !== c.epoch
      )
        throw new Error("Unknown playback.");
      store.lifecycle(sessionId, {
        sessionId,
        epoch: i.epoch,
        eventId: i.eventId ?? crypto.randomUUID(),
        turnId: i.turnId,
        revision: i.revision ?? c.revision,
        type,
        playbackId: i.playbackId,
        summaryId: m.id,
        summaryRevision: m.revision,
      });
      if (type !== "audio.started") playbacks.delete(sessionId);
      return NextResponse.json(project(sessionId));
    }
    if (b.action !== "input") throw new Error("Unsupported action.");
    const input: Input = {
      sessionId: i.sessionId,
      epoch: i.epoch,
      turnId: i.turnId,
      eventId: i.eventId,
      baseRevision: i.baseRevision,
      modality: i.modality,
      text: i.text,
      attachmentId: i.attachmentId,
      visibleRevision: i.visibleRevision,
      visibleProductIds: i.visibleProductIds,
    };
    if (input.attachmentId === undefined) delete input.attachmentId;
    if (input.text === undefined) delete input.text;
    if (
      typeof input.eventId !== "string" ||
      !Number.isInteger(input.baseRevision) ||
      !Array.isArray(input.visibleProductIds) ||
      !["voice", "text", "image", "link"].includes(input.modality) ||
      (input.text !== undefined &&
        (typeof input.text !== "string" || input.text.length > 4000))
    )
      throw new Error("Invalid input.");
    if (input.modality === "link") {
      if (
        !agreedCatalog.knownLinks.some((l: any) => l.url === input.attachmentId)
      )
        throw new Error("Unknown reference link.");
      input.text = input.attachmentId;
      delete input.attachmentId;
    }
    let text = input.text?.trim() ?? "";
    // The browser supplies only provider identities. Transcript quality and
    // finality come from the authenticated server sideband, never request flags.
    const trustedVoice =
      input.modality === "voice" && b.voiceEvidence
        ? await consumeVoiceEvidence(sessionId, b.voiceEvidence, text)
        : null;
    const checkoutReply = classifyCheckoutReply(text);
    // A retained review is not the current referent after navigation. In
    // particular, "buy this" on another product must not approve the old order.
    const reviewInView = Boolean(c.summary && c.stage === "summary");
    const selectedProductId = agreedCatalog.offers.find(
      (offer: any) => offer.id === c.selection?.offerId,
    )?.productId;
    const focus = c.view?.focusProductId ?? selectedProductId ?? c.shortlist[0];
    // A short assent answers the order question only on that summary's own
    // response turn. A later discussion cannot borrow its approval context.
    const orderQuestionActive = Boolean(
      reviewInView &&
      c.summary?.displayed &&
      c.summary.presentationMode === "text" &&
      c.summary.responseTurnId === c.turn?.id &&
      input.modality === "text",
    );
    // A purchase request advances the current checkout stage. Before a review
    // exists it means "prepare this order", not an invalid approval attempt.
    const confirm =
      reviewInView && isLiveDemoConfirmation(text, orderQuestionActive);
    const prepareCheckout =
      checkoutReply === "approve" &&
      !reviewInView &&
      Boolean(c.selection?.offerId) &&
      selectedProductId === focus;
    const confirmationAttempt =
      confirm ||
      (reviewInView &&
        (checkoutReply === "assent" || /\bconfirm(?:ation)?\b/i.test(text)));
    if (confirmationAttempt) {
      // Validate before ingestInput: beginning an unready voice turn invalidates
      // its summary. A failed/ambiguous confirmation must keep the review visible.
      if (!confirm)
        throw new Error(
          "Your order details are still here. Would you like me to place this order, or is there something you want to change?",
        );
      if (!c.summary || !c.summary.displayed)
        throw new Error(
          "Review the order details on screen before confirming.",
        );
      if (
        input.modality === "voice" &&
        (!trustedVoice || trustedVoice.confidence < 0.9)
      )
        throw new Error(
          "That spoken confirmation could not be verified. Your order details are still here; use the confirmation controls to continue.",
        );
      if (
        !c.summary.approvalNonce ||
        c.summary.presentationMode !== input.modality
      )
        throw new Error(
          "Your order details are still here. Complete the current review or switch to text confirmation before confirming.",
        );
    }
    // Direction cards have their own stable order. Let the shopping agent
    // resolve those choices instead of focusing a nonexistent product card.
    const navigation =
      c.stage === "solution_types" ? null : parseProductNavigation(text);
    // Navigation uses the same authenticated input and authoritative focus path.
    // Never send compound shopping instructions through this shortcut.
    if (navigation)
      text = `Focus ${resolveProductNavigation(store.get(sessionId)!, navigation)}`;
    if (/^show offers$/i.test(text) && focus) text = `Show offers for ${focus}`;
    if (/^(compare|compare them)$/i.test(text)) text = "Compare the first two";
    if (/^save for later$/i.test(text) && focus) text = `Save ${focus}`;
    // Natural-language offer pick from the focused product's quote set.
    if (
      /^(choose|select)\s+(faster|cheaper|earlier|lower[- ]cost)\s+offer$/i.test(
        text,
      ) &&
      focus
    ) {
      const quotes = store
        .quotes(sessionId, focus)
        .filter((q) => q.eligible && q.offer);
      const faster = /faster|earlier/i.test(text);
      const offerTotal = (q: (typeof quotes)[number]): number => {
        const o = q.offer as {
          unitPrice?: number | null;
          shipping?: number | null;
          setupCost?: number | null;
          otherFees?: number | null;
          totalMinor?: number | null;
        };
        if (typeof o.totalMinor === "number") return o.totalMinor;
        const parts = [o.unitPrice, o.shipping, o.setupCost, o.otherFees];
        let sum = 0;
        for (const part of parts) {
          if (typeof part !== "number" || part < 0)
            return Number.POSITIVE_INFINITY;
          sum += part;
        }
        return sum;
      };
      const deliveryRank = (q: (typeof quotes)[number]): number => {
        const o = q.offer as {
          deliveryDays?: number | null;
          deliveryWindow?: { latest?: string };
        };
        if (typeof o.deliveryDays === "number") return o.deliveryDays;
        const latest = o.deliveryWindow?.latest;
        const t = latest ? Date.parse(latest) : Number.NaN;
        return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
      };
      const ranked = [...quotes].sort((a, b) => {
        if (faster)
          return (
            deliveryRank(a) - deliveryRank(b) || offerTotal(a) - offerTotal(b)
          );
        return offerTotal(a) - offerTotal(b);
      });
      const picked = ranked[0];
      if (picked?.offer?.id) text = `Select offer ${picked.offer.id}`;
    }
    activityIdentity = { epoch: input.epoch, turnId: input.turnId };
    const removeReference = text.match(
      /^Remove reference ([A-Za-z0-9._:-]+)$/i,
    );
    if (removeReference) {
      store.ingestInput({ ...input, text });
      beginActivity(sessionId, input.epoch, input.turnId);
      store.removeAttachment(sessionId, removeReference[1]);
      messages.set(sessionId, "Removed that reference.");
      turnHeadings.set(sessionId, "Reference removed.");
      updateActivity(sessionId, input.epoch, input.turnId, {
        phase: "done",
        label: "Ready when you are.",
        heading: "Reference removed.",
      });
      const removed = project(sessionId);
      return NextResponse.json({
        sessionId,
        epoch: removed.epoch,
        turnId: input.turnId,
        eventId: input.eventId,
        revision: removed.revision,
        type: "session.updated",
        snapshot: removed,
      });
    }
    const exact = text.match(
      /^(Focus|Save|Remove|Show offers for|Show reviews for|(?:Select|Choose) offer) ([A-Z0-9-]+)$/i,
    );
    const simple =
      /^(Compare the first two|Back to shortlist|Restore shortlist|Show saved choices|Review summary|Prepare summary)$/i.test(
        text,
      );
    if (exact || simple || confirm || prepareCheckout) {
      // Confirmation is validated against stored shopper input, never model-produced text.
      store.ingestInput({
        ...input,
        text: confirm ? "Confirm this simulated purchase" : text,
      });
      beginActivity(sessionId, input.epoch, input.turnId);
      const apply = (action: any, payload: Record<string, unknown> = {}) => {
        const r = store.apply({
          sessionId,
          epoch: input.epoch,
          eventId: crypto.randomUUID(),
          turnId: input.turnId,
          baseRevision: store.get(sessionId)!.revision,
          action,
          payload,
          evidenceIds: [],
        });
        messages.set(sessionId, r.speakable.content);
        if (!r.ok) throw new Error(r.reason);
      };
      const propose = (p: Record<string, unknown>) =>
        store.core.propose(sessionId, {
          expectedRevision: store.get(sessionId)!.revision,
          turnId: input.turnId,
          ...p,
        });
      if (prepareCheckout) {
        apply("prepare_summary");
      } else if (confirm) {
        const confirmInput = {
          ...input,
          text: "Confirm this simulated purchase",
        };
        if (input.modality === "voice") {
          const evidence = trustedVoice;
          if (!evidence || evidence.confidence < 0.9) {
            throw new Error(
              "That spoken approval could not be verified clearly enough. Please speak the confirmation again, or choose text mode and review the summary before confirming.",
            );
          }
          store.confirmVoice(confirmInput, {
            ...evidence,
            // Canonical intent alias; finality and quality remain the actual
            // server-observed provider evidence consumed against the raw text.
            transcript: "Confirm this simulated purchase",
          });
        } else if (input.modality === "text") {
          store.confirmText(confirmInput);
        } else {
          throw new Error(
            "Only deliberate voice or text confirmation can approve a simulated purchase.",
          );
        }
      } else if (exact) {
        const action = exact[1].toLowerCase(),
          pid = exact[2].toUpperCase();
        if (action === "select offer" || action === "choose offer") {
          apply("select_offer", { offerId: pid });
          apply("prepare_summary");
        } else if (action === "focus") {
          apply("focus", { productId: pid });
          {
            const product = agreedCatalog.products.find(
              (p: any) => p.id === pid,
            );
            messages.set(
              sessionId,
              `Here’s ${product ? `${product.brand} ${product.model}` : "that option"}.`,
            );
          }
        } else if (action === "save") apply("save", { productId: pid });
        else if (action === "remove") {
          propose({
            excludedProductIds: [...c.excludedProductIds, pid],
            shortlist: c.shortlist.filter((x) => x !== pid),
          });
          messages.set(sessionId, "Removed from your shortlist.");
        } else {
          apply("focus", { productId: pid });
          if (action === "show offers for") propose({ stage: "offers" });
          else
            apply("show_evidence", {
              evidenceIds:
                agreedCatalog.products.find((p: any) => p.id === pid)
                  ?.evidenceIds ?? [],
            });
        }
      } else if (/^compare/i.test(text))
        apply("compare", { productIds: c.shortlist.slice(0, 2) });
      else if (/^restore shortlist$/i.test(text)) {
        const candidates = [
          ...new Set([...c.displayOrder, ...c.excludedProductIds]),
        ];
        // Undo explicit removals, but never undo a revised budget, fit or deadline.
        propose({ excludedProductIds: [] });
        const restored = candidates
          .filter((pid) =>
            store.quotes(sessionId, pid).some((quote) => quote.eligible),
          )
          .slice(0, 3);
        propose({ shortlist: restored, stage: "shortlist", comparisonIds: [] });
        messages.set(
          sessionId,
          restored.length
            ? "Restored available choices that still meet your current requirements."
            : "Removals are undone, but none of those choices meets your current requirements.",
        );
      } else if (/^show saved/i.test(text)) propose({ stage: "saved_choice" });
      else if (/^back/i.test(text)) propose({ stage: "shortlist" });
      else apply("prepare_summary");
    } else {
      const result = await orch.handleInput(input);
      if (
        !result.cancelled &&
        store.core.get(sessionId).turn?.id === input.turnId &&
        result.heading
      )
        turnHeadings.set(sessionId, result.heading);
      const spoken = result.speakable.map((x) => x.content).join(" ");
      if (
        !result.cancelled &&
        store.core.get(sessionId).turn?.id === input.turnId
      ) {
        if (spoken) messages.set(sessionId, spoken);
        const segments = result.narrationSegments;
        if (
          segments?.length &&
          segments.map((segment) => segment.text).join(" ") === spoken
        ) {
          narrationSegments.set(sessionId, {
            turnId: input.turnId,
            revision: store.get(sessionId)!.revision,
            segments,
          });
        } else narrationSegments.delete(sessionId);
      }
    }
    // Only the owning turn may publish its final heading or progress.
    const currentTurn = store.core.get(sessionId).turn?.id;
    if (
      currentTurn === input.turnId &&
      (exact || simple || confirm || prepareCheckout)
    ) {
      const actionHeading = confirm
        ? "Your order is confirmed."
        : /^compare/i.test(text)
          ? "Your options, side by side."
          : prepareCheckout || /summary|offer/i.test(text)
            ? "Let’s check the details."
            : /^save/i.test(text)
              ? "Saved for later."
              : /^remove/i.test(text)
                ? "Your updated choices."
                : "A closer look at your choices.";
      turnHeadings.set(sessionId, actionHeading);
    }
    const snapshot = project(sessionId);
    if (currentTurn === input.turnId) {
      if (!readActivity(sessionId, input.epoch, input.turnId))
        beginActivity(sessionId, input.epoch, input.turnId);
      updateActivity(sessionId, input.epoch, input.turnId, {
        phase: "done",
        label: "Ready when you are.",
        heading: snapshot.heading,
      });
    }
    return NextResponse.json({
      sessionId,
      epoch: snapshot.epoch,
      turnId: input.turnId,
      eventId: input.eventId,
      revision: snapshot.revision,
      type: "session.updated",
      snapshot,
    });
  } catch (e) {
    if (authenticated && id && activityIdentity)
      updateActivity(id, activityIdentity.epoch, activityIdentity.turnId, {
        phase: "error",
        label: "Something went wrong. Please try again.",
        heading: "Let’s try that again.",
      });
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Unable to update session.",
        ...(authenticated && id ? { snapshot: project(id) } : {}),
      },
      { status: authenticated ? 409 : 403 },
    );
  }
}
