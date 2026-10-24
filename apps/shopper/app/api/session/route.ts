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
    const raw = await request.text();
    if (raw.length > 32768) throw new Error("Turn too large.");
    const b = JSON.parse(raw),
      i = b.input;
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
        });
      return NextResponse.json(project(sessionId));
    }
    if (b.action === "lifecycle") {
      const m = c.summary;
      if (!m || !i.summaryId) return NextResponse.json(project(sessionId));
      if (m.id !== i.summaryId || m.responseTurnId !== i.turnId)
        throw new Error("Stale playback.");
      if (i.type === "audio.started")
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
      const event = (
        {
          "audio.started": "playback_started",
          "audio.completed": "playback_completed",
          "audio.interrupted": "playback_interrupted",
        } as Record<string, string>
      )[i.type];
      if (!event) throw new Error("Unknown playback event.");
      store.acknowledge(sessionId, {
        summaryId: m.id,
        turnId: m.responseTurnId,
        textHash: m.textHash,
        event,
      });
      if (i.type !== "audio.started") playbacks.delete(sessionId);
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
    const exact = text.match(
      /^(Focus|Save|Remove|Show offers for|Show reviews for|Select offer) ([A-Z0-9-]+)$/i,
    );
    const simple =
      /^(Compare the first two|Back to shortlist|Show saved choices|Review summary|Prepare summary)$/i.test(
        text,
      );
    const confirm = /^confirm (?:this )?simulated purchase[.!]?$/i.test(text);
    if (exact || simple || confirm) {
      // Typed confirmation is validated against stored input, not model-produced text.
      if (confirm && input.modality !== "text")
        throw new Error(
          "Voice purchase approval awaits the trusted live voice adapter. Choose text mode, review summary again, then type Confirm this simulated purchase.",
        );
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
      if (confirm)
        store.confirmText({
          ...input,
          text: "Confirm this simulated purchase",
        });
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
      else if (/^show saved/i.test(text)) propose({ stage: "saved_choice" });
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
