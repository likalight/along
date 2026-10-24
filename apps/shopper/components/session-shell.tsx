"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
} from "motion/react";
import {
  ArrowUp,
  ArrowUpRight,
  Mic,
  Pause,
  RotateCcw,
  Keyboard,
  ArrowRight,
  Check,
  MessageSquare,
} from "lucide-react";
import { SessionController } from "@/lib/session/controller";
import { httpTransport } from "@/lib/session/http-transport";
import { BrowserSpeechAdapter } from "@/lib/voice/browser-adapter";
import { createSpeechAdapter } from "@/lib/voice/create-speech-adapter";
import { ProductCanvas } from "./canvas/ProductCanvas";
import { VoiceOrb } from "./voice-orb";
import { Attachments } from "./attachments";
import { ExtensionCompanion, DiscoveryContext } from "./extension-companion";
import type { Session, VoiceStatus } from "@/lib/session/contract";
const statusLabels: Record<VoiceStatus, string> = {
  ready: "Ready when you are",
  listening: "Listening · microphone on",
  thinking: "Thinking · microphone off",
  speaking: "Speaking · microphone off",
  paused: "Paused · microphone off",
  reconnecting: "Reconnecting · microphone off",
  error: "Needs attention · microphone off",
};
export function SessionShell() {
  const [controller] = useState(
    () => new SessionController(httpTransport, new BrowserSpeechAdapter()),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const [draft, setDraft] = useState("");
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLElement>(null);
  const acknowledgeSummary = useCallback(() => {
    void controller.presentSummary();
  }, [controller]);
  const s = state.snapshot,
    opening = !s || s.view === "opening";
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const query = new URL(window.location.href).searchParams;
      const resume =
        query.get("discoverySession") ??
        sessionStorage.getItem("along.sessionId");
      await controller.connect(
        resume && /^[A-Za-z0-9_-]{1,100}$/.test(resume) ? resume : undefined,
      );
      const sessionId = controller.getSnapshot().snapshot?.sessionId;
      if (!sessionId || cancelled) return;
      const { adapter, kind, note } = await createSpeechAdapter(sessionId);
      if (cancelled) {
        adapter.dispose();
        return;
      }
      controller.setSpeechAdapter(adapter, kind);
      setVoiceNote(note ?? (kind === "live" ? null : null));
    })();
    const offline = () => controller.interrupt();
    const online = () => void controller.reconnect();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") controller.interrupt();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("keydown", key);
    return () => {
      cancelled = true;
      controller.interrupt();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("keydown", key);
    };
  }, [controller]);
  useEffect(() => {
    if (s?.sessionId) sessionStorage.setItem("along.sessionId", s.sessionId);
  }, [s?.sessionId]);
  useEffect(() => {
    // Announce new stages without pulling focus away from an in-progress message.
    if (s?.view && document.activeElement === document.body)
      stageRef.current?.focus({ preventScroll: true });
  }, [s?.view]);
  async function submit() {
    if (!draft.trim()) return;
    const text = draft;
    setDraft("");
    await controller.send(text, "text");
  }
  return (
    <MotionConfig reducedMotion="user">
      <div className="shell">
        <header className="topbar">
          <a href="/" className="wordmark" aria-label="Along home">
            <span className="brand-mark">a</span>along
            <span className="brand-dot">.</span>
          </a>
          <span className="demo-badge">
            <span /> A shopping conversation <i>·</i> Research catalog ·
            simulated offers
          </span>
          <a
            className="private-note"
            href="/extension"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chrome companion <ArrowUpRight size={12} />
          </a>
        </header>
        <ExtensionCompanion
          controller={controller}
          state={state}
          hasDraft={Boolean(draft.trim())}
        />
        <main className={opening ? "main opening" : "main active"}>
          <aside className="voice-anchor" aria-label="Voice session">
            <VoiceOrb
              status={state.status}
              capturing={state.capturing}
              compact={!opening}
            />
            <div className="voice-status" role="status" aria-live="polite">
              <span className={state.capturing ? "live-dot" : "status-dot"} />
              {state.capturing
                ? statusLabels.listening
                : state.status === "listening"
                  ? "Ready · microphone off"
                  : statusLabels[state.status]}
            </div>
            {!opening && (
              <p className="anchor-note">
                You lead.
                <br />
                I’ll keep up.
              </p>
            )}
          </aside>
          <section
            className="stage"
            tabIndex={-1}
            ref={stageRef}
            aria-label="Shopping conversation"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={s?.view ?? "opening"}
                initial={
                  reduced || s?.view === "summary" || s?.view === "receipt"
                    ? false
                    : { opacity: 0, y: 16 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <p className="eyebrow">
                  {opening
                    ? "YOUR NEXT GOOD FIND"
                    : s?.view === "receipt"
                      ? "SIMULATED RECEIPT"
                      : s?.view === "recovery"
                        ? "RECOVERY"
                        : `THE CONVERSATION / ${s?.view.replaceAll("_", " ")}`}
                </p>
                {(!s?.canvas ||
                  s?.discoveryReference ||
                  ["opening", "summary", "receipt", "recovery"].includes(
                    s.view,
                  )) && (
                  <h1 aria-live="polite" aria-atomic="true">
                    {s?.heading ?? "A little conversation.\nA better choice."}
                  </h1>
                )}
                {s?.view !== "summary" &&
                  (!s?.canvas ||
                    s?.discoveryReference ||
                    opening ||
                    s.view === "receipt" ||
                    s.view === "recovery") && (
                    <p className="stage-message">
                      {s?.message ??
                        "Tell me what you’re looking for, or start with a problem you’d like to solve."}
                    </p>
                  )}
                {opening && (
                  <div className="opening-invitation">
                    <span className="invitation-line" />
                    <span>Something in mind? Something to figure out?</span>
                  </div>
                )}
                {s && (
                  <ContentStage
                    session={s}
                    busy={state.status === "thinking"}
                    onSummaryDisplayed={acknowledgeSummary}
                    onChooseText={() => void controller.chooseMode("text")}
                    onMediaEvent={(event) =>
                      void controller.handleMediaEvent(event)
                    }
                    onCommand={(command) =>
                      void controller.send(command, "text")
                    }
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </section>
          <section
            className="conversation-controls"
            aria-label="Conversation controls"
          >
            {state.error && (
              <div className="error-banner" role="alert">
                <p>{state.error}</p>
                <button onClick={() => void controller.reconnect()}>
                  <RotateCcw size={14} /> Reconnect
                </button>
              </div>
            )}
            <div className="primary-controls">
              {state.status === "thinking" ||
              state.status === "speaking" ||
              state.capturing ? (
                <button
                  className="primary-button"
                  onClick={() => controller.interrupt()}
                >
                  <Pause size={17} />{" "}
                  {state.capturing ? "Pause microphone" : "Interrupt response"}
                  <span className="key-hint">esc</span>
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={!s || state.status === "reconnecting"}
                  onClick={() => void controller.chooseMode("voice")}
                >
                  <Mic size={17} />
                  {opening ? "Start Chat" : "Speak / interrupt"}
                  <ArrowUpRight size={16} />
                </button>
              )}
              <button
                className="text-button"
                disabled={!s || state.status === "reconnecting"}
                onClick={() => void controller.chooseMode("text")}
              >
                <Keyboard size={17} />
                {state.mode === "text"
                  ? "Text mode · microphone off"
                  : "I’d rather type"}
              </button>
            </div>
            {state.mode === "text" && (
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <label className="sr-only" htmlFor="turn">
                  Your message
                </label>
                <input
                  id="turn"
                  value={draft}
                  maxLength={4000}
                  placeholder={
                    s?.view === "summary"
                      ? "Type “Confirm this simulated purchase” to approve"
                      : "Tell me what you have in mind…"
                  }
                  onChange={(e) => {
                    controller.draftChanged();
                    setDraft(e.target.value);
                  }}
                />
                <button
                  className="send-button"
                  type="submit"
                  aria-label="Send message"
                  disabled={!draft.trim() || !s}
                >
                  <ArrowUp size={19} />
                </button>
              </form>
            )}
            <p className="voice-help">
              {controller.speechKind === "live"
                ? state.mode === "voice"
                  ? "GPT-Live duplex connected · barge-in cancels stale narration. Interrupt with the control or Esc."
                  : "Start Chat activates GPT-Live. Typing still receives spoken replies."
                : state.mode === "voice"
                  ? "Browser speech fallback · half duplex, microphone pauses during narration. Interrupt with the control or Esc."
                  : "Start Chat asks for microphone access. Typing is always optional."}
              {voiceNote ? ` ${voiceNote}` : ""}
            </p>
            {s && (
              <Attachments
                key={`${s.sessionId}:${s.epoch}`}
                sessionId={s.sessionId}
                onInterrupt={controller.interrupt}
                onRemove={(a) => {
                  // Always tell the session — even if the share response has not
                  // landed yet — so a late accept cannot leave a ghost attachment.
                  void controller.send(`Remove reference ${a.id}`, "text");
                }}
                onUse={(a) =>
                  void controller.send(
                    "",
                    state.mode === "voice" ? "voice" : "text",
                    a,
                  )
                }
              />
            )}
          </section>
          {s && s.history.length > 0 && (
            <details className="transcript">
              <summary>
                <MessageSquare size={15} /> Conversation transcript{" "}
                <span>
                  {s.history.filter((h) => h.role === "user").length} turns
                </span>
              </summary>
              <ol>
                {s.history.map((entry, i) => (
                  <li key={i}>
                    <span>{entry.role === "user" ? "You" : "Along"}</span>
                    <p>{entry.text}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </main>
        <footer>
          <span>Voice, text, or a little inspiration.</span>
          <span>Demo data only. Purchases are simulated.</span>
        </footer>
      </div>
    </MotionConfig>
  );
}
function ContentStage({
  session: s,
  onCommand,
  onSummaryDisplayed,
  onChooseText,
  onMediaEvent,
  busy,
}: {
  session: Session;
  onCommand: (text: string) => void;
  onSummaryDisplayed: () => void;
  onChooseText: () => void;
  onMediaEvent: (event: {
    sessionId: string;
    epoch: number;
    turnId: string;
    revision: number;
    playbackId: string;
    type: "video.started" | "video.stopped";
    videoId?: string;
    takeaway?: string;
  }) => void;
  busy: boolean;
}) {
  const reduced = useReducedMotion();
  const presented = useRef<string | null>(null);
  useEffect(() => {
    if (
      s.view === "summary" &&
      s.summary?.textHash &&
      presented.current !== s.summaryId
    ) {
      presented.current = s.summaryId;
      onSummaryDisplayed();
    }
  }, [s.view, s.summaryId, onSummaryDisplayed]);
  return (
    <>
      {s.discoveryReference && !["summary", "receipt"].includes(s.view) && (
        <DiscoveryContext
          reference={s.discoveryReference}
          onCommand={onCommand}
        />
      )}
      {s.needs.length > 0 && s.view !== "summary" && (
        <div className="preferences">
          <span>
            {s.category === "audio"
              ? "Audio accessories"
              : s.category === "bags"
                ? "Everyday bags"
                : "Bedsheet sets"}
          </span>
          {s.preferences.slice(-2).map((p, i) => (
            <span key={i}>{p}</span>
          ))}
        </div>
      )}
      {s.canvas &&
        s.catalog &&
        !s.discoveryReference &&
        !["opening", "summary", "receipt", "recovery"].includes(s.view) && (
          <ProductCanvas
            busy={busy}
            snapshot={{ ...s, canvas: s.canvas }}
            data={s.catalog}
            onMediaEvent={(event) =>
              onMediaEvent({
                sessionId: event.sessionId,
                epoch: event.epoch,
                turnId: event.turnId,
                revision: event.revision,
                playbackId: event.playbackId,
                type: event.type,
                takeaway: event.takeaway,
              })
            }
            onIntent={(intent) => onCommand(intent.text)}
          />
        )}
      {!s.canvas && s.cards.length > 0 && (
        <div className={`stage-cards ${s.cards.length === 1 ? "single" : ""}`}>
          {s.cards.map((c, i) => (
            <motion.article
              key={c.id}
              className={`stage-card ${c.kind}`}
              initial={
                reduced
                  ? false
                  : {
                      opacity: 0,
                      y: 28,
                      rotateY: s.view === "shortlist" ? 12 : 0,
                    }
              }
              animate={{ opacity: 1, y: 0, rotateY: 0 }}
              transition={{ delay: reduced ? 0 : i * 0.06, duration: 0.35 }}
            >
              <div className="card-top">
                <span className={`card-number rank-${i}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="card-type">
                  {c.kind === "product"
                    ? "Synthetic product"
                    : c.kind === "offer"
                      ? "Proxy offer"
                      : "Solution type"}
                </span>
              </div>
              <h2>{c.title}</h2>
              <p className="card-subtitle">{c.subtitle}</p>
              <p>{c.detail}</p>
              {c.price && <strong className="card-price">{c.price}</strong>}
              <button onClick={() => onCommand(c.command)}>
                {c.kind === "offer"
                  ? "Review full summary"
                  : "Explore this direction"}
                <ArrowRight size={16} />
              </button>
            </motion.article>
          ))}
        </div>
      )}
      {!s.canvas && s.view === "buying_priorities" && (
        <div className="priority-choices">
          {["Best value", "Best supported quality", "Lowest-cost suitable"].map(
            (t) => (
              <button key={t} onClick={() => onCommand(t)}>
                {t}
                <ArrowRight size={16} />
              </button>
            ),
          )}
        </div>
      )}
      {(s.view === "summary" || s.view === "recovery") && s.summary && (
        <article
          className="order-summary"
          aria-label="Complete current order summary"
          data-summary-id={s.summary.id}
          data-summary-status={s.summary.status}
        >
          <p className="summary-label">
            SIMULATED ORDER ·{" "}
            {s.summary.status === "invalidated"
              ? "INVALIDATED"
              : s.summary.status === "eligible"
                ? "ELIGIBLE"
                : s.summary.status === "confirmed"
                  ? "CONFIRMED"
                  : "PRESENTING"}{" "}
            ·{" "}
            {s.summary.presentationMode === "text"
              ? "TEXT CONFIRMATION"
              : "VOICE CONFIRMATION"}
          </p>
          <dl>
            {[
              ["Product", s.summary.productId],
              ["Exact variant", s.summary.variantId],
              ["Seller", s.summary.sellerId],
              ["Quantity", String(s.summary.quantity)],
              [
                "Items",
                `USD ${(s.summary.lineItemsMinor.items / 100).toFixed(2)}`,
              ],
              [
                "Shipping",
                `USD ${(s.summary.lineItemsMinor.shipping / 100).toFixed(2)}`,
              ],
              [
                "Other fees",
                `USD ${(s.summary.lineItemsMinor.otherFees / 100).toFixed(2)}`,
              ],
              ["Total", `USD ${(s.summary.totalMinor / 100).toFixed(2)}`],
              ["Destination", s.summary.destination],
              ["Delivery estimate", s.summary.deliveryWindow],
              ["Conditions", s.summary.conditions.join(". ")],
              ["Uncertainties", s.summary.uncertainties.join(". ")],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {s.summary.spokenText && (
            <p className="exact-summary-text">{s.summary.spokenText}</p>
          )}
          <p role="status">
            {s.summary.status === "eligible" || s.approvalStatus === "eligible"
              ? "Full summary displayed. Say or type “Confirm this simulated purchase” to approve this exact summary. There is no purchase button."
              : s.summary.status === "invalidated" ||
                  s.approvalStatus === "blocked" ||
                  s.view === "recovery"
                ? "Approval was invalidated. Say or type “review summary” for a fresh presentation, or explicitly choose text mode."
                : "Listen to the complete summary before approving, or choose text confirmation."}
          </p>
          {(s.view === "recovery" || s.summary.status === "invalidated") && (
            <div className="priority-choices">
              <button onClick={() => onCommand("Review summary")}>
                Review summary again
                <ArrowRight size={16} />
              </button>
              <button onClick={onChooseText}>
                Switch to text confirmation
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </article>
      )}
      {s.view === "receipt" && s.receipt && (
        <div className="receipt" data-simulated="true">
          <Check size={24} />
          <div>
            <strong>SIMULATED receipt — no payment, no real order</strong>
            <p>
              {s.receipt.acceptedOrder.productId} · USD{" "}
              {(s.receipt.acceptedOrder.totalMinor / 100).toFixed(2)}
            </p>
            <small>
              Receipt {s.receipt.id} · duplicate confirms reuse this ID
            </small>
          </div>
        </div>
      )}
      {s.view !== "opening" &&
        s.view !== "summary" &&
        s.view !== "receipt" &&
        s.view !== "recovery" && (
          <p className="stage-hint">
            Keep talking, or type your next thought. “Show options”, “compare”,
            “show offers”, and “save for later” all work.
          </p>
        )}
    </>
  );
}
