"use client";

import { useState } from "react";

type Snapshot = {
  sessionId: string;
  epoch: number;
  revision: number;
  view: string;
  scenarioId: string | null;
  scenarioStage: string;
  displayOrder: string[];
  shortlistEntries: Array<{
    productId: string;
    rank?: string;
    fitReason: string;
    compromise: string;
  }>;
  approvalStatus: string;
  evidenceIds: string[];
  buyingPriority: string | null;
};

type Speakable = { content: string; channel: string; revision: number };

export function HarnessConsole() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [speakable, setSpeakable] = useState<Speakable[]>([]);
  const [text, setText] = useState("");
  const [scenario, setScenario] = useState<
    "cafe_dictation" | "bag_inspiration" | "warm_bedding" | ""
  >("cafe_dictation");
  const [modality, setModality] = useState<"text" | "voice" | "image" | "link">(
    "text",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<string | null>(null);

  async function startSession() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario || null,
          preparedAttachmentId:
            scenario === "bag_inspiration" ? "att-bag-navy-ref" : undefined,
        }),
      });
      const data = await res.json();
      setSnapshot(data.snapshot);
      setSpeakable([]);
      setRoute(null);
      await fetch("/api/voice/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: data.snapshot.sessionId }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendTurn() {
    if (!snapshot || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: snapshot.sessionId,
          epoch: snapshot.epoch,
          text,
          modality,
          attachmentId:
            modality === "image" ? "att-bag-navy-ref" : undefined,
          visibleProductIds: snapshot.displayOrder,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "turn failed");
      setSnapshot(data.snapshot);
      setSpeakable(data.speakable ?? []);
      setRoute(data.route);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function simulateVideo() {
    if (!snapshot) return;
    await fetch("/api/lifecycle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: snapshot.sessionId,
        epoch: snapshot.epoch,
        turnId: "ui",
        revision: snapshot.revision,
        type: "video.started",
      }),
    });
    const res = await fetch("/api/lifecycle", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: snapshot.sessionId,
        epoch: snapshot.epoch,
        turnId: "ui",
        revision: snapshot.revision,
        type: "video.stopped",
      }),
    });
    const data = await res.json();
    setSnapshot(data.snapshot);
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          alignItems: "end",
          padding: "1rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 16,
        }}
      >
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Scenario</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as typeof scenario)}
            style={{ padding: "0.55rem 0.7rem", borderRadius: 10, border: "1px solid var(--line)" }}
          >
            <option value="cafe_dictation">Café dictation</option>
            <option value="bag_inspiration">Bag inspiration</option>
            <option value="warm_bedding">Warm bedding</option>
            <option value="">Unspecified</option>
          </select>
        </label>
        <button
          type="button"
          onClick={startSession}
          disabled={busy}
          style={{
            padding: "0.65rem 1rem",
            borderRadius: 999,
            border: 0,
            background: "var(--accent)",
            color: "white",
            fontWeight: 600,
          }}
        >
          Start Chat
        </button>
        {snapshot && (
          <button
            type="button"
            onClick={simulateVideo}
            style={{
              padding: "0.65rem 1rem",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: "white",
            }}
          >
            Simulate video pause
          </button>
        )}
      </section>

      {error && (
        <p style={{ color: "#b42318", margin: 0 }} role="alert">
          {error}
        </p>
      )}

      {snapshot && (
        <section
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
          }}
        >
          <div
            style={{
              padding: "1rem",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 16,
              minHeight: 280,
            }}
          >
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              <div
                aria-hidden
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 30% 30%, #9ec0ff, var(--accent) 55%, #1d4fbf)",
                  boxShadow: "0 10px 30px #2f6fed55",
                }}
              />
              <div>
                <strong>Voice orb</strong>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Duplex adapter · spoken replies for all modalities
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}>
              {speakable.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>
                  Send a turn — commentary below is what GPT-Live would speak.
                </p>
              ) : (
                speakable.map((s, i) => (
                  <blockquote
                    key={`${s.revision}-${i}`}
                    style={{
                      margin: 0,
                      padding: "0.75rem 0.9rem",
                      borderLeft: "3px solid var(--accent)",
                      background: "#fff",
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {s.channel} · rev {s.revision}
                    </div>
                    {s.content}
                  </blockquote>
                ))
              )}
            </div>

            <form
              style={{ marginTop: "1rem", display: "grid", gap: "0.5rem" }}
              onSubmit={(e) => {
                e.preventDefault();
                void sendTurn();
              }}
            >
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <select
                  value={modality}
                  onChange={(e) => setModality(e.target.value as typeof modality)}
                  style={{ padding: "0.5rem", borderRadius: 8, border: "1px solid var(--line)" }}
                >
                  <option value="text">text → spoken reply</option>
                  <option value="voice">voice</option>
                  <option value="image">image</option>
                  <option value="link">link</option>
                </select>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder={
                  modality === "link"
                    ? "https://fixtures.local/ref/bag-001"
                    : "Type a need — reply will still be spoken"
                }
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: 12,
                  border: "1px solid var(--line)",
                  resize: "vertical",
                }}
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                style={{
                  justifySelf: "start",
                  padding: "0.6rem 1rem",
                  borderRadius: 999,
                  border: 0,
                  background: varAccent(),
                  color: "white",
                  fontWeight: 600,
                }}
              >
                Send turn
              </button>
            </form>
          </div>

          <aside
            style={{
              padding: "1rem",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: 16,
            }}
          >
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Accepted state</h2>
            <dl style={{ display: "grid", gap: 6, fontSize: 14, margin: 0 }}>
              <Row k="session" v={snapshot.sessionId} />
              <Row k="revision" v={String(snapshot.revision)} />
              <Row k="view" v={snapshot.view} />
              <Row k="scenario" v={`${snapshot.scenarioId ?? "—"} / ${snapshot.scenarioStage}`} />
              <Row k="priority" v={snapshot.buyingPriority ?? "—"} />
              <Row k="approval" v={snapshot.approvalStatus} />
              <Row k="route" v={route ?? "—"} />
            </dl>
            <h3 style={{ fontSize: 14 }}>Shortlist</h3>
            {snapshot.shortlistEntries.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 14 }}>None yet</p>
            ) : (
              <ol style={{ paddingLeft: "1.1rem", margin: 0 }}>
                {snapshot.shortlistEntries.map((e) => (
                  <li key={e.productId} style={{ marginBottom: 8 }}>
                    <strong>
                      {e.rank ?? "·"} {e.productId}
                    </strong>
                    <div style={{ fontSize: 13, color: "var(--muted)" }}>{e.fitReason}</div>
                    <div style={{ fontSize: 12 }}>Compromise: {e.compromise}</div>
                  </li>
                ))}
              </ol>
            )}
            {snapshot.evidenceIds.length > 0 && (
              <>
                <h3 style={{ fontSize: 14 }}>Evidence</h3>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>
                  {snapshot.evidenceIds.join(", ")}
                </p>
              </>
            )}
          </aside>
        </section>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <dt style={{ color: "var(--muted)" }}>{k}</dt>
      <dd style={{ margin: 0, textAlign: "right" }}>{v}</dd>
    </div>
  );
}

function varAccent() {
  return "var(--accent)";
}
