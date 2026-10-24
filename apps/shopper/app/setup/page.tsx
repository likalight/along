"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "../extension/page.module.css";

export default function SetupPage() {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  return (
    <main className={styles.page}>
      <Link className={styles.brand} href="/">
        along<span>.</span>
      </Link>
      <p className={styles.eyebrow}>ONE ALONG. ALL YOUR CONTEXT.</p>
      <h1>
        A little context.
        <br />A better conversation.
      </h1>
      <p className={styles.lead}>
        Your Mac remembers preferences. Chrome brings inspiration. Along helps
        you choose—with everything in one conversation.
      </p>
      <section className={styles.card}>
        <h2>1. Connect your Mac</h2>
        <p>
          Open <strong>Along Context</strong> on this Mac. Use{" "}
          <strong>Open Along</strong> to pair this browser. If it opens another
          browser, copy that address into Chrome before continuing.
        </p>
        <p>
          Choose <strong>Resume</strong> in the companion when you want to learn
          from supported apps. Redacted readable text goes to OpenAI; learned
          bag preferences stay on this Mac. Pause recording at any time.
        </p>
        <Link className={styles.button} href="/context">
          Check remembered preferences →
        </Link>
        <p className={styles.small}>
          For a fresh rehearsal, use a clearly labelled sample TextEdit note.
          Wait until its preferences appear, then start a new conversation. No
          import or export.
        </p>
        <Link className={styles.button} href="/?fresh=1">
          Start a new conversation →
        </Link>
        <p className={styles.small}>
          Keep that conversation open, then pair Chrome with it.
        </p>
      </section>
      <section className={styles.card} id="chrome">
        <h2>2. Bring Chrome along</h2>
        <p>
          Use desktop Chrome for the combined demo. Load the supplied Along
          extension, then open its settings and set its app address to:
        </p>
        <p>
          <code>{origin || "This app’s address"}</code>
        </p>
        <p>
          Choose <strong>Connect to Along</strong>, then confirm{" "}
          <strong>Connect extension</strong> in your shopping conversation.
          Enable only the sites you want. Optional visual discovery has separate
          consent.
        </p>
        <a
          className={styles.button}
          href="/downloads/along-extension.zip"
          download
        >
          Download Chrome companion ↓
        </a>{" "}
        <Link href="/extension">Installation guide</Link>
      </section>
      <section className={styles.card}>
        <h2>3. Discover, discuss, decide</h2>
        <p>
          Keep your shopping tab open. Choose{" "}
          <strong>Discuss with Along</strong> on a discovery; it returns to that
          same conversation. Ask by voice or text how the item fits your
          preferences. Review an order before confirming it.
        </p>
        <Link className={styles.button} href="/">
          Continue my conversation →
        </Link>
        <p className={styles.small}>
          Start the conversation before pairing Chrome. After starting over or
          restarting the server, reconnect the extension. Your Mac preferences
          remain saved; recording starts paused.
        </p>
      </section>
      <div className={styles.columns}>
        <section className={styles.card}>
          <h2>A reliable rehearsal</h2>
          <p>
            Enable demo examples and the local demo page in the extension. The
            prepared product page exercises the real extension handoff with
            labelled fixture data.
          </p>
          <Link
            className={styles.button}
            href="/extension-demo"
            target="_blank"
          >
            Open prepared inspiration ↗
          </Link>
        </section>
        <section className={styles.card}>
          <h2>You stay in control</h2>
          <p>
            “Your context” shows preferences, their sources and the current
            discovery. Your instructions take priority. External links are not
            verified offers; Along’s checkout is simulated and does not charge
            you.
          </p>
          <p>
            Allow the microphone when you choose Start talking. Typing uses the
            same shopping flow.
          </p>
        </section>
      </div>
    </main>
  );
}
