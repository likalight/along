"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, ArrowUpRight, Volume2 } from "lucide-react";
import { PRODUCT_VIDEOS, type ProductVideo } from "@coupang/contract";
import type { ClientState, SessionController } from "@/lib/session/controller";
import styles from "./product-video-handoff.module.css";

export function ProductVideoHandoff({
  controller,
  state,
  connected,
}: {
  controller: SessionController;
  state: ClientState;
  connected: boolean;
}) {
  const [video, setVideo] = useState<ProductVideo | null>(null);
  const [note, setNote] = useState("");
  const [opening, setOpening] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [returned, setReturned] = useState(false);
  const latest = useRef({ state, connected });
  latest.current = { state, connected };
  const seen = useRef(new Set<string>());
  const pending = useRef<{
    id: string;
    extensionId: string;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const sessionId = state.snapshot?.sessionId;
  const open = useCallback(
    (selected: ProductVideo) => {
      if (pending.current) return;
      setVideo(selected);
      setFallback(false);
      setReturned(false);
      // Stop capture AND playback before any external audio can start.
      controller.pauseForExternalVideo();
      const current = latest.current.state.snapshot;
      let pair;
      try {
        pair = JSON.parse(
          sessionStorage.getItem("along.extensionConnection") ?? "null",
        );
      } catch {
        /* No connection. */
      }
      if (
        !latest.current.connected ||
        !current ||
        !pair ||
        pair.sessionId !== current.sessionId ||
        pair.epoch !== current.epoch
      ) {
        setFallback(true);
        setNote("Connect Chrome in Settings, or open the review in a new tab.");
        return;
      }
      const id = crypto.randomUUID();
      setOpening(true);
      setNote("Opening review…");
      const timer = setTimeout(() => {
        pending.current = null;
        setOpening(false);
        setFallback(true);
        setNote(
          "Chrome did not reply. Reconnect the extension in Settings, then try again.",
        );
      }, 12000);
      pending.current = { id, extensionId: pair.extensionId, timer };
      window.postMessage(
        {
          type: "ALONG_VIDEO_OPEN",
          extensionId: pair.extensionId,
          requestId: id,
          sessionId: current.sessionId,
          epoch: current.epoch,
          videoId: selected.id,
        },
        location.origin,
      );
    },
    [controller],
  );
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin) return;
      const attempt = pending.current;
      if (
        event.data?.type === "ALONG_VIDEO_RESULT" &&
        attempt &&
        event.data.requestId === attempt.id &&
        event.data.extensionId === attempt.extensionId
      ) {
        clearTimeout(attempt.timer);
        pending.current = null;
        setOpening(false);
        setFallback(!event.data.ok);
        setNote(
          event.data.ok
            ? "Review open · microphone paused"
            : String(event.data.error || "Could not open the review."),
        );
      }
      if (
        event.data?.type === "ALONG_VIDEO_RETURNED" &&
        event.data.sessionId === sessionId
      ) {
        let pair;
        try {
          pair = JSON.parse(
            sessionStorage.getItem("along.extensionConnection") ?? "null",
          );
        } catch {
          return;
        }
        if (event.data.extensionId !== pair?.extensionId) return;
        setReturned(true);
        setFallback(false);
        setNote("");
      }
    };
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      if (pending.current) clearTimeout(pending.current.timer);
      pending.current = null;
    };
  }, [sessionId]);
  useEffect(() => {
    const request = state.snapshot?.productVideoRequest;
    if (!request || state.livePending || state.status === "thinking") return;
    const key = `${sessionId}:${request.requestId}`;
    if (
      seen.current.has(key) ||
      sessionStorage.getItem("along.watchedVideoRequest") === key
    )
      return;
    const selected = PRODUCT_VIDEOS.find(
      (item) => item.id === request.id && item.productId === request.productId,
    );
    if (!selected) return;
    seen.current.add(key);
    sessionStorage.setItem("along.watchedVideoRequest", key);
    open(selected);
  }, [
    state.snapshot?.productVideoRequest,
    state.livePending,
    state.status,
    sessionId,
    open,
  ]);
  useEffect(() => {
    const request = state.voiceReviewRequest;
    if (!request) return;
    const key = `${sessionId}:voice:${request.requestId}`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    const selected = PRODUCT_VIDEOS.find(
      (item) => item.productId === request.productId,
    );
    if (selected) open(selected);
  }, [state.voiceReviewRequest, sessionId, open]);
  // A button remains available for a deterministic rehearsal and accessibility.
  const focused =
    state.narrationProductId ??
    state.snapshot?.focusedProductId ??
    state.snapshot?.displayOrder?.[0];
  const available =
    !state.snapshot?.discoveryReference &&
    !state.snapshot?.summary &&
    !state.snapshot?.receipt
      ? PRODUCT_VIDEOS.find((item) => item.productId === focused)
      : undefined;
  if (state.snapshot?.summary || state.snapshot?.receipt || !available)
    return null;
  const selected = available;
  const currentVideo = video?.id === selected.id;
  const canResume = returned && currentVideo && !state.capturing;
  return (
    <aside className={styles.root} aria-label="Product video">
      <button
        className={styles.watch}
        disabled={opening || state.livePending || state.status === "thinking"}
        onClick={() => open(selected)}
        title={`${selected.title} · ${selected.creator}`}
      >
        <Play size={15} aria-hidden="true" />
        {opening ? "Opening…" : "Watch review"}
      </button>
      {canResume && (
        <button
          className={styles.resume}
          onClick={() => {
            setReturned(false);
            void controller.chooseMode("voice");
          }}
        >
          <Volume2 size={16} aria-hidden="true" /> Continue conversation
        </button>
      )}
      {currentVideo && note && <p role="status">{note}</p>}
      {currentVideo && fallback && (
        <a
          href={selected.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => controller.pauseForExternalVideo()}
        >
          Open in new tab <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      )}
    </aside>
  );
}
