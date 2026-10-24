"use client";

import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/canvas/contracts";
import { productImageFallback } from "@/lib/canvas/product-media";
import CircularCarousel from "./react-bits/CircularCarousel";
import styles from "./product-carousel.module.css";

/** Gesture intents request server focus; the ring only displays accepted focus. */
export function ProductCarousel({
  products,
  focusedId,
  locked,
  onFocus,
  children,
}: {
  products: Product[];
  focusedId?: string | null;
  locked: boolean;
  onFocus: (id: string) => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [supports3d, setSupports3d] = useState(false);
  const [failedSources, setFailedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const markFallback = (source: string) => {
    setFailedSources((previous) =>
      previous.has(source) ? previous : new Set([...previous, source]),
    );
  };
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const swiped = useRef(false);
  useEffect(() => {
    setSupports3d(CSS.supports("transform-style", "preserve-3d"));
  }, []);
  const active = Math.max(
    0,
    products.findIndex((product) => product.id === focusedId),
  );
  const cards = Children.toArray(children);
  const images = useMemo(
    () =>
      products.map((product) => ({
        src: product.image.url,
        fallbackSrc: productImageFallback(product.id),
        alt: product.image.alt,
        title: product.model,
      })),
    [products],
  );
  const select = (index: number) => {
    if (!locked && products.length && index !== active)
      onFocus(products[index].id);
  };
  const move = (direction: number) => {
    if (products.length > 1)
      select((active + direction + products.length) % products.length);
  };
  if (!products.length) return null;
  const current = products[active];
  return (
    <section
      className={styles.carousel}
      aria-label="Product choices"
      data-reduced={Boolean(reduced)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          select(event.key === "Home" ? 0 : products.length - 1);
        }
      }}
    >
      <div
        className={styles.stage}
        data-locked={locked}
        onPointerDown={(event) => {
          if (locked || event.button !== 0) return;
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
          };
          swiped.current = false;
        }}
        onPointerUp={(event) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start || start.id !== event.pointerId) return;
          const x = event.clientX - start.x;
          const y = event.clientY - start.y;
          if (Math.abs(x) > 45 && Math.abs(x) > Math.abs(y) * 1.3) {
            swiped.current = true;
            move(x > 0 ? -1 : 1);
          }
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onClickCapture={(event) => {
          if (swiped.current) {
            event.preventDefault();
            event.stopPropagation();
            swiped.current = false;
          }
        }}
      >
        {supports3d && !reduced && products.length > 1 ? (
          <CircularCarousel
            items={images}
            activeIndex={active}
            preset="cylinder"
            intro="none"
            cardWidth={230}
            aspectRatio={1.2}
            curve={0.1}
            tilt={-6}
            gap={32}
            autoplay="off"
            draggable={false}
            snap={false}
            focusOnClick={false}
            parallax={0}
            stretch={0}
            depthFade={0.16}
            innerShade={0.1}
            fadeColor="#29241e"
            cornerRadius={12}
            onItemClick={(_, index) => select(index)}
            onImageFallback={markFallback}
          />
        ) : (
          <img
            key={current.id}
            className={styles.staticImage}
            src={current.image.url}
            alt={current.image.alt}
            onError={(event) => {
              if (event.currentTarget.dataset.fallback !== "true") {
                event.currentTarget.dataset.fallback = "true";
                event.currentTarget.src = productImageFallback(current.id);
                event.currentTarget.alt = `Generic category illustration for ${current.model}`;
                markFallback(current.image.url);
              }
            }}
          />
        )}
      </div>
      <div className={styles.navigation}>
        <button
          type="button"
          disabled={locked || products.length < 2}
          onClick={() => move(-1)}
          aria-label="Previous product"
        >
          <ChevronLeft size={19} aria-hidden="true" />
        </button>
        <span aria-live="polite" aria-atomic="true">
          {active + 1} of {products.length}
          <span className={styles.hidden}>: {current.model}</span>
        </span>
        <button
          type="button"
          disabled={locked || products.length < 2}
          onClick={() => move(1)}
          aria-label="Next product"
        >
          <ChevronRight size={19} aria-hidden="true" />
        </button>
      </div>
      <p className={styles.source}>
        {failedSources.has(current.image.url)
          ? "Generic category illustration · product image unavailable"
          : current.image.source}
      </p>
      <div className={styles.details}>{cards[active]}</div>
      <div className={styles.choices} aria-label="Choose a product">
        {products.map((product, index) => (
          <button
            type="button"
            key={product.id}
            disabled={locked}
            aria-pressed={index === active}
            onClick={() => select(index)}
            aria-label={`Focus option ${index + 1}: ${product.model}`}
          >
            {index + 1}. {product.model}
          </button>
        ))}
      </div>
    </section>
  );
}
