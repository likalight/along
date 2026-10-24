import Link from "next/link";
import styles from "./page.module.css";

export default function ExtensionGuide() {
  return (
    <main className={styles.page}>
      <Link className={styles.brand} href="/">
        along<span>.</span>
      </Link>
      <p className={styles.eyebrow}>YOUR CONVERSATION, OUT IN THE WORLD</p>
      <h1>
        A little discovery.
        <br />
        The same Along.
      </h1>
      <p className={styles.lead}>
        See something while browsing? Along’s Chrome companion can offer a quiet
        suggestion, then bring it into your existing voice or text conversation.
      </p>
      <section className={styles.card}>
        <h2>Connect your Chrome companion</h2>
        <ol>
          <li>
            <strong>Load the extension.</strong>
            <p>
              Extract the supplied extension package. In desktop Chrome, open{" "}
              <code>chrome://extensions</code>, turn on Developer mode, select
              “Load unpacked,” and choose the folder containing{" "}
              <code>manifest.json</code>.
            </p>
          </li>
          <li>
            <strong>Keep this Along conversation open in Chrome.</strong>
            <p>
              Open the extension settings, set the Along address to this app’s
              address, then choose “Connect to Along.” Confirm “Connect
              extension” in the conversation. Pairing grants discovery access
              only.
            </p>
          </li>
          <li>
            <strong>Choose where Along can help.</strong>
            <p>
              Enable your chosen sites. Automatic discovery is off until you opt
              in. The optional visual mode explains its additional screenshot
              access separately.
            </p>
          </li>
          <li>
            <strong>Browse, then continue the conversation.</strong>
            <p>
              A useful match appears as a small suggestion. Open it, choose an
              item, and select “Discuss with Along.” Your existing needs and
              conversation stay with you.
            </p>
          </li>
        </ol>
      </section>
      <div className={styles.columns}>
        <section className={styles.card}>
          <h2>Try the complete handoff</h2>
          <p>
            Enable demo examples in the extension and allow this local site. The
            prepared inspiration page lets you rehearse automatic discovery
            without a paid API or a live merchant claim.
          </p>
          <Link
            className={styles.button}
            href="/extension-demo"
            target="_blank"
          >
            Open the inspiration demo ↗
          </Link>
          <p className={styles.small}>
            Demo matches and prices are labelled throughout. They are not live
            Coupang listings.
          </p>
        </section>
        <section className={styles.card}>
          <h2>You stay in control</h2>
          <p>
            Pause suggestions, disable a site, or disconnect at any time.
            Discoveries are references; they cannot approve a purchase. Along’s
            existing voice controls and simulated checkout remain available.
          </p>
          <Link className={styles.button} href="/">
            Return to my conversation →
          </Link>
          <p className={styles.small}>
            Desktop Chrome websites only. Native mobile apps are outside
            extension access.
          </p>
        </section>
      </div>
      <p className={styles.small}>
        Recognition can suggest a Coupang search without Partners API access.
        Optional web search can add public product links; prices and availability
        are checked on Coupang. Visual recognition needs a separately enabled
        image provider. Direct Partners results require approved credentials.
      </p>
    </main>
  );
}
