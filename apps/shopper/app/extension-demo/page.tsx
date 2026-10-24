import Link from "next/link";
import styles from "./page.module.css";

const product = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Osprey Daylite Large Tote Pack — a work and gym bag",
  description:
    "A tote backpack for a laptop, everyday commuting and gym clothes. Prepared inspiration example for Along’s Chrome companion.",
  brand: { "@type": "Brand", name: "Osprey" },
  image: "/catalog/images/products/BAG-001.webp",
};
export default function ExtensionDemo() {
  return (
    <main className={styles.page} data-along-demo="true">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(product).replace(/</g, "\\u003c"),
        }}
      />
      <header>
        <Link href="/extension">
          along<span>.</span> / companion rehearsal
        </Link>
        <span>PREPARED INSPIRATION · DEMO</span>
      </header>
      <div className={styles.story}>
        <article>
          <p className={styles.eyebrow}>THE EVERYDAY EDIT / 01</p>
          <h1 data-along-product-title>{product.name}</h1>
          <p className={styles.lead}>
            Laptop in the morning. Gym kit by evening. A tote that carries the
            in-between.
          </p>
          <p>
            This prepared page features BAG-001 in Along’s catalog: the Osprey
            Daylite Large Tote Pack. The photograph is sourced from Osprey;
            pictured color may differ from the simulated offer.
          </p>
          <div className={styles.caption}>
            <strong>Just browse for a moment.</strong>
            <p>
              With the extension connected, demo examples enabled and this site
              allowed, a quiet suggestion will appear automatically. No search
              or pasted link is needed.
            </p>
          </div>
        </article>
        <figure>
          <img
            src={product.image}
            alt="Osprey Daylite Large Tote Pack, manufacturer product photograph"
          />
          <figcaption>
            <a
              href="https://www.osprey.com/daylitetm-large-tote-pack"
              target="_blank"
              rel="noopener noreferrer"
            >
              Photograph source: Osprey ↗
            </a>{" "}
            · demo offers are simulated
          </figcaption>
        </figure>
      </div>
      <section className={styles.caption}>
        <h2>Rehearse on a real video</h2>
        <p>
          With YouTube enabled and Demo mode on, open Osprey’s product tour. The
          companion uses a curated tour-to-product mapping for these two videos.
          Demo mode does not analyze video pixels. Choose “Discuss with Along,”
          then “Explore this demo product” to compare its simulated offers and
          review an order.
        </p>
        <a
          href="https://www.youtube.com/watch?v=AVs7Do3J64I"
          target="_blank"
          rel="noopener noreferrer"
        >
          Osprey Daylite Large Tote Pack · BAG-001 ↗
        </a>
        <p>
          <a
            href="https://www.youtube.com/watch?v=0S89xGN-SO8"
            target="_blank"
            rel="noopener noreferrer"
          >
            Alternative: Daylite Tote Pack · BAG-002 ↗
          </a>
        </p>
      </section>
      <footer>
        Use “Discuss with Along” on a result to return to the same conversation.
        Demo prices are synthetic; Coupang search links are not verified
        listings.
      </footer>
    </main>
  );
}
