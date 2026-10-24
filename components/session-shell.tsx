"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { VoiceOrb } from "./voice-orb";
import { Attachments } from "./attachments";
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
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLElement>(null);
  const s = state.snapshot,
    opening = !s || s.view === "opening";
  useEffect(() => {
    void controller.connect();
    const offline = () => controller.interrupt();
    const online = () => void controller.reconnect();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") controller.interrupt();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    window.addEventListener("keydown", key);
    return () => {
      controller.interrupt();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("keydown", key);
    };
  }, [controller]);
  useEffect(() => {
    if (s?.revision) stageRef.current?.focus({ preventScroll: true });
  }, [s?.revision]);
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
            <span /> A shopping conversation <i>·</i> Fixture preview
          </span>
          <span className="private-note">Thoughtfully, together.</span>
        </header>
        <main className={opening ? "main opening" : "main active"}>
          <aside className="voice-anchor" aria-label="Voice session">
            <VoiceOrb
              status={state.status}
              capturing={state.capturing}
              compact={!opening}
            />
            <div className="voice-status" role="status" aria-live="polite">
              <span className={state.capturing ? "live-dot" : "status-dot"} />
              {statusLabels[state.status]}
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
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <p className="eyebrow">
                  {opening
                    ? "YOUR NEXT GOOD FIND"
                    : s?.view === "receipt"
                      ? "SIMULATION COMPLETE"
                      : `THE CONVERSATION / ${s?.view.replaceAll("_", " ")}`}
                </p>
                <h1>
                  {s?.heading ?? "A little conversation.\nA better choice."}
                </h1>
                {s?.view !== "summary" && (
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
                    onCommand={(command) =>
                      void controller.send(
                        command,
                        state.mode === "voice" ? "voice" : "text",
                      )
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
                      ? "Type “confirm simulated purchase” to approve"
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
              {state.mode === "voice"
                ? "Browser voice preview · microphone pauses during narration. Interrupt with the control or Esc, then speak."
                : "Start Chat asks for microphone access. Typing is always optional."}
            </p>
            {s && (
              <Attachments
                sessionId={s.sessionId}
                onInterrupt={controller.interrupt}
                onRemove={(a) => {
                  if (s.attachmentIds.includes(a.id))
                    void controller.send(
                      `Remove reference ${a.id}`,
                      state.mode === "voice" ? "voice" : "text",
                    );
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
                <span>{s.history.length / 2} turns</span>
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
}: {
  session: Session;
  onCommand: (text: string) => void;
}) {
  const reduced = useReducedMotion();
  return (
    <>
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
      {s.cards.length > 0 && (
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
      {s.view === "buying_priorities" && (
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
      {s.view === "summary" && s.summary && (
        <article
          className="order-summary"
          aria-label="Complete current order summary"
          data-summary-id={s.summary.id}
        >
          <p className="summary-label">
            SIMULATED ORDER ·{" "}
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
          <p role="status">
            {s.approvalStatus === "eligible"
              ? "Full summary displayed. Say or type “confirm simulated purchase” to approve this exact summary."
              : s.approvalStatus === "presenting"
                ? "Listen to the complete summary before approving, or choose text confirmation."
                : "Approval was invalidated. Say or type “review summary” to present it again."}
          </p>
        </article>
      )}
      {s.view === "receipt" && s.receipt && (
        <div className="receipt">
          <Check size={24} />
          <div>
            <strong>Simulated receipt</strong>
            <p>
              {s.receipt.acceptedOrder.productId} · USD{" "}
              {(s.receipt.acceptedOrder.totalMinor / 100).toFixed(2)}
            </p>
            <small>Receipt {s.receipt.id}</small>
          </div>
        </div>
      )}
      {s.view !== "opening" && s.view !== "summary" && s.view !== "receipt" && (
        <p className="stage-hint">
          Keep talking, or type your next thought. “Show options”, “compare”,
          “show offers”, and “save for later” all work.
        </p>
      )}
    </>
  );
}
