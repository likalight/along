"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  CircleHelp,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import {
  deliveredTotal,
  deliveryDate,
  money,
  type CanvasData,
  type MediaEvent,
  type Product,
  type ShopperIntent,
  type Snapshot,
} from "@/lib/canvas/contracts";
import styles from "./canvas.module.css";

export type PlaybackRequest = Pick<
  MediaEvent,
  "sessionId" | "epoch" | "turnId" | "revision"
> & {
  evidenceId: string;
  phase: "preparing" | "failed" | "cancelled";
};
export type ProductCanvasProps = {
  snapshot: Snapshot;
  data: CanvasData;
  onIntent: (intent: ShopperIntent) => void;
  onMediaEvent: (event: MediaEvent) => void;
  /** Pause assistant capture/narration before mounting a requested player. No playback is implied. */
  onPlaybackRequest?: (request: PlaybackRequest) => void;
  /** Shell sets while resolving spatial/ordinal language; suppress all positional transitions. */
  interpretingSpatialReference?: boolean;
  busy?: boolean;
  mediaRequest?: {
    requestId: string;
    evidenceId: string;
    action: "play" | "stop";
    takeaway?: string;
  } | null;
  turnId?: string;
};
const ranks = {
  1: "Top recommendation",
  2: "Strong alternative",
  3: "Third choice",
};
const steps = [
  "Understand",
  "Explore",
  "Narrow",
  "Compare",
  "Evidence",
  "Offers",
];
const stepOf = (view: Snapshot["view"]) =>
  view === "understanding"
    ? 0
    : view === "solution_types"
      ? 1
      : view === "buying_priorities" || view === "shortlist"
        ? 2
        : view === "comparison"
          ? 3
          : view === "evidence"
            ? 4
            : 5;
const solutions = [
  {
    id: "headset",
    title: "A close-talking headset",
    tag: "Your voice, up close",
    text: "A boom keeps the mic near your mouth, helping your speech stand out.",
    trade: "You have to wear it; a headset can be conspicuous.",
    command: "Choose headset",
  },
  {
    id: "clip",
    title: "A discreet clip-on",
    tag: "Small. Portable. Ears free.",
    text: "Bring the microphone with you, clipped close to your voice.",
    trade: "Clothing rustle, input compatibility and nearby voices need care.",
    command: "Choose clip-on",
  },
  {
    id: "desktop",
    title: "A directional desk mic",
    tag: "A place for your voice",
    text: "Close, directional pickup while keeping your ears completely free.",
    trade:
      "Needs desk space and careful placement; distance admits more noise.",
    command: "Choose desktop",
  },
];
const priorities = [
  {
    id: "value",
    title: "Best value",
    tag: "The thoughtful balance",
    text: "Relevant performance, reliability and price considered together.",
    trade: "May cost more than the cheapest suitable option.",
    command: "Choose best value",
  },
  {
    id: "quality",
    title: "Best supported quality",
    tag: "Put performance first",
    text: "Prioritise supported capabilities for your problem, within your hard budget.",
    trade: "Demo ranking is a hypothesis, not a measured dictation benchmark.",
    command: "Choose quality",
  },
  {
    id: "cost",
    title: "Lowest-cost suitable",
    tag: "Keep the essentials",
    text: "The lowest reference price among candidates meeting your stated essentials.",
    trade: "Setup hardware and delivered costs still need checking.",
    command: "Choose cost-effective",
  },
];

