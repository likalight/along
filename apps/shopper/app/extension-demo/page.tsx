import Link from "next/link";
import styles from "./page.module.css";

const product = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Osprey Daylite Tote Pack — a work and gym bag",
  description:
    "A tote backpack for a laptop, everyday commuting and gym clothes. Prepared inspiration example for Along’s Chrome companion.",
  brand: { "@type": "Brand", name: "Osprey" },
  image: "/fixtures/navy-bag.svg",
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
            This prepared example features an Osprey Daylite Tote Pack
            reference. The illustration is a proxy, not a photograph or a
            verified match.
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
            src="/fixtures/navy-bag.svg"
            alt="Prepared navy tote illustration, a proxy for a work and gym bag"
          />
          <figcaption>Illustration · not a retailer photograph</figcaption>
        </figure>
      </div>
      <footer>
        Use “Discuss with Along” on a result to return to the same conversation.
        Demo prices are synthetic; Coupang search links are not verified
        listings.
      </footer>
    </main>
  );
}
