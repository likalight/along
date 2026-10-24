"use client";

import { useEffect, useState } from "react";
import type { Session } from "@/lib/session/contract";
import type { LearnedMemory } from "@/lib/context/automatic";
import styles from "./context-overview.module.css";

type Profile = { enabled: boolean; memories: LearnedMemory[] };
const labels: Record<string, string> = {
  color: "Colour",
  shape: "Style",
  bagPriority: "Priority",
};
function preference(text: string) {
  try {
    const pair: unknown = JSON.parse(text);
    if (
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every((v) => typeof v === "string")
    )
      return `${labels[pair[0]] ?? pair[0]}: ${pair[1] === "weight" ? "lightweight" : pair[1]}`;
  } catch {
    /* Older sessions may contain plain-language preferences. */
  }
  const colon = text.indexOf(": ");
  if (colon > 0 && labels[text.slice(0, colon)]) {
    const value = text.slice(colon + 2);
    return `${labels[text.slice(0, colon)]}: ${value === "weight" ? "lightweight" : value}`;
  }
  return text;
}
function includesMemory(active: string[], memory: LearnedMemory) {
  return (
    active.includes(`${memory.key}: ${memory.value}`) ||
    active.includes(JSON.stringify([memory.key, memory.value]))
  );
}
export function ContextOverview({
  session,
  chrome,
  onNewConversation,
}: {
  session?: Session | null;
  chrome: "unavailable" | "available" | "connected";
  onNewConversation: () => void;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState("Checking Mac connection…");
  useEffect(() => {
    let alive = true;
    let pending = false;
    const abort = new AbortController();
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/context", {
          cache: "no-store",
          signal: abort.signal,
        });
        const data = await response.json();
        if (!alive) return;
        setProfile(response.ok ? data : null);
        setStatus(
          response.ok
            ? data.enabled
              ? "Learning enabled"
              : "Learning paused"
            : response.status === 401
              ? "Pair this browser from the Mac companion"
              : "Mac companion not connected",
        );
      } catch {
        if (alive) {
          setProfile(null);
          setStatus("Mac connection unavailable");
        }
      } finally {
        pending = false;
      }
    }
    void refresh();
    const interval = setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      alive = false;
      abort.abort();
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  const active = session?.preferences ?? [];
  const hasNew = profile?.memories.some((m) => !includesMemory(active, m));
  const reference = session?.discoveryReference;
  return (
    <details className={styles.root}>
      <summary>
        Your context{" "}
        <span>
          {active.length
            ? `${active.length} ${active.length === 1 ? "preference" : "preferences"}`
            : "Make Along personal"}
          {reference ? " · 1 discovery" : ""}
        </span>
      </summary>
      <div className={styles.body}>
        <header>
          <div>
            <h2>One conversation. Your context.</h2>
            <p>What you like, what caught your eye, and what you need now.</p>
          </div>
          <a href="/setup" target="_blank" rel="noopener noreferrer">
            Connect your companions ↗
          </a>
        </header>
        <div className={styles.grid}>
          <section>
            <span className={styles.eyebrow}>FROM YOUR MAC</span>
            <h3>{status}</h3>
            {profile?.memories.length ? (
              <ul>
                {profile.memories.map((m) => (
                  <li key={m.id}>
                    <strong>
                      {preference(JSON.stringify([m.key, m.value]))}
                    </strong>
                    <small>
                      {m.origin === "corrected"
                        ? "Corrected by you"
                        : `Learned from ${m.sourceApp}`}{" "}
                      ·{" "}
                      {includesMemory(active, m)
                        ? "In this conversation"
                        : "For your next conversation"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Supported app activity can teach Along your bag preferences.
                Recording stays under your control.
              </p>
            )}
            <a href="/context" target="_blank" rel="noopener noreferrer">
              Manage remembered preferences ↗
            </a>
          </section>
          <section>
            <span className={styles.eyebrow}>FROM YOUR BROWSING</span>
            <h3>
              {chrome === "connected"
                ? "Chrome connected"
                : chrome === "available"
                  ? "Ready to connect Chrome"
                  : "Connect Chrome"}
            </h3>
            {reference ? (
              <>
                <p>{reference.candidate.title}</p>
                <a
                  href={reference.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View original inspiration ↗
                </a>
                <small>
                  {reference.mode === "demo"
                    ? "Prepared demo discovery"
                    : "External reference · details need verification"}
                </small>
              </>
            ) : (
              <p>
                Choose “Discuss with Along” on a discovery. It joins this
                conversation without starting over.
              </p>
            )}
            <a href="/extension" target="_blank" rel="noopener noreferrer">
              Chrome setup ↗
            </a>
          </section>
          <section>
            <span className={styles.eyebrow}>FOR THIS CONVERSATION</span>
            <h3>Your current brief</h3>
            {active.length ? (
              <ul>
                {active.map((p) => (
                  <li key={p}>{preference(p)}</li>
                ))}
              </ul>
            ) : null}
            {session?.needs?.length ? <p>{session.needs.join(" · ")}</p> : null}
            {Object.entries(session?.hardConstraints ?? {}).map(
              ([key, value]) => (
                <p key={key}>
                  {key}: {value}
                </p>
              ),
            )}
            {!active.length &&
            !session?.needs?.length &&
            !Object.keys(session?.hardConstraints ?? {}).length ? (
              <p>
                Start talking or typing. Tell Along what matters; your current
                instructions take priority.
              </p>
            ) : null}
            <small>
              Context helps evaluate choices. It never authorizes a purchase.
            </small>
          </section>
        </div>
        <footer>
          <p>
            {hasNew
              ? "New Mac preferences are ready. Start a new conversation to use them."
              : "New conversations use your latest Mac preferences. Reconnect Chrome after starting over."}
          </p>
          <button onClick={onNewConversation}>New conversation</button>
        </footer>
      </div>
    </details>
  );
}
