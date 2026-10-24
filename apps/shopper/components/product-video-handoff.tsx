"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
        setNote(
          "Connect the Chrome companion in Settings to watch with Back to Along. You can also open the review in a separate tab.",
        );
        return;
      }
      const id = crypto.randomUUID();
      setOpening(true);
      setNote("Opening the review in Chrome · microphone paused");
      const timer = setTimeout(() => {
        pending.current = null;
        setOpening(false);
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
        setNote(
          event.data.ok
            ? "The review is open in Chrome. Use Back to Along when you’re finished."
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
        setNote(
          "Welcome back. Your choices are unchanged. Tap Talk to Along to continue.",
        );
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
  // A button remains available for a deterministic rehearsal and accessibility.
  const focused =
    state.snapshot?.focusedProductId ?? state.snapshot?.displayOrder?.[0];
  const available =
    !state.snapshot?.discoveryReference &&
    !state.snapshot?.summary &&
    !state.snapshot?.receipt
      ? PRODUCT_VIDEOS.find((item) => item.productId === focused)
      : undefined;
  if (
    state.snapshot?.summary ||
    state.snapshot?.receipt ||
    (!video && !available)
  )
    return null;
  const selected = video ?? available!;
  return (
    <aside className={styles.root} aria-label="Product video">
      <div>
        <strong>{selected.title}</strong>
        <p role="status">
          {note || `${selected.creator} · External review on YouTube`}
        </p>
      </div>
      <button
        disabled={opening || state.livePending || state.status === "thinking"}
        onClick={() => open(selected)}
      >
        {opening ? "Opening…" : "Watch review in Chrome"}
      </button>
      {video && (
        <>
          <a
            href={selected.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => controller.pauseForExternalVideo()}
          >
            Open video directly ↗
          </a>
          <button
            onClick={() => {
              setVideo(null);
              setNote("");
            }}
          >
            Dismiss
          </button>
        </>
      )}
    </aside>
  );
}