export function ProductCanvas({
  snapshot: s,
  data,
  onIntent,
  onMediaEvent,
  onPlaybackRequest,
  interpretingSpatialReference = false,
  busy = false,
  mediaRequest,
  turnId = `canvas-${s.revision}`,
}: ProductCanvasProps) {
  const reduced = useReducedMotion();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [videoRequest, setVideoRequest] = useState(0);
  const [takeaway, setTakeaway] = useState("");
  const activePlayback = useRef<{
    sessionId: string;
    epoch: number;
    id: string;
    evidenceId: string;
    revision: number;
    turnId: string;
  } | null>(null);
  const videoElement = useRef<HTMLVideoElement>(null);
  const callbacks = useRef(onMediaEvent);
  callbacks.current = onMediaEvent;
  const lastRequest = useRef("");
  const products = s.displayOrder.flatMap((id) => {
    if (s.view === "comparison" && !s.comparisonIds.includes(id)) return [];
    const p = data.products.find((p) => p.id === id);
    return p ? [p] : [];
  });
  const focused = data.products.find((p) => p.id === s.focusedProductId);
  // Discovery entrance must not depend on busy/thinking — cards often mount
  // while status is still "thinking", which previously suppressed the fly-in.
  // Keep settles for compare/evidence/offers/spatial/video/reduced-motion.
  const discoveryView = [
    "shortlist",
    "solution_types",
    "buying_priorities",
    "understanding",
  ].includes(s.view);
  const stable =
    interpretingSpatialReference ||
    !discoveryView ||
    Boolean(videoId) ||
    Boolean(reduced);
  const intent = (text: string) =>
    onIntent({
      text,
      modality: "text",
      visibleRevision: s.revision,
      visibleProductIds: s.displayOrder,
    });
  const emitStop = (reason: MediaEvent["reason"]) => {
    const active = activePlayback.current;
    if (!active) return;
    activePlayback.current = null;
    const ev = data.evidence.find((e) => e.id === active.evidenceId);
    callbacks.current({
      sessionId: active.sessionId,
      epoch: active.epoch,
      turnId: active.turnId,
      revision: active.revision,
      playbackId: active.id,
      type: "video.stopped",
      reason,
      takeaway: reason === "failed" ? undefined : ev?.media?.takeaway,
    });
  };
  const stop = (reason: MediaEvent["reason"]) => {
    const played = activePlayback.current;
    emitStop(reason);
    videoElement.current?.pause();
    setVideoId(null);
    const ev = data.evidence.find((e) => e.id === videoId);
    if (!played && ev?.media?.url)
      onPlaybackRequest?.({
        sessionId: s.sessionId,
        epoch: s.epoch,
        turnId,
        revision: s.revision,
        evidenceId: ev.id,
        phase: "cancelled",
      });
    if (played && reason !== "failed" && ev?.media)
      setTakeaway(ev.media.takeaway);
  };
  const play = (id: string) => {
    const ev = data.evidence.find(
      (e) =>
        e.id === id &&
        e.subjectType === "product" &&
        e.subjectId === s.focusedProductId,
    );
    if (
      !ev?.media ||
      busy ||
      s.view !== "evidence" ||
      !s.evidenceIds.includes(id)
    )
      return;
    emitStop("stopped");
    if (ev.media.url)
      onPlaybackRequest?.({
        sessionId: s.sessionId,
        epoch: s.epoch,
        turnId,
        revision: s.revision,
        evidenceId: id,
        phase: "preparing",
      });
    setVideoError(false);
    setTakeaway("");
    setVideoId(id);
    setVideoRequest((request) => request + 1);
  };
  const started = (element: HTMLVideoElement) => {
    if (
      element !== videoElement.current ||
      busy ||
      !videoId ||
      s.view !== "evidence" ||
      !s.evidenceIds.includes(videoId)
    )
      return;
    if (!activePlayback.current) {
      const playback = {
        sessionId: s.sessionId,
        epoch: s.epoch,
        id: crypto.randomUUID(),
        evidenceId: videoId,
        revision: s.revision,
        turnId,
      };
      activePlayback.current = playback;
      setTakeaway("");
      callbacks.current({
        sessionId: s.sessionId,
        epoch: s.epoch,
        turnId,
        revision: s.revision,
        playbackId: playback.id,
        type: "video.started",
      });
    }
  };
  // Navigation/cancellation cannot leave media running behind a different accepted view.
  useEffect(() => {
    setVideoId(null);
    setVideoError(false);
    setTakeaway("");
    return () => {
      const active = activePlayback.current;
      if (active) {
        activePlayback.current = null;
        callbacks.current({
          sessionId: active.sessionId,
          epoch: active.epoch,
          turnId: active.turnId,
          revision: active.revision,
          playbackId: active.id,
          type: "video.stopped",
          reason: "navigation",
        });
      }
    };
  }, [s.sessionId, s.epoch, s.revision]);
  useEffect(() => {
    if (busy) {
      emitStop("navigation");
      setVideoId(null);
    }
  }, [busy]);
  useEffect(() => {
    if (!mediaRequest || lastRequest.current === mediaRequest.requestId) return;
    lastRequest.current = mediaRequest.requestId;
    if (mediaRequest.action === "stop") {
      stop("stopped");
      if (mediaRequest.takeaway) setTakeaway(mediaRequest.takeaway);
    } else if (
      s.view === "evidence" &&
      s.evidenceIds.includes(mediaRequest.evidenceId)
    )
      play(mediaRequest.evidenceId);
  }, [mediaRequest, s.revision]); // Request identity is shell-owned; never read commands from media content.
  const activeEvidence = data.evidence.find((e) => e.id === videoId);

  function reviewsFor(productId: string) {
    // Match the subject and evidence kind, not fixture-only IDs or display labels.
    return data.evidence.find(
      (e) =>
        e.subjectType === "product" &&
        e.subjectId === productId &&
        (e.sourceType === "review" ||
          e.sourceType === "Customer review snapshot"),
    );
  }

  function card(p: Product, index: number, compact = false) {
    const annotation = s.canvas.annotations[p.id];
    const rank = annotation?.rank;
    const isFocused = p.id === s.focusedProductId;
    const metrics = reviewsFor(p.id);
    return (
      <motion.article
        key={p.id}
        data-product-id={p.id}
        data-number={s.displayOrder.indexOf(p.id) + 1}
        className={`${styles.card} ${isFocused ? styles.focused : ""} ${compact ? styles.compact : ""}`}
        initial={
          stable
            ? false
            : { opacity: 0, y: 24, rotateY: -13, rotateZ: index % 2 ? 2 : -2 }
        }
        animate={{ opacity: 1, y: 0, rotateY: 0, rotateZ: 0 }}
        transition={{
          duration: stable ? 0 : 0.48,
          delay: stable ? 0 : index * 0.09,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className={styles.cardTop}>
          <span className={styles.number}>
            Option {s.displayOrder.indexOf(p.id) + 1}
          </span>
          {rank && (
            <span className={`${styles.rank} ${styles[`rank${rank}`]}`}>
              <span aria-hidden="true">
                {rank === 1 ? "●" : rank === 2 ? "◉" : "○"}
              </span>{" "}
              {ranks[rank]}
            </span>
          )}
          {isFocused && <span className={styles.focusLabel}>In focus</span>}
        </div>
        <div className={styles.productImage}>
          <img src={p.image.url} alt={p.image.alt} loading="lazy" />
          <span>
            {p.image.classification === "proxy"
              ? "Illustration · proxy"
              : `${p.image.classification} image`}
          </span>
        </div>
        <div className={styles.cardBody}>
          <span className={styles.eyebrow}>
            {annotation?.role ??
              (s.savedItems.some((item) => item.id === p.id)
                ? "Saved choice"
                : "Shortlisted choice")}
          </span>
          <p className={styles.brand}>{p.brand}</p>
          <h3>{p.model}</h3>
          <p className={styles.variant}>{p.variantId}</p>
          <p className={styles.fit}>
            {annotation?.fitReason ??
              p.specs["Why it may help"] ??
              Object.values(p.specs).join(" · ")}
          </p>
          <p className={styles.compromise}>
            <span>The trade-off</span>{" "}
            {annotation?.compromise ?? p.limitations[0]}
          </p>
          <div className={styles.price}>
            <strong>{money(p.referencePriceMinor)}</strong>
            <span>item reference · {p.classification}</span>
          </div>
          <p className={styles.metricHint}>
            {metrics?.rating != null
              ? `${metrics.rating}/5 customer stars · ${metrics.ratingCount ?? "unavailable"} ratings`
              : "Customer stars not available"}
          </p>
          <div className={styles.cardActions}>
            <button
              disabled={busy}
              onClick={() => intent(`Focus ${p.id}`)}
              aria-label={`Focus ${p.model}`}
            >
              Explore <ArrowUpRight size={15} />
            </button>
            <button
              disabled={busy}
              onClick={() => intent(`Save ${p.id}`)}
              aria-label={`Save ${p.model}`}
            >
              <Bookmark size={16} />
            </button>
            <button
              disabled={busy}
              onClick={() => intent(`Remove ${p.id}`)}
              aria-label={`Remove ${p.model}`}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.article>
    );
  }
  function details(p: Product) {
    const reviews = reviewsFor(p.id);
    return (
      <section
        className={styles.focusSheet}
        aria-label={`Details for ${p.model}`}
      >
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>
              In focus · option {s.displayOrder.indexOf(p.id) + 1}
            </span>
            <h3>
              {p.brand} {p.model}
            </h3>
            <p>{p.variantId}</p>
          </div>
          <button
            onClick={() => intent(`Show offers for ${p.id}`)}
            disabled={busy}
          >
            Seller offers <ArrowUpRight size={15} />
          </button>
        </div>
        <dl className={styles.specs}>
          {Object.entries(p.specs).map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <dl className={styles.metrics}>
          <div>
            <dt>Customer stars</dt>
            <dd>
              {reviews?.rating == null
                ? "Not available"
                : `${reviews.rating} / 5`}
            </dd>
          </div>
          <div>
            <dt>Rating count</dt>
            <dd>{reviews?.ratingCount ?? "Not available"}</dd>
          </div>
          <div>
            <dt>Written reviews</dt>
            <dd>{reviews?.writtenReviewCount ?? "Not available"}</dd>
          </div>
          <div>
            <dt>Purchases / period</dt>
            <dd>
              {reviews?.purchaseCount != null && reviews.purchaseCountPeriod
                ? `${reviews.purchaseCount} / ${reviews.purchaseCountPeriod}`
                : "Not available"}
            </dd>
          </div>
        </dl>
        <p className={styles.scope}>
          {reviews
            ? `${reviews.classification} · ${reviews.reviewScope ?? "Review scope unavailable"}. Checked ${reviews.checkedOn}.`
            : "Review source and scope are unavailable."}
          {p.category === "audio"
            ? " These customer metrics do not measure café dictation accuracy."
            : " Customer metrics are not a guarantee of product performance."}
        </p>
        <p>{reviews?.claim ?? "Review synthesis not available."}</p>
        <p className={styles.unavailable}>
          Delivered total and delivery date depend on a seller offer. Reference
          price excludes shipping, fees and any extra hardware.
        </p>
        <div className={styles.inlineActions}>
          <button
            disabled={busy}
            onClick={() => intent(`Show reviews for ${p.id}`)}
          >
            Explore evidence <ArrowUpRight size={15} />
          </button>
          <button disabled={busy} onClick={() => intent(`Save ${p.id}`)}>
            <Bookmark size={15} /> Save with reason
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.canvas}
      aria-label="Shopping product canvas"
      aria-busy={busy}
      data-stable={stable}
    >
      <nav className={styles.progress} aria-label="Shopping stages">
        {steps.map((name, index) => (
          <span
            key={name}
            className={index === stepOf(s.view) ? styles.currentStep : ""}
            aria-current={index === stepOf(s.view) ? "step" : undefined}
          >
            {String(index + 1).padStart(2, "0")} {name}
          </span>
        ))}
      </nav>
      <header className={styles.heading}>
        <span className={styles.eyebrow}>
          {s.category === "audio"
            ? "For the way you work"
            : s.category === "bags"
              ? "Inspired by you"
              : "Comfort, considered"}
        </span>
        <h1>{s.canvas.heading}</h1>
        <p aria-live="polite">{s.canvas.message}</p>
      </header>
      <div
        className={styles.context}
        aria-label="Your current needs and constraints"
      >
        {s.canvas.reference && (
          <img
            src={s.canvas.reference.url}
            alt={s.canvas.reference.alt}
            className={styles.reference}
          />
        )}
        <div className={styles.chips}>
          {s.needs.map((need) => (
            <span key={need}>{need}</span>
          ))}
          {Object.entries(s.hardConstraints)
            .filter(
              ([key]) =>
                !["currency", "deliveryWithinDays", "category"].includes(key),
            )
            .map(([key, value]) => (
              <span key={key} className={styles.constraint}>
                {key === "budgetMinor"
                  ? `Under ${money(Number(value))}`
                  : key === "deadlineDays"
                    ? `Arrive within ${value} ${value === "1" ? "day" : "days"}`
                    : key === "compatibility" ||
                        key === "requiredSpecifications"
                      ? Object.entries(JSON.parse(String(value)))
                          .map(
                            ([k, v]) => `${k.replace(/([A-Z])/g, " $1")}: ${v}`,
                          )
                          .join(" · ")
                      : value}
              </span>
            ))}
          {s.preferences.map((pref) => (
            <span key={pref}>{pref}</span>
          ))}
        </div>
      </div>
      {s.view === "understanding" && (
        <section className={styles.understanding}>
          <div className={styles.understandSymbol}>
            <Check size={26} />
          </div>
          <h2>Good recommendations begin with listening.</h2>
          <p>Keep what’s right. Change what isn’t.</p>
          <div className={styles.examples}>
            <span>“My budget is under $100”</span>
            <span>
              {s.category === "audio"
                ? "“Actually, USB-A”"
                : s.category === "bags"
                  ? "“I prefer the softer shape”"
                  : "“Mattress depth 40 cm”"}
            </span>
          </div>
          <button
            className={styles.primary}
            onClick={() => intent("Explore options")}
            disabled={busy}
          >
            Explore the possibilities <ArrowUpRight size={17} />
          </button>
          <p className={styles.hint}>You can say or type every choice.</p>
        </section>
      )}
      {(s.view === "solution_types" || s.view === "buying_priorities") && (
        <div className={styles.choices}>
          {(s.view === "solution_types" ? solutions : priorities).map(
            (choice, index) => (
              <motion.article
                key={choice.id}
                className={styles.choice}
                initial={stable ? false : { opacity: 0, y: 20, rotateY: -10 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{
                  duration: stable ? 0 : 0.4,
                  delay: stable ? 0 : index * 0.1,
                }}
              >
                {s.view === "solution_types" ? (
                  <img
                    src={`/canvas/${choice.id}.svg`}
                    alt={`${choice.title}, schematic illustration`}
                  />
                ) : (
                  <span className={styles.prioritySymbol} aria-hidden="true">
                    {["↔", "✧", "↓"][index]}
                  </span>
                )}
                <span className={styles.eyebrow}>{choice.tag}</span>
                <h2>{choice.title}</h2>
                <p>{choice.text}</p>
                <p className={styles.compromise}>
                  <span>The trade-off</span> {choice.trade}
                </p>
                <button disabled={busy} onClick={() => intent(choice.command)}>
                  Explore this direction <ArrowUpRight size={15} />
                </button>
              </motion.article>
            ),
          )}
        </div>
      )}
      {[
        "shortlist",
        "saved_choice",
        "comparison",
        "evidence",
        "offers",
        "summary",
        "receipt",
      ].includes(s.view) && (
        <>
          {products.length > 0 ? (
            <>
              <div className={styles.stageToolbar}>
                <span>
                  {s.view === "comparison"
                    ? "Stable comparison"
                    : s.view === "evidence"
                      ? "Stable evidence view"
                      : `${products.length} considered options`}{" "}
                  · positions held while you speak
                </span>
                <div>
                  {products.length >= 2 && (
                    <button
                      disabled={busy}
                      onClick={() => intent("Compare the first two")}
                    >
                      Compare first two
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => intent("Show saved choices")}
                  >
                    <Bookmark size={14} /> {s.savedItems.length} saved
                  </button>
                </div>
              </div>
              {s.view !== "evidence" && (
                <div
                  className={`${styles.products} ${products.length >= 2 ? styles.discovery : ""} ${s.view === "offers" ? styles.offersStrip : ""}`}
                  data-stable={stable}
                >
                  {products.map((p, i) =>
                    card(p, i, s.view === "offers" || products.length > 3),
                  )}
                </div>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              <CircleHelp />
              <h2>No eligible options yet.</h2>
              <p>
                Try revising your budget or essentials. I’ll preserve your other
                preferences.
              </p>
            </div>
          )}
          {s.view === "shortlist" && focused && details(focused)}
          {s.view === "comparison" && products.length > 0 && (
            <div
              className={styles.tableScroll}
              role="region"
              aria-label="Scrollable product comparison"
              tabIndex={0}
            >
              <table className={styles.comparison}>
                <caption>
                  Trade-offs for your current shortlist. Rank reflects this
                  session only.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">What matters</th>
                    {products.map((p) => (
                      <th key={p.id} scope="col">
                        Option {s.displayOrder.indexOf(p.id) + 1}
                        <br />
                        {p.brand} {p.model}
                        <small>{p.variantId}</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    "Why it fits",
                    "Main compromise",
                    "Reference price",
                    "Delivered total",
                    "Customer stars",
                    "Written reviews",
                  ].map((label) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {products.map((p) => {
                        const r = reviewsFor(p.id);
                        return (
                          <td key={p.id}>
                            {label === "Why it fits"
                              ? s.canvas.annotations[p.id]?.fitReason
                              : label === "Main compromise"
                                ? p.limitations[0]
                                : label === "Reference price"
                                  ? money(p.referencePriceMinor)
                                  : label === "Delivered total"
                                    ? "Select seller; not yet known"
                                    : label === "Customer stars"
                                      ? r?.rating == null
                                        ? "Not available"
                                        : `${r.rating}/5 · ${r.ratingCount ?? "unknown"} ratings`
                                      : (r?.writtenReviewCount ??
                                        "Not available")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {s.view === "evidence" && focused && (
            <div className={styles.evidenceLayout}>
              <div className={styles.evidenceProduct} data-stable="true">
                {card(focused, 0)}
                {details(focused)}
              </div>
              <section
                className={styles.evidencePanel}
                aria-label="Evidence and curated video"
              >
                <span className={styles.eyebrow}>
                  Evidence, with its limits
                </span>
                <h2>What supports this choice?</h2>
                {!data.evidence.some(
                  (ev) =>
                    s.evidenceIds.includes(ev.id) &&
                    ev.subjectType === "product" &&
                    ev.subjectId === focused.id &&
                    ev.media,
                ) && (
                  <p className={styles.unavailable}>
                    No playable media is available for this product.
                  </p>
                )}
                {data.evidence
                  .filter(
                    (ev) =>
                      s.evidenceIds.includes(ev.id) &&
                      ev.subjectType === "product" &&
                      ev.subjectId === focused.id,
                  )
                  .map((ev) => (
                    <article className={styles.evidenceItem} key={ev.id}>
                      <div className={styles.evidenceMeta}>
                        <span>{ev.classification}</span>
                        <span>{ev.sourceType}</span>
                      </div>
                      <p>{ev.claim}</p>
                      {ev.excerpt && <blockquote>{ev.excerpt}</blockquote>}
                      <p className={styles.scope}>
                        {ev.media?.creator ??
                          "Research seed / attributed source"}{" "}
                        · checked {ev.checkedOn}
                        {ev.media && ` · Topic: ${ev.media.title}`}
                      </p>
                      {ev.sourceUrl && (
                        <a href={ev.sourceUrl} target="_blank" rel="noreferrer">
                          Open source <ArrowUpRight size={13} />
                        </a>
                      )}
                      {ev.media && (
                        <>
                          <h3>{ev.media.title}</h3>
                          <button disabled={busy} onClick={() => play(ev.id)}>
                            <Play size={15} />{" "}
                            {ev.media.url
                              ? "Play curated explainer"
                              : "Check media availability"}
                          </button>
                          <p className={styles.scope}>
                            Original proxy explainer, not a product review or
                            performance test.
                          </p>
                        </>
                      )}
                    </article>
                  ))}
                {activeEvidence?.media && (
                  <div
                    className={styles.videoPanel}
                    role="region"
                    aria-label="Curated video player"
                  >
                    <div className={styles.sectionHeading}>
                      <strong>{activeEvidence.media.title}</strong>
                      <button
                        onClick={() => stop("stopped")}
                        aria-label="Stop video"
                      >
                        <X size={16} /> Stop
                      </button>
                    </div>
                    {activeEvidence.media.url && !videoError ? (
                      <video
                        ref={videoElement}
                        key={`${videoId}-${videoRequest}`}
                        autoPlay
                        controls
                        playsInline
                        onPlaying={(event) => started(event.currentTarget)}
                        onPause={(event) => {
                          if (
                            event.currentTarget !== videoElement.current ||
                            event.currentTarget.ended
                          )
                            return;
                          const played = activePlayback.current;
                          emitStop("stopped");
                          if (played && activeEvidence?.media)
                            setTakeaway(activeEvidence.media.takeaway);
                        }}
                        onEnded={(event) => {
                          if (event.currentTarget === videoElement.current)
                            stop("ended");
                        }}
                        onError={(event) => {
                          if (event.currentTarget !== videoElement.current)
                            return;
                          emitStop("failed");
                          setVideoError(true);
                          if (videoId)
                            onPlaybackRequest?.({
                              sessionId: s.sessionId,
                              epoch: s.epoch,
                              turnId,
                              revision: s.revision,
                              evidenceId: videoId,
                              phase: "failed",
                            });
                        }}
                        aria-label={activeEvidence.media.title}
                      >
                        <source
                          src={activeEvidence.media.url}
                          type="video/webm"
                        />
                        {activeEvidence.media.captionsUrl && (
                          <track
                            kind="captions"
                            src={activeEvidence.media.captionsUrl}
                            srcLang="en"
                            label="English"
                            default
                          />
                        )}
                      </video>
                    ) : (
                      <p role="status">
                        {videoError
                          ? "Video failed to load. The source remains unavailable; no playback is implied."
                          : "No playable media is available for this product."}
                      </p>
                    )}
                    <p className={styles.scope}>
                      {activeEvidence.media.creator} ·{" "}
                      {activeEvidence.classification} · checked{" "}
                      {activeEvidence.checkedOn}.
                      {activeEvidence.media.url &&
                      activeEvidence.media.captionsUrl
                        ? " English captions available."
                        : " Captions unavailable."}
                      {activeEvidence.media.url &&
                        " Assistant narration pauses during playback."}
                    </p>
                  </div>
                )}
                {takeaway && (
                  <p className={styles.takeaway} role="status">
                    <strong>The takeaway</strong> {takeaway}
                  </p>
                )}
              </section>
            </div>
          )}
          {s.view === "offers" && focused && (
            <section className={styles.offers}>
              <div className={styles.sectionHeading}>
                <img
                  className={styles.offerProductImage}
                  src={focused.image.url}
                  alt={focused.image.alt}
                />
                <div>
                  <span className={styles.eyebrow}>
                    Same product · exact variant
                  </span>
                  <h2>
                    {focused.brand} {focused.model}
                  </h2>
                  <p>{focused.variantId} · fictional demo destination</p>
                </div>
                <span className={styles.proxy}>
                  All fulfillment is synthetic
                </span>
              </div>
              {data.offers
                .filter(
                  (o) =>
                    o.productId === focused.id &&
                    o.variantId === focused.variantId,
                )
                .map((o) => {
                  const total = deliveredTotal(o);
                  const deadline = s.hardConstraints.deadlineDays
                    ? Number(s.hardConstraints.deadlineDays)
                    : null;
                  const eligible =
                    deadline === null ||
                    o.deliveryWindow.latestOffsetDays === null
                      ? null
                      : o.deliveryWindow.latestOffsetDays <= deadline;
                  return (
                    <article
                      key={o.id}
                      className={`${styles.offer} ${o.id === s.selectedOfferId ? styles.selectedOffer : ""}`}
                    >
                      <div>
                        <span className={styles.eyebrow}>{o.sellerId}</span>
                        <h3>
                          {money(total, o.currency)}{" "}
                          <small>
                            {total === null
                              ? "Total incomplete"
                              : "delivered total"}
                          </small>
                        </h3>
                        <p>
                          {money(o.unitPriceMinor, o.currency)} item +{" "}
                          {money(o.shippingMinor, o.currency)} shipping +{" "}
                          {money(o.otherFeesMinor, o.currency)} fees
                          {" + "}
                          {money(o.requiredSetupMinor, o.currency)} required
                          setup
                        </p>
                        <p>Destination: {o.destination}</p>
                        <p>
                          {o.availability === "in_stock"
                            ? "Synthetic stock fixture"
                            : "Availability unverified"}
                        </p>
                        <p>
                          Demo estimate:{" "}
                          {deliveryDate(o.deliveryWindow.latestOffsetDays)} ·
                          based on 24 Oct 2026, Singapore
                        </p>
                        <span
                          className={
                            eligible === true
                              ? styles.onTime
                              : styles.unavailable
                          }
                        >
                          {eligible === true
                            ? "Meets your deadline"
                            : eligible === false
                              ? "Misses your deadline"
                              : deadline === null
                                ? "No deadline set"
                                : "Deadline eligibility unavailable"}
                        </span>
                      </div>
                      <div>
                        <p>{o.returnTerms}</p>
                        {o.conditions.map((c) => (
                          <p className={styles.scope} key={c}>
                            {c}
                          </p>
                        ))}
                        {data.evidence
                          .filter(
                            (e) =>
                              o.evidenceIds.includes(e.id) &&
                              e.subjectType === "seller" &&
                              e.subjectId === o.sellerId,
                          )
                          .map((e) => (
                            <p className={styles.sellerEvidence} key={e.id}>
                              <strong>
                                Seller evidence · {e.classification}
                              </strong>{" "}
                              {e.claim}
                              <span className={styles.scope}>
                                {" "}
                                {e.sourceType} · checked {e.checkedOn}
                              </span>
                              {e.sourceUrl && (
                                <a
                                  href={e.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Seller source <ArrowUpRight size={13} />
                                </a>
                              )}
                            </p>
                          ))}
                        {o.conflicts?.map((reason) => (
                          <p key={reason} role="note">
                            {reason}
                          </p>
                        ))}
                        <button
                          disabled={
                            busy ||
                            total === null ||
                            o.eligible === false ||
                            o.availability !== "in_stock"
                          }
                          onClick={() => intent(`Select offer ${o.id}`)}
                        >
                          {o.id === s.selectedOfferId
                            ? "Selected for comparison"
                            : "Review this offer"}{" "}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
            </section>
          )}
          {s.savedItems.length > 0 && s.view === "saved_choice" && (
            <div className={styles.savedReasons}>
              {s.savedItems.map((item) => (
                <p key={item.id}>
                  <Bookmark size={15} />
                  <strong>
                    {data.products.find((p) => p.id === item.id)?.model}
                  </strong>{" "}
                  {item.rationale}
                </p>
              ))}
            </div>
          )}
        </>
      )}
      {s.exclusions.length > 0 && (
        <p className={styles.restore}>
          {s.exclusions.length} removed from this shortlist{" "}
          <button disabled={busy} onClick={() => intent("Restore shortlist")}>
            <RotateCcw size={14} /> Restore
          </button>
        </p>
      )}
      {s.view !== "understanding" && (
        <footer className={styles.canvasFooter}>
          <span>
            Rank is personal to this shortlist. Focus does not change rank.
          </span>
          <button disabled={busy} onClick={() => intent("Back to shortlist")}>
            Back to exploration <ArrowUpRight size={14} />
          </button>
        </footer>
      )}
    </section>
  );
}
