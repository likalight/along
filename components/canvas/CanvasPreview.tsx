"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, LoaderCircle } from "lucide-react";
import { ProductCanvas, type PlaybackRequest } from "./ProductCanvas";
import { fixtureData } from "@/lib/canvas/fixtures";
import {
  acceptEvent,
  type Category,
  type MediaEvent,
  type ShopperIntent,
  type Snapshot,
} from "@/lib/canvas/contracts";
import styles from "./preview.module.css";

/** Isolated, typed rehearsal. Real voice/composer/attachment transport comes from issue #3. */
export function CanvasPreview() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mediaRequest, setMediaRequest] = useState<{
    requestId: string;
    evidenceId: string;
    action: "play" | "stop";
    takeaway?: string;
  } | null>(null);
  const [mediaStatus, setMediaStatus] = useState("");
  const [lastTurn, setLastTurn] = useState("");
  const controller = useRef<AbortController | null>(null);
  const serial = useRef(0);
  const accepted = useRef<Snapshot | null>(null);
  const pendingRequest = useRef(false);
  const activeMedia = useRef<MediaEvent | null>(null);
  const requestedMedia = useRef<(PlaybackRequest & { played: boolean }) | null>(
    null,
  );
  const currentTurn = useRef("");
  async function create(category: Category) {
    const request = ++serial.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    pendingRequest.current = true;
    activeMedia.current = null;
    requestedMedia.current = null;
    setBusy(true);
    setError("");
    setMediaRequest(null);
    setMediaStatus("");
    try {
      const response = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", category }),
        signal: abort.signal,
      });
      if (!response.ok) throw Error("Could not start rehearsal.");
      const body = await response.json();
      if (request === serial.current) {
        accepted.current = body.snapshot;
        currentTurn.current = "";
        setLastTurn("");
        setSnapshot(body.snapshot);
      }
    } catch (e) {
      if (request === serial.current && !abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      if (request === serial.current) {
        pendingRequest.current = false;
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    void create("audio");
    return () => {
      serial.current++;
      pendingRequest.current = true;
      activeMedia.current = null;
      requestedMedia.current = null;
      controller.current?.abort();
    };
  }, []);
  async function send(intent: ShopperIntent) {
    if (!snapshot || busy) return;
    const stopped =
      /\bstop\b/i.test(intent.text) && requestedMedia.current?.played
        ? requestedMedia.current
        : null;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const request = ++serial.current;
    const turnId = crypto.randomUUID();
    currentTurn.current = turnId;
    pendingRequest.current = true;
    activeMedia.current = null;
    requestedMedia.current = null;
    setLastTurn(turnId);
    setBusy(true);
    setError("");
    setMediaRequest(null);
    setMediaStatus("");
    // A fresh shopper turn cancels narration and stale video before processing references.
    window.speechSynthesis?.cancel();
    try {
      const response = await fetch("/api/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abort.signal,
        body: JSON.stringify({
          ...intent,
          sessionId: snapshot.sessionId,
          epoch: snapshot.epoch,
          eventId: crypto.randomUUID(),
          turnId,
          baseRevision: snapshot.revision,
        }),
      });
      const body = await response.json();
      if (request !== serial.current) return;
      if (!response.ok) {
        if (
          body.snapshot &&
          body.snapshot.sessionId === snapshot.sessionId &&
          body.snapshot.epoch === snapshot.epoch &&
          body.snapshot.revision >= snapshot.revision
        ) {
          accepted.current = body.snapshot;
          setSnapshot(body.snapshot);
        }
        throw Error(body.error ?? "Request failed");
      }
      const next = acceptEvent(snapshot, body.event, turnId);
      if (next === snapshot) {
        setError(
          "The response no longer matches this turn. Repeat your request using the current numbered cards.",
        );
        return;
      }
      accepted.current = next;
      setSnapshot(next);
      if (/\bplay\b/i.test(intent.text) && next.view === "evidence")
        setMediaRequest({
          requestId: turnId,
          evidenceId: `${next.focusedProductId}-video`,
          action: "play",
        });
      if (/\bstop\b/i.test(intent.text)) {
        const evidence =
          stopped &&
          stopped.sessionId === next.sessionId &&
          stopped.epoch === next.epoch
            ? fixtureData.evidence.find(
                (item) =>
                  item.id === stopped.evidenceId &&
                  item.subjectId === next.focusedProductId &&
                  next.evidenceIds.includes(item.id),
              )
            : undefined;
        const takeaway = evidence?.media?.takeaway;
        setMediaRequest({
          requestId: turnId,
          evidenceId: "",
          action: "stop",
          takeaway,
        });
        if (takeaway) setMediaStatus(takeaway);
      }
    } catch (e) {
      if (request === serial.current && !abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      if (request === serial.current) {
        pendingRequest.current = false;
        setBusy(false);
      }
    }
  }
  function media(event: MediaEvent) {
    const current = accepted.current;
    if (
      pendingRequest.current ||
      !current ||
      event.sessionId !== current.sessionId ||
      event.epoch !== current.epoch ||
      event.revision !== current.revision ||
      event.turnId !== currentTurn.current
    )
      return;
    if (event.type === "video.started") {
      const requested = requestedMedia.current;
      if (
        !requested ||
        requested.sessionId !== event.sessionId ||
        requested.epoch !== event.epoch ||
        requested.revision !== event.revision ||
        requested.turnId !== event.turnId
      )
        return;
      requested.played = true;
      activeMedia.current = event;
      window.speechSynthesis?.cancel();
      setMediaStatus("Assistant narration paused · curated video playing");
    } else {
      const running = activeMedia.current;
      if (
        !running ||
        running.playbackId !== event.playbackId ||
        running.turnId !== event.turnId ||
        running.revision !== event.revision
      )
        return;
      activeMedia.current = null;
      setMediaStatus(
        event.reason === "failed"
          ? "Media unavailable. You can continue exploring."
          : (event.takeaway ?? "Video stopped. Ready for your next turn."),
      );
    }
  }
  function playbackRequest(request: PlaybackRequest) {
    const current = accepted.current;
    if (
      pendingRequest.current ||
      !current ||
      request.sessionId !== current.sessionId ||
      request.epoch !== current.epoch ||
      request.revision !== current.revision ||
      request.turnId !== currentTurn.current
    )
      return;
    if (request.phase === "failed") {
      requestedMedia.current = null;
      activeMedia.current = null;
      setMediaStatus("Media unavailable. You can continue exploring.");
    } else {
      requestedMedia.current = { ...request, played: false };
      window.speechSynthesis?.cancel();
      setMediaStatus("Preparing curated video…");
    }
  }
  function submit() {
    if (!snapshot || !text.trim() || busy) return;
    void send({
      text: text.trim(),
      modality: "text",
      visibleRevision: snapshot.revision,
      visibleProductIds: snapshot.displayOrder,
    });
    setText("");
  }
  return (
    <main className={styles.preview}>
      <header className={styles.header}>
        <a href="/canvas-preview" className={styles.wordmark}>
          along<span>●</span>
        </a>
        <span className={styles.tagline}>
          a little conversation. a better choice.
        </span>
        <span className={styles.fixture}>Fixture rehearsal</span>
      </header>
      <div className={styles.scenario}>
        <span>Try a journey</span>
        {(["audio", "bags", "bedsheets"] as Category[]).map((category) => (
          <button
            key={category}
            disabled={busy}
            aria-pressed={snapshot?.category === category}
            onClick={() => void create(category)}
          >
            {category === "audio"
              ? "Noisy café"
              : category === "bags"
                ? "Work + gym bag"
                : "Warm-room sheets"}
          </button>
        ))}
        <span className={styles.revision}>
          Accepted revision {snapshot?.revision ?? "—"}
        </span>
      </div>
      {snapshot ? (
        <ProductCanvas
          snapshot={snapshot}
          data={fixtureData}
          onIntent={(intent) => void send(intent)}
          onMediaEvent={media}
          onPlaybackRequest={playbackRequest}
          busy={busy}
          interpretingSpatialReference={busy}
          mediaRequest={mediaRequest}
          turnId={lastTurn}
        />
      ) : (
        <p className={styles.loading}>
          <LoaderCircle size={18} /> Preparing your canvas…
        </p>
      )}
      <footer className={styles.dock}>
        <div className={styles.anchor}>
          <span className={styles.orb} aria-hidden="true" />
          <div>
            <strong>
              {busy
                ? "Considering your request…"
                : mediaStatus
                  ? "Evidence, considered."
                  : "What speaks to you?"}
            </strong>
            <p role="status">
              {mediaStatus || "Say it in the voice shell, or type it here."}
            </p>
          </div>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label htmlFor="shopper-input" className={styles.srOnly}>
            Your shopping request
          </label>
          <input
            id="shopper-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              snapshot?.view === "understanding"
                ? "Try “explore options” or “under $100”"
                : "Try “compare the first two” or “reviews for the first”"
            }
            autoComplete="off"
            maxLength={2000}
            disabled={!snapshot || busy}
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            aria-label="Send request"
          >
            {busy ? <LoaderCircle size={18} /> : <ArrowUp size={18} />}
          </button>
        </form>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <p className={styles.note}>
          24 prepared products · USD reference prices · simulated fulfillment ·
          session-only saves <ArrowUpRight size={10} />
        </p>
      </footer>
    </main>
  );
}
