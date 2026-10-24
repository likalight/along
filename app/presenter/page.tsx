"use client";
import { useState } from "react";
export default function Presenter() {
  const [key, setKey] = useState(0);
  return (
    <div className="presenter">
      <header>
        <strong>Presenter-only preview</strong>
        <span>Separate from the shopper experience</span>
        <button onClick={() => setKey((k) => k + 1)}>
          Play demo / Replay entrance
        </button>
        <a href="/" target="_blank">
          Open shopper UI
        </a>
      </header>
      <aside>
        <strong>Rehearsal commands</strong>
        <p>
          Choose text mode. Try “a work and gym bag” → “shape, under USD 150” →
          “compare” → “show option 1” → “show evidence” → “show offers” →
          “choose faster offer” → “confirm simulated purchase”.
        </p>
        <p>
          Prepared link: https://demo.example/bags/navy. Voice uses the same
          commands. Preview dates are fixed to 24 October 2026.
        </p>
        <p>
          Gmail preview · Not connected. Outlook preview · Not connected. No
          OAuth or mailbox access is requested.
        </p>
      </aside>
      <iframe key={key} src="/" title="Shopper session rehearsal" />
    </div>
  );
}
