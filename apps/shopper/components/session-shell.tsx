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
  Mic,
  Pause,
  RotateCcw,
  Keyboard,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { SessionController } from "@/lib/session/controller";
import { httpTransport } from "@/lib/session/http-transport";
import { BrowserSpeechAdapter } from "@/lib/voice/browser-adapter";
import { createSpeechAdapter } from "@/lib/voice/create-speech-adapter";
import { ProductCanvas } from "./canvas/ProductCanvas";
import { PurchaseComplete } from "./canvas/PurchaseComplete";
import { customerCopy, customerDestinationLabel, customerNotes, customerSellerLabel } from "@/lib/canvas/customer-copy";
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
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [voice, setVoice] = useState<"marin" | "cedar" | "coral">("marin");
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLElement>(null);
  const acknowledgeSummary = useCallback(() => {
    void controller.presentSummary();
  }, [controller]);
  const s = state.snapshot,
    opening = !s || s.view === "opening";
  const readableRequest = (text: string) => {
    let display = text;
    for (const product of s?.catalog?.products ?? [])
      display = display.replaceAll(
        product.id,
        `${product.brand} ${product.model}`,
      );
    return display.replace(/^Focus /i, "Show me ");
  };
  const orbGreeting = !s?.displayOrder?.length;
  const latestRequest =
    state.requestText ||
    [...(s?.history ?? [])].reverse().find((entry) => entry.role === "user")
      ?.text;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await controller.connect();
      const sessionId = controller.getSnapshot().snapshot?.sessionId;
      if (!sessionId || cancelled) return;
      const { adapter, kind, note } = await createSpeechAdapter(sessionId);
      if (cancelled) {
        adapter.dispose();
        return;
      }
      controller.setSpeechAdapter(adapter, kind);
      setVoiceNote(note ?? null);
      setVoiceReady(true);
    })();
    const offline = () => {
      controller.interrupt();
      controller.pauseListening();
    };
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
      controller.closeVoice();
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      window.removeEventListener("keydown", key);
    };
  }, [controller]);
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
        </header>
        <main
          className={`${opening ? "main opening" : "main active"} ${orbGreeting ? "orb-greeting" : ""}`}
        >
          <motion.aside
            layout={reduced ? false : "position"}
            layoutDependency={orbGreeting}
            transition={{
              layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
            }}
            className="voice-anchor"
            aria-label="Voice session"
          >
            <VoiceOrb
              status={state.status}
              capturing={state.capturing}
              compact={!orbGreeting}
            />
            <div className="voice-status" role="status" aria-live="polite">
              <span className={state.capturing ? "live-dot" : "status-dot"} />
              {state.capturing
                ? state.status === "speaking"
                  ? "Speaking · microphone on"
                  : state.livePending
                    ? "Finding your options · microphone on"
                    : statusLabels.listening
                : state.status === "listening"
                  ? "Ready · microphone off"
                  : state.status === "thinking" && state.activity
                    ? state.activity.label
                    : state.status === "reconnecting" && state.mode === "voice"
                      ? "Connecting voice…"
                      : statusLabels[state.status]}
            </div>
            {state.delayed && state.status === "thinking" && (
              <p className="activity-delay">Still working on your request.</p>
            )}
          </motion.aside>
          <section
            className="stage"
            tabIndex={-1}
            ref={stageRef}
            aria-label="Shopping conversation"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={s ? `${s.sessionId}:${s.epoch}` : "opening"}
                initial={
                  reduced || s?.view === "summary" || s?.view === "receipt"
                    ? false
                    : { opacity: 0, y: 16 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="conversation-current">
                  {latestRequest && (
                    <p className="latest-request">
                      <span className="sr-only">You: </span>
                      {readableRequest(latestRequest)}
                    </p>
                  )}
                  {opening && !latestRequest && !state.liveCaption ? (
                    <>
                      <h1>What are you looking for?</h1>
                      <p className="stage-message">
                        Tell me what you need and what you’d like to spend. We
                        can work out the rest together.
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="sr-only">Shopping conversation</h1>
                      {(!opening || latestRequest || state.liveCaption) &&
                        s?.view !== "summary" && (
                          <p className="assistant-reply">
                            <span className="sr-only">Along: </span>
                            {state.liveCaption || s?.message}
                          </p>
                        )}
                    </>
                  )}
                </div>
                {opening && (
                  <p>
                    <a href="/context">Personal context · manage Mac preferences</a>
                  </p>
                )}
                {s && (
                  <ContentStage
                    narrationProductId={state.narrationProductId}
                    session={
                      state.activity?.phase === "working" && s.canvas
                        ? {
                            ...s,
                            canvas: {
                              ...s.canvas,
                              heading: state.activity.heading,
                            },
                          }
                        : s
                    }
                    busy={state.status === "thinking" || state.livePending}
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
          {s && s.history.length > 0 && (
            <details className="transcript">
              <summary>
                <MessageSquare size={15} /> Earlier in this conversation{" "}
                <span>
                  {s.history.filter((h) => h.role === "user").length} turns
                </span>
              </summary>
              <ol>
                {s.history.map((entry, i) => (
                  <li key={i}>
                    <span>{entry.role === "user" ? "You" : "Along"}</span>
                    <p>
                      {entry.role === "user"
                        ? readableRequest(entry.text)
                        : entry.text}
                    </p>
                  </li>
                ))}
              </ol>
            </details>
          )}
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
                  onClick={() =>
                    state.capturing && state.status !== "speaking"
                      ? controller.pauseListening()
                      : controller.interrupt()
                  }
                >
                  <Pause size={17} />{" "}
                  {state.status === "speaking"
                    ? "Stop speaking"
                    : state.capturing
                      ? "Pause microphone"
                      : "Interrupt response"}
                  <span className="key-hint">esc</span>
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={
                    !s || !voiceReady || state.status === "reconnecting"
                  }
                  onClick={() => void controller.chooseMode("voice")}
                >
                  <Mic size={17} />
                  {state.status === "reconnecting"
                    ? "Connecting voice…"
                    : opening
                      ? "Start talking"
                      : "Talk to Along"}
                </button>
              )}
              <button
                className="text-button"
                disabled={!s || state.status === "reconnecting"}
                onClick={() => void controller.chooseMode("text")}
              >
                <Keyboard size={17} />
                {state.mode === "text" ? "Typing · mic off" : "Type instead"}
              </button>
              <details className="conversation-options">
                <summary>Settings</summary>
                <div className="options-panel">
                  {voiceReady && controller.speechKind === "live" && (
                    <label className="voice-choice">
                      Voice
                      <select
                        aria-label="Assistant voice"
                        value={voice}
                        disabled={
                          state.status === "thinking" ||
                          state.status === "speaking" ||
                          state.capturing
                        }
                        onChange={(event) => {
                          const choice = event.target.value as typeof voice;
                          setVoice(choice);
                          controller.setVoice(choice);
                        }}
                      >
                        <option value="marin">Marin</option>
                        <option value="cedar">Cedar</option>
                        <option value="coral">Coral</option>
                      </select>
                    </label>
                  )}
                  <p className="voice-help">
                    {state.mode === "voice"
                      ? controller.speechKind === "live"
                        ? "You can speak while I work. Press Esc to pause a reply. After reviewing your order, tell me when you’d like me to place it."
                        : "Browser voice. Your microphone pauses during replies. Press Esc to interrupt."
                      : "AI-generated voice. Start talking to enable your microphone."}
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
                        void controller.send(
                          `Remove reference ${a.id}`,
                          "text",
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
                </div>
              </details>
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
                  autoComplete="off"
                  value={draft}
                  maxLength={4000}
                  placeholder={
                    s?.view === "summary"
                      ? "Ready to order, or want to change something?"
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
          </section>
        </main>
      </div>
    </MotionConfig>
  );
}
function ContentStage({
  narrationProductId,
  session: s,
  onCommand,
  onSummaryDisplayed,
  onChooseText,
  onMediaEvent,
  busy,
}: {
  narrationProductId?: string | null;
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
      {s.canvas &&
        s.catalog &&
        !["opening", "summary", "receipt", "recovery"].includes(s.view) && (
          <ProductCanvas
            narrationProductId={narrationProductId}
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
                    ? "Product"
                    : c.kind === "offer"
                      ? "Offer"
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
            Your order ·{" "}
            {s.summary.status === "invalidated"
              ? "Review needed"
              : s.summary.status === "eligible"
                ? "Ready to confirm"
                : s.summary.status === "confirmed"
                  ? "Confirmed"
                  : "Review the details"}
          </p>
          <dl>
            {[
              ["Product", s.catalog?.products.find((product) => product.id === s.summary?.productId)?.title ?? s.summary.productId],
              ["Variant", customerCopy(s.catalog?.products.find((product) => product.id === s.summary?.productId)?.model ?? s.summary.variantId.replace(/-DEMO$/i, ""))],
              ["Seller", customerSellerLabel(s.summary.sellerId)],
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
              ["Destination", customerDestinationLabel(s.summary.destination)],
              ["Delivery estimate", s.summary.deliveryWindow],
              ["Conditions", customerNotes(s.summary.conditions).join(". ")],
              ["Before you buy", customerNotes(s.summary.uncertainties).join(". ")],
            ].filter(([, value]) => value).map(([k, v]) => (
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
              ? "Everything look right? Would you like me to place this order?"
              : s.summary.status === "invalidated" ||
                  s.approvalStatus === "blocked" ||
                  s.view === "recovery"
                ? "This order needs another review before you can confirm it. Say “review summary” or switch to text below."
                : "Review the details above, then tell me if you’d like to place this order."}
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
        <PurchaseComplete
          receipt={s.receipt}
          product={s.catalog?.products.find((product) => product.id === s.receipt?.acceptedOrder.productId)}
        />
      )}
    </>
  );
}
