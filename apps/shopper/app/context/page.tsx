"use client";
import { useEffect, useState } from "react";
import type { LearnedMemory } from "@/lib/context/automatic";
const options: Record<string, string[]> = {
  color: ["black", "navy", "olive", "khaki", "slate"],
  shape: ["backpack", "tote", "sling", "duffel"],
  bagPriority: ["weight", "capacity"],
};
const labels: Record<string, string> = {
  color: "Bag colour",
  shape: "Bag style",
  bagPriority: "Bag priority",
};
type Profile = {
  enabled: boolean;
  memories: LearnedMemory[];
  status: string;
  lastSyncedAt: string | null;
};
export default function ContextPage() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [message, setMessage] = useState("Connecting…"),
    [busy, setBusy] = useState(false);
  async function action(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const r = await fetch("/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setProfile(data);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to connect.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let alive = true;
    const token = new URLSearchParams(location.hash.slice(1)).get("pair");
    if (token) {
      history.replaceState(null, "", location.pathname);
      void action("pair", { token });
    }
    const refresh = async () => {
      try {
        const r = await fetch("/api/context", { cache: "no-store" });
        const data = await r.json();
        if (alive) {
          if (r.ok) {
            setProfile(data);
            setMessage("");
          } else setMessage(data.error);
        }
      } catch {
        if (alive)
          setMessage(
            "Along is offline. Your saved preferences remain on this Mac.",
          );
      }
    };
    if (!token) void refresh();
    const interval = setInterval(refresh, 5000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);
  const control = {
    padding: "11px 16px",
    border: "1px solid #607566",
    borderRadius: 10,
    background: "#edf3ed",
    color: "#203327",
    cursor: "pointer",
  };
  return (
    <main
      style={{
        maxWidth: 740,
        margin: "40px auto",
        padding: 28,
        color: "#203327",
        background: "#fafcf8",
        borderRadius: 18,
        lineHeight: 1.6,
      }}
    >
      <a href="/">← Along shopping</a>
      <h1 style={{ fontSize: 36, marginBottom: 8 }}>Along remembers.</h1>
      <p>
        Your Mac companion learns shopping preferences as you use supported
        apps. No files to export or import.
      </p>
      <p>
        When you allow learning, redacted text from TextEdit, Notes, Mail and
        Outlook goes to OpenAI through this local server. Browser content,
        passwords, screenshots and audio are excluded. Inferences can be wrong;
        change or remove them here.
      </p>
      {!profile ? (
        <p role="status">
          {message} Open the Mac companion, click Allow, then Open Along to pair
          this browser.
        </p>
      ) : (
        <>
          <p role="status">
            <strong>
              {profile.enabled ? "Learning is on" : "Learning is paused"}
            </strong>{" "}
            · {profile.status}
          </p>
          <button
            style={control}
            disabled={busy}
            onClick={() => void action(profile.enabled ? "pause" : "resume")}
          >
            {profile.enabled ? "Pause learning" : "Allow learning"}
          </button>
          <p>
            <small>
              This controls learning. Use Pause in the Mac companion to stop
              recording too.
            </small>
          </p>
          <h2>What Along knows</h2>
          {!profile.memories.length ? (
            <p>
              No preferences learned yet. A clear statement such as “I prefer
              olive backpacks” in a supported app is enough. Product mentions
              alone do not count.
            </p>
          ) : (
            profile.memories.map((m) => (
              <section
                key={m.key}
                style={{ borderTop: "1px solid #d5dfd6", padding: "18px 0" }}
              >
                <label>
                  <strong>{labels[m.key]} </strong>
                  <select
                    aria-label={labels[m.key]}
                    value={m.value}
                    disabled={busy}
                    style={control}
                    onChange={(e) =>
                      void action("correct", {
                        key: m.key,
                        value: e.target.value,
                      })
                    }
                  >
                    {options[m.key]?.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <p style={{ margin: "6px 0" }}>
                  {" "}
                  {m.origin === "corrected"
                    ? "Set by you"
                    : `Learned from ${m.sourceApp} · ${Math.round(m.confidence * 100)}% confidence`}{" "}
                  · {new Date(m.observedAt).toLocaleDateString()}
                </p>
                <button
                  style={control}
                  disabled={busy}
                  onClick={() => void action("delete", { key: m.key })}
                >
                  Forget {labels[m.key].toLowerCase()}
                </button>
              </section>
            ))
          )}
          <p role="status">{message}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/?fresh=1" style={control}>
              Start shopping with these preferences
            </a>
            <button
              style={control}
              disabled={busy}
              onClick={() => void action("forget")}
            >
              Forget all & pause
            </button>
            <button
              style={control}
              disabled={busy}
              onClick={() => void action("relearn")}
            >
              Reset corrections & learn anew
            </button>
          </div>
          <p>
            <small>
              Preferences are soft defaults for new conversations, never
              permission to buy. Current instructions win. Forgotten or
              corrected fields stay protected from automatic relearning until
              you reset corrections. Existing conversations keep their context;
              start a new conversation after changes. Saved preferences expire
              after 90 days. This connection works on this Mac only.
            </small>
          </p>
        </>
      )}
    </main>
  );
}
