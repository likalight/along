import { NextResponse } from "next/server";
import { agreedCatalog } from "@coupang/contract";
import { getRuntime } from "@/lib/integration/runtime";
import { authorize, assertOrigin } from "@/lib/integration/access";
import { project, messages } from "@/lib/integration/projection";
import type { Input } from "@/lib/session/contract";
export const runtime = "nodejs";
const playbacks = new Map<
  string,
  { summaryId: string; turnId: string; epoch: number; playbackId: string }
>();
export async function POST(request: Request) {
  let id: string | undefined,
    authenticated = false;
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
      return NextResponse.json(
        { error: "Turn too large." },
        { status: 413 },
      );
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
    if (b.action === "cancel") {
      // Client sends cancellation only for actual in-flight work, never ordinary typing.
      if (c.turn?.id === i.turnId && c.turn?.status === "active" && !c.receipt)
        store.core.cancel(sessionId, i.turnId);
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
    const focus =
      c.view?.focusProductId ??
      agreedCatalog.offers.find((o: any) => o.id === c.selection?.offerId)
        ?.productId ??
      c.shortlist[0];
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
    const removeReference = text.match(
      /^Remove reference ([A-Za-z0-9._:-]+)$/i,
    );
    if (removeReference) {
      store.ingestInput({ ...input, text });
      store.removeAttachment(sessionId, removeReference[1]);
      messages.set(sessionId, "Removed that reference.");
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
    const confirm = /^confirm (?:this )?simulated purchase[.!]?$/i.test(text);
    if (exact || simple || confirm) {
      // Confirmation is validated against stored shopper input, never model-produced text.
      store.ingestInput({
        ...input,
        text: confirm ? "Confirm this simulated purchase" : text,
      });
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
      if (confirm) {
        const confirmInput = {
          ...input,
          text: "Confirm this simulated purchase",
        };
        if (input.modality === "voice") {
          const evidence = b.voiceEvidence;
          if (
            !evidence ||
            typeof evidence !== "object" ||
            evidence.final !== true ||
            evidence.source !== "shopper" ||
            evidence.echoDetected === true ||
            typeof evidence.confidence !== "number" ||
            evidence.confidence < 0.9
          ) {
            throw new Error(
              "Voice purchase approval requires trusted live voice evidence (final, non-echo, confidence ≥ 0.9). Choose text mode, review the summary again, then type Confirm this simulated purchase.",
            );
          }
          store.confirmVoice(confirmInput, {
            transcript: "Confirm this simulated purchase",
            final: true,
            confidence: evidence.confidence,
            source: "shopper",
            echoDetected: false,
          });
        } else if (input.modality === "text") {
          store.confirmText(confirmInput);
        } else {
          throw new Error(
            "Only deliberate voice or text confirmation can approve a simulated purchase.",
          );
        }
      }
      else if (exact) {
        const action = exact[1].toLowerCase(),
          pid = exact[2].toUpperCase();
        if (action === "select offer") {
          apply("select_offer", { offerId: pid });
          apply("prepare_summary");
        } else if (action === "focus") apply("focus", { productId: pid });
        else if (action === "save") apply("save", { productId: pid });
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
      const spoken = result.speakable.map((x) => x.content).join(" ");
      if (spoken) messages.set(sessionId, spoken);
    }
    const snapshot = project(sessionId);
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
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Unable to update session.",
        ...(authenticated && id ? { snapshot: project(id) } : {}),
      },
      { status: authenticated ? 409 : 403 },
    );
  }
}
