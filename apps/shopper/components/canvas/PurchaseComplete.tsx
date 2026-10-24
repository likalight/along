"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Session } from "@/lib/session/contract";
import { money, type Product } from "@/lib/canvas/contracts";
import { productImageFallback } from "@/lib/canvas/product-media";
import { customerCopy, customerDestinationLabel } from "@/lib/canvas/customer-copy";
import styles from "./canvas.module.css";

export function PurchaseComplete({
  receipt,
  product,
}: {
  receipt: NonNullable<Session["receipt"]>;
  product?: Product;
}) {
  const reduced = useReducedMotion();
  const order = receipt.acceptedOrder;
  const delivery = customerCopy(order.deliveryWindow);
  const orderNumber = receipt.id.replace(/[^a-z0-9]/gi, "").slice(-8).toUpperCase();

  return (
    <section className={styles.purchaseComplete} aria-label="Order confirmation">
      <div className={styles.purchaseHeading} role="status">
        <motion.div
          key={receipt.id}
          className={styles.purchaseCheck}
          initial={reduced ? false : { scale: 0.76, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 48 48" fill="none">
            <motion.path
              d="M12 24.5 20.5 33 36 16"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: reduced ? 0 : 0.36, delay: reduced ? 0 : 0.16 }}
            />
          </svg>
        </motion.div>
        <p>Order confirmed</p>
        <h2>You’re all set.</h2>
        {receipt.simulated && (
          <p className={styles.purchaseDisclosure}>
            Simulated order · no payment was taken
          </p>
        )}
      </div>

      <div className={styles.purchaseItem}>
        {product && (
          <img
            src={product.image.url}
            alt={product.image.alt}
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallback) return;
              image.dataset.fallback = "true";
              image.src = productImageFallback(product.id);
              image.alt = product.model;
            }}
          />
        )}
        <div>
          <strong>{product ? `${product.brand} ${product.model}` : order.productId}</strong>
          <span>Quantity {order.quantity}</span>
        </div>
        <strong className={styles.purchaseTotal}>{money(order.totalMinor, order.currency)}</strong>
      </div>

      <dl className={styles.purchaseDetails}>
        <div>
          <dt>Expected delivery</dt>
          <dd>{delivery || "Delivery estimate unavailable"}</dd>
        </div>
        <div>
          <dt>Delivering to</dt>
          <dd>{customerDestinationLabel(order.destination) || "Destination unavailable"}</dd>
        </div>
      </dl>
      <p className={styles.purchaseReference}>Order {orderNumber}</p>
    </section>
  );
}
