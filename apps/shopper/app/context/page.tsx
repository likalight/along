"use client";

import { useEffect, useState } from "react";
import {
  MEMORY_STORAGE_KEY,
  parseContextExport,
  readLocalPreferences,
  type ReviewedPreference,
} from "@/lib/context/memory";

export default function ContextPage() {
  const [saved, setSaved] = useState<ReviewedPreference[]>([]);
  const [pending, setPending] = useState<ReviewedPreference[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    setSaved(readLocalPreferences());
  }, []);
  async function load(file?: File) {
    if (!file) return;
    setPending([]);
    try {
      if (file.size > 16384)
        throw new Error(
          "Choose a reviewed-preferences export under 16 KB, not raw activity history.",
        );
      const next = parseContextExport(JSON.parse(await file.text()));
      setPending(next);
      setMessage(
        next.length
          ? "Review these preferences before enabling them."
          : "This export has no reviewed preferences.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to read this file.",
      );
    }
  }
  function save() {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(pending));
      setSaved(pending);
      setPending([]);
      setMessage(
        "Enabled on this browser. New shopping sessions receive these preferences. Existing sessions keep their current context.",
      );
    } catch {
      setMessage("Browser storage is unavailable. Preferences were not saved.");
    }
  }
  function forget() {
    try {
      localStorage.removeItem(MEMORY_STORAGE_KEY);
      setSaved([]);
      setPending([]);
      setMessage(
        "Removed from this browser. Start a new shopping session to stop using previously imported context. Delete the Mac copy separately in Along Context.",
      );
    } catch {
      setMessage("Unable to clear browser storage.");
    }
  }
  function rows(items: ReviewedPreference[]) {
    return items.map((p) => (
      <li key={p.key} style={{ padding: "14px 0" }}>
        <strong>
          {p.key === "color" ? "Bag colour" : "Bag style"}: {p.value}
        </strong>
        <p style={{ margin: "4px 0", color: "#526056" }}>
          Source label: {p.sourceApp} · Reviewed{" "}
          {new Date(p.approvedAt).toLocaleDateString()}
        </p>
        <small>
          This is your confirmed preference, not proof of ownership or an
          instruction to purchase.
        </small>
      </li>
    ));
  }
  const control = {
    padding: "12px 18px",
    border: "1px solid #56735c",
    borderRadius: 10,
    cursor: "pointer",
    background: "#edf3ed",
    color: "#203327",
  };
  return (
    <main
      style={{
        maxWidth: 780,
        margin: "40px auto",
        padding: 24,
        color: "#203327",
        background: "#fafcf8",
        borderRadius: 18,
        lineHeight: 1.6,
      }}
    >
      <a href="/">← Along shopping</a>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Bring your Mac context.</h1>
      <p>
        Review locally collected activity in Along Context, then choose what
        your shopper should remember. This website does not record your Mac.
      </p>
      <ol>
        <li>Open the Along Context Mac companion and click Allow.</li>
        <li>Complete macOS Accessibility permission if prompted.</li>
        <li>
          Review an activity, confirm a bag colour or style, and export reviewed
          preferences.
        </li>
        <li>Import that file here. Raw activity text stays on your Mac.</li>
      </ol>
      <label
        style={{
          display: "block",
          padding: 20,
          border: "1px dashed #56735c",
          borderRadius: 12,
        }}
      >
        <strong>Choose an Along Context export (.json)</strong>
        <br />
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            void load(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
      {pending.length > 0 && (
        <section>
          <h2>Review before enabling</h2>
          <ul>{rows(pending)}</ul>
          <button style={control} onClick={save}>
            Use these preferences on this browser
          </button>
        </section>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <section>
        <h2>What Along remembers here</h2>
        {saved.length ? (
          <ul>{rows(saved)}</ul>
        ) : (
          <p>No imported preferences enabled.</p>
        )}
      </section>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="/" style={control}>
          Start a new shopping session
        </a>
        <button style={control} onClick={forget}>
          Forget imported preferences
        </button>
      </div>
      <p>
        <small>
          Preferences persist in this browser for up to 90 days and are sent to
          the Along backend when a new session starts. There is no cross-device
          sync or automatic AI extraction in this version. Activity metadata and
          source labels do not prove a preference; you confirm it.
        </small>
      </p>
    </main>
  );
}
