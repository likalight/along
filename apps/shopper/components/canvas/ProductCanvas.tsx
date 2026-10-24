"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Bookmark,
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
import { AUDIO_SOLUTION_CHOICES } from "@/lib/canvas/solution-choices";
import {
  customerCopy,
  customerDestinationLabel,
  customerNotes,
  customerSellerLabel,
} from "@/lib/canvas/customer-copy";
import { consumerDetails } from "@/lib/canvas/consumer-details";
import { ProductCarousel } from "./ProductCarousel";
import { productImageFallback } from "@/lib/canvas/product-media";
import {
  productSummary,
  reviewEvidence,
} from "@/lib/canvas/product-presentation";

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
  /** Temporary product reference from the audio segment currently playing. */
  narrationProductId?: string | null;
  mediaRequest?: {
    requestId: string;
    evidenceId: string;
    action: "play" | "stop";
    takeaway?: string;
  } | null;
  turnId?: string;
};
const solutions = AUDIO_SOLUTION_CHOICES;
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
    trade: "May cost more; the best fit still depends on your setup.",
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
  narrationProductId,
  mediaRequest,
  turnId = `canvas-${s.revision}`,
}: ProductCanvasProps) {
  const reduced = useReducedMotion();
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);
  const [videoRequest, setVideoRequest] = useState(0);
  const [takeaway, setTakeaway] = useState("");
  const [failedImages, setFailedImages] = useState<Set<string>>(
    () => new Set(),
  );
  const markImageFallback = (source: string) =>
    setFailedImages((previous) =>
      previous.has(source) ? previous : new Set([...previous, source]),
    );
  const imageCredit = (product: Product) =>
    failedImages.has(product.image.url)
      ? "Generic category illustration · product image unavailable"
      : customerCopy(product.image.source);
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
  const presentedProduct =
    products.find((p) => p.id === (narrationProductId ?? s.focusedProductId)) ??
    products[0];
  const presentedAnnotation = presentedProduct
    ? s.canvas.annotations[presentedProduct.id]
    : undefined;
  const recommendationTitle =
    s.view === "saved_choice"
      ? "A choice you saved"
      : presentedAnnotation?.rank === 1 ||
          presentedAnnotation?.role === "Top recommendation"
        ? "Our pick for your brief"
        : "Another option to consider";
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
    busy ||
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

  function card(p: Product, index: number, compact = false) {
    const annotation = s.canvas.annotations[p.id];
    const carouselCard = s.view === "shortlist" || s.view === "saved_choice";
    const pricedOffers = data.offers
      .filter(
        (offer) =>
          offer.productId === p.id &&
          offer.variantId === p.variantId &&
          offer.eligible !== false &&
          offer.availability === "in_stock" &&
          deliveredTotal(offer) !== null,
      )
      .sort((a, b) => deliveredTotal(a)! - deliveredTotal(b)!);
    const lowestOffer = pricedOffers[0];
    const isFocused = p.id === s.focusedProductId;
    const sourceReviews = reviewEvidence(p, data.evidence);
    const metrics = sourceReviews;
    return (
      <motion.article
        key={p.id}
        layoutId={`product-${s.sessionId}-${p.id}`}
        data-product-id={p.id}
        data-number={s.displayOrder.indexOf(p.id) + 1}
        className={`${styles.card} ${carouselCard ? styles.carouselDetails : ""} ${isFocused ? styles.focused : ""} ${compact ? styles.compact : ""}`}
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
        </div>
        {!carouselCard && (
          <div className={styles.productImage}>
            <img
              src={p.image.url}
              alt={p.image.alt}
              loading="lazy"
              onError={(event) => {
                const image = event.currentTarget;
                if (image.dataset.fallback) return;
                image.dataset.fallback = "true";
                image.src = productImageFallback(p.id);
                image.alt = `${p.model}: generic category illustration`;
                markImageFallback(p.image.url);
              }}
            />
            <span>{imageCredit(p)}</span>
          </div>
        )}
        <div className={styles.cardBody}>
          <div className={styles.listingHeader}>
            <div>
              <p className={styles.brand}>{p.brand}</p>
              <h3>{p.model}</h3>
            </div>
            <div className={styles.price}>
              <strong>{money(p.referencePriceMinor)}</strong>
              <span>Reference price</span>
            </div>
          </div>
          <p className={styles.fit}>
            <span>
              {annotation?.fitReason ? "Why this fits" : "At a glance"}
            </span>{" "}
            {customerCopy(annotation?.fitReason ?? productSummary(p))}
          </p>
          {(annotation?.compromise || p.limitations[0]) && (
            <p className={styles.compromise}>
              <span>The trade-off</span>{" "}
              {customerCopy(annotation?.compromise ?? p.limitations[0])}
            </p>
          )}
          {lowestOffer && (
            <p className={styles.offerPrice}>
              {money(deliveredTotal(lowestOffer), lowestOffer.currency)}{" "}
              delivered
            </p>
          )}
          {metrics?.rating != null && (
            <p className={styles.metricHint}>
              {metrics.rating}/5 ·{" "}
              {metrics.ratingCount?.toLocaleString() ?? "unavailable"} source
              ratings
            </p>
          )}
          <div className={styles.cardActions}>
            <button
              disabled={busy}
              onClick={() => intent(`Show offers for ${p.id}`)}
              aria-label={`View offers for ${p.model}`}
            >
              View offers <ArrowUpRight size={15} />
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
    const reviews = reviewEvidence(p, data.evidence);
    return (
      <section
        className={styles.focusSheet}
        aria-label={`Details for ${p.model}`}
      >
        <div className={styles.sectionHeading}>
          <div>
            <h3>
              {p.brand} {p.model}
            </h3>
          </div>
          <button
            onClick={() => intent(`Show offers for ${p.id}`)}
            disabled={busy}
          >
            Seller offers <ArrowUpRight size={15} />
          </button>
        </div>
        <dl className={styles.specs}>
          {consumerDetails(p.specs).map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <h4 className={styles.reviewHeading}>Source review snapshot</h4>
        {reviews &&
        (reviews.rating != null ||
          reviews.ratingCount != null ||
          reviews.writtenReviewCount != null) ? (
          <>
            <dl className={styles.metrics}>
              {reviews.rating != null && (
                <div>
                  <dt>Source rating</dt>
                  <dd>{reviews.rating} / 5</dd>
                </div>
              )}
              {reviews.ratingCount != null && (
                <div>
                  <dt>Ratings</dt>
                  <dd>{reviews.ratingCount.toLocaleString()}</dd>
                </div>
              )}
              {reviews.writtenReviewCount != null && (
                <div>
                  <dt>Written reviews</dt>
                  <dd>{reviews.writtenReviewCount.toLocaleString()}</dd>
                </div>
              )}
            </dl>
            <p className={styles.scope}>
              {reviews.reviewScope}{" "}
              {reviews.checkedOn ? `Checked ${reviews.checkedOn}.` : ""}
            </p>
            {reviews.claim && <p>{reviews.claim}</p>}
          </>
        ) : (
          <p className={styles.unavailable}>
            No real customer review snapshot was captured for this product.
          </p>
        )}
        <p className={styles.scope}>
          Reference prices exclude shipping and extras. Choose an offer to see
          the delivered total.
        </p>
        <div className={styles.inlineActions}>
          <button
            disabled={busy}
            onClick={() => intent(`Show reviews for ${p.id}`)}
          >
            Reviews and sources <ArrowUpRight size={15} />
          </button>
          <button disabled={busy} onClick={() => intent(`Save ${p.id}`)}>
            <Bookmark size={15} /> Save
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
      {s.canvas.reference && (
        <div className={styles.context}>
          <img
            src={s.canvas.reference.url}
            alt={s.canvas.reference.alt}
            className={styles.reference}
          />
          <span>Your reference image</span>
        </div>
      )}
      {s.view === "solution_types" && (
        <section
          className={styles.directionChoices}
          aria-label="Microphone setups"
        >
          {solutions.map((choice) => (
            <button
              key={choice.id}
              className={styles.directionChoice}
              disabled={busy}
              onClick={() => intent(choice.command)}
            >
              <span>
                <strong>{choice.title}</strong>
                <span>{choice.text}</span>
              </span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </button>
          ))}
          <p>You can also ask me to talk it through.</p>
        </section>
      )}
      {s.view === "buying_priorities" && (
        <section aria-label="Choose a buying priority">
          <div className={styles.choices}>
            {priorities.map((choice, index) => (
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
                <span className={styles.directionLabel}>
                  {index + 1} · {choice.tag}
                </span>
                <h3>{choice.title}</h3>
                <p>{choice.text}</p>
                <p className={styles.compromise}>
                  <span>The trade-off</span> {choice.trade}
                </p>
                <button disabled={busy} onClick={() => intent(choice.command)}>
                  Explore this direction <ArrowUpRight size={15} />
                </button>
              </motion.article>
            ))}
          </div>
        </section>
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
              {(s.view === "shortlist" || s.view === "saved_choice") && (
                <h2 className={styles.recommendationHeading}>
                  {recommendationTitle}
                </h2>
              )}
              <div className={styles.stageToolbar}>
                <span>
                  {s.view === "comparison"
                    ? "Compare products"
                    : `${products.length} ${products.length === 1 ? "option" : "options"}`}
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
              {s.view !== "evidence" &&
                (s.view === "shortlist" || s.view === "saved_choice" ? (
                  <ProductCarousel
                    products={products}
                    focusedId={narrationProductId ?? s.focusedProductId}
                    locked={busy || interpretingSpatialReference}
                    onFocus={(id) => intent(`Focus ${id}`)}
                  >
                    {products.map((p, i) => card(p, i))}
                  </ProductCarousel>
                ) : (
                  <div
                    className={`${styles.products} ${s.view === "comparison" ? styles.comparisonSpread : ""} ${s.view === "offers" ? styles.offersStrip : ""}`}
                    data-stable={stable}
                  >
                    {products.map((p, i) =>
                      card(p, i, s.view === "offers" || products.length > 3),
                    )}
                  </div>
                ))}
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
          {s.view === "shortlist" && focused && (
            <details className={styles.moreDetails}>
              <summary>Product details</summary>
              {details(focused)}
            </details>
          )}
          {s.view === "comparison" && products.length > 0 && (
            <div
              className={styles.tableScroll}
              role="region"
              aria-label="Scrollable product comparison"
              tabIndex={0}
            >
              <table className={styles.comparison}>
                <caption>Prices and trade-offs for these products.</caption>
                <thead>
                  <tr>
                    <th scope="col">What matters</th>
                    {products.map((p) => (
                      <th key={p.id} scope="col">
                        Option {s.displayOrder.indexOf(p.id) + 1}
                        <br />
                        {p.brand} {p.model}
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
                    "Source stars",
                  ].map((label) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {products.map((p) => {
                        const r = reviewEvidence(p, data.evidence);
                        return (
                          <td key={p.id}>
                            {label === "Why it fits"
                              ? (s.canvas.annotations[p.id]?.fitReason ??
                                customerCopy(productSummary(p)))
                              : label === "Main compromise"
                                ? customerCopy(p.limitations[0] ?? "")
                                : label === "Reference price"
                                  ? money(p.referencePriceMinor)
                                  : label === "Delivered total"
                                    ? "Select seller; not yet known"
                                    : r?.rating == null
                                      ? "Not available"
                                      : `${r.rating}/5 · ${r.writtenReviewCount ?? "unknown"} source reviews`}
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
                      ev.subjectId === focused.id &&
                      !(
                        ev.classification === "proxy" &&
                        /review/i.test(ev.sourceType)
                      ),
                  )
                  .map((ev) => (
                    <article className={styles.evidenceItem} key={ev.id}>
                      <div className={styles.evidenceMeta}>
                        <span>{ev.sourceType}</span>
                      </div>
                      {customerCopy(ev.claim) && (
                        <p>{customerCopy(ev.claim)}</p>
                      )}
                      {ev.excerpt && customerCopy(ev.excerpt) && (
                        <blockquote>{customerCopy(ev.excerpt)}</blockquote>
                      )}
                      <p className={styles.scope}>
                        {ev.media?.creator ? `${ev.media.creator} · ` : ""}
                        Checked {ev.checkedOn}
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
                            Illustrative explainer, not a product review or
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
                  onError={(event) => {
                    const image = event.currentTarget;
                    if (image.dataset.fallback) return;
                    image.dataset.fallback = "true";
                    image.src = productImageFallback(focused.id);
                    image.alt = `${focused.model}: generic category illustration`;
                    markImageFallback(focused.image.url);
                  }}
                />
                <div>
                  <h2>
                    {focused.brand} {focused.model}
                  </h2>
                  <p>Offers for this product</p>
                  <p className={styles.scope}>{imageCredit(focused)}</p>
                </div>
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
                        <p>{customerSellerLabel(o.sellerId)}</p>
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
                        <p>
                          Destination: {customerDestinationLabel(o.destination)}
                        </p>
                        <p>
                          {o.availability === "in_stock"
                            ? "In stock"
                            : "Availability unverified"}
                        </p>
                        <p>
                          Delivery estimate:{" "}
                          {deliveryDate(o.deliveryWindow.latestOffsetDays)}
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
                        {customerCopy(o.returnTerms) && (
                          <p>{customerCopy(o.returnTerms)}</p>
                        )}
                        {customerNotes(o.conditions).map((c) => (
                          <p className={styles.scope} key={c}>
                            {c}
                          </p>
                        ))}
                        {data.evidence
                          .filter(
                            (e) =>
                              o.evidenceIds.includes(e.id) &&
                              e.subjectType === "seller" &&
                              e.subjectId === o.sellerId &&
                              e.classification !== "proxy" &&
                              !/fixture|authored/i.test(e.sourceType) &&
                              Boolean(customerCopy(e.claim)),
                          )
                          .map((e) => (
                            <p className={styles.sellerEvidence} key={e.id}>
                              <strong>Seller details</strong>{" "}
                              {customerCopy(e.claim)}
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
                        {customerNotes(o.conflicts ?? []).map((reason) => (
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
                            ? "Selected offer"
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
      {products.length > 0 &&
        !["understanding", "shortlist", "saved_choice"].includes(s.view) && (
          <footer className={styles.canvasFooter}>
            <button disabled={busy} onClick={() => intent("Back to shortlist")}>
              Back to products <ArrowUpRight size={14} />
            </button>
          </footer>
        )}
    </section>
  );
}
