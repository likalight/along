"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Compass, LoaderCircle } from "lucide-react";
import type { SessionController, ClientState } from "@/lib/session/controller";
import { canAutoImportDiscovery } from "@/lib/session/controller";
import type {
  DiscoveryReference,
  DiscoveryAssessment,
} from "@coupang/contract";
import styles from "./extension-companion.module.css";

type Pending = DiscoveryReference & { sessionId: string; epoch: number };
type PairIdentity = { sessionId: string; epoch: number; extensionId: string };
type PairAttempt = PairIdentity & { requestId: string; abort: AbortController };
const PAIR_KEY = "along.extensionConnection";
const validExtensionId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-p]{32}$/.test(value);
function readPair(): PairIdentity | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PAIR_KEY) ?? "null");
    return value &&
      typeof value.sessionId === "string" &&
      Number.isInteger(value.epoch) &&
      validExtensionId(value.extensionId)
      ? value
      : null;
  } catch {
    return null;
  }
}
function rememberPair(value: PairIdentity | null) {
  try {
    sessionStorage.removeItem("along.extensionSession");
    if (value) sessionStorage.setItem(PAIR_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(PAIR_KEY);
  } catch {
    /* Storage availability does not control the conversation. */
  }
}

/** Pairing is a deliberate action; an extension can only submit reference context. */
export function ExtensionCompanion({
  controller,
  state,
  hasDraft,
}: {
  controller: SessionController;
  state: ClientState;
  hasDraft: boolean;
}) {
  const [extensionId, setExtensionId] = useState<string | null>(null);
  const [pairedWith, setPairedWith] = useState<PairIdentity | null>(null);
  const [hasConnected, setHasConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef({ state, hasDraft });
  current.current = { state, hasDraft };
  const importing = useRef(false);
  const importGeneration = useRef(0);
  const pairGeneration = useRef(0);
  const failed = useRef<string | null>(null);
  const attempt = useRef<PairAttempt | null>(null);
  const sessionId = state.snapshot?.sessionId;
  const epoch = state.snapshot?.epoch;
  const paired =
    !!pairedWith &&
    pairedWith.sessionId === sessionId &&
    pairedWith.epoch === epoch &&
    pairedWith.extensionId === extensionId;

  const currentAttempt = (value: PairAttempt) =>
    attempt.current === value &&
    current.current.state.snapshot?.sessionId === value.sessionId &&
    current.current.state.snapshot?.epoch === value.epoch;

  function disconnected(message?: string) {
    pairGeneration.current++;
    rememberPair(null);
    setPairedWith(null);
    setPending(null);
    failed.current = null;
    if (message) setNote(message);
  }

  useEffect(() => {
    const query = new URL(window.location.href).searchParams;
    const id = query.get("alongExtension");
    const saved = readPair();
    if (validExtensionId(id)) setExtensionId(id);
    else if (saved) setExtensionId(saved.extensionId);
  }, []);

  useEffect(() => {
    attempt.current?.abort.abort();
    attempt.current = null;
    importGeneration.current++;
    pairGeneration.current++;
    importing.current = false;
    failed.current = null;
    setConnecting(false);
    setBusy(false);
    setPending(null);
    const saved = readPair();
    if (saved) setHasConnected(true);
    const matches =
      saved?.sessionId === sessionId &&
      saved?.epoch === epoch &&
      saved?.extensionId === extensionId;
    setPairedWith(matches ? saved : null);
    if (!matches && sessionId && epoch !== undefined && extensionId)
      rememberPair(null);
    setNote(
      saved && !matches
        ? "Reconnect the extension to this conversation."
        : null,
    );
    if (extensionId)
      window.postMessage(
        { type: "ALONG_EXTENSION_STATUS_REQUEST", extensionId },
        window.location.origin,
      );
    return () => {
      attempt.current?.abort.abort();
      attempt.current = null;
      importGeneration.current++;
    };
  }, [sessionId, epoch, extensionId]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !validExtensionId(event.data?.extensionId)
      )
        return;
      if (
        extensionId &&
        event.data.extensionId !== extensionId &&
        event.data.type !== "ALONG_EXTENSION_CONNECT"
      )
        return;
      if (
        ["ALONG_EXTENSION_READY", "ALONG_EXTENSION_CONNECT"].includes(
          event.data.type,
        )
      ) {
        setExtensionId(event.data.extensionId);
        window.postMessage(
          {
            type: "ALONG_EXTENSION_STATUS_REQUEST",
            extensionId: event.data.extensionId,
          },
          window.location.origin,
        );
        return;
      }
      if (event.data.type === "ALONG_EXTENSION_STATUS") {
        setExtensionId(event.data.extensionId);
        if (attempt.current) return;
        if (
          event.data.connected === true &&
          sessionId &&
          epoch !== undefined &&
          event.data.sessionId === sessionId &&
          event.data.epoch === epoch
        ) {
          const value = {
            sessionId,
            epoch,
            extensionId: event.data.extensionId,
          };
          rememberPair(value);
          setPairedWith(value);
          setHasConnected(true);
          setNote(null);
        } else
          disconnected(
            "The extension is disconnected from this conversation. Reconnect when you are ready.",
          );
        return;
      }
      const pairing = attempt.current;
      if (
        event.data.type !== "ALONG_PAIR_RESULT" ||
        !pairing ||
        !currentAttempt(pairing) ||
        event.data.extensionId !== pairing.extensionId ||
        event.data.requestId !== pairing.requestId
      )
        return;
      if (
        event.data.ok &&
        (event.data.sessionId !== pairing.sessionId ||
          event.data.epoch !== pairing.epoch)
      )
        return;
      attempt.current = null;
      setConnecting(false);
      if (event.data.ok) {
        const value = {
          sessionId: pairing.sessionId,
          epoch: pairing.epoch,
          extensionId: pairing.extensionId,
        };
        rememberPair(value);
        setPairedWith(value);
        setHasConnected(true);
        setNote("Connected. Discoveries will join this conversation.");
      } else
        setNote(
          "The extension could not connect. Open its settings and try again.",
        );
    };
    const check = () => {
      if (extensionId)
        window.postMessage(
          { type: "ALONG_EXTENSION_STATUS_REQUEST", extensionId },
          window.location.origin,
        );
    };
    window.addEventListener("message", receive);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("focus", check);
    };
  }, [extensionId, sessionId, epoch]);

  async function connectExtension() {
    if (!sessionId || epoch === undefined || !extensionId || attempt.current)
      return;
    const pairing = {
      sessionId,
      epoch,
      extensionId,
      requestId: crypto.randomUUID(),
      abort: new AbortController(),
    };
    attempt.current = pairing;
    disconnected();
    setConnecting(true);
    setNote(null);
    try {
      const response = await fetch("/api/discovery/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", sessionId, extensionId }),
        signal: pairing.abort.signal,
      });
      const result = await response.json();
      if (!currentAttempt(pairing)) return;
      if (!response.ok) throw new Error(result.error || "Pairing unavailable.");
      window.postMessage(
        {
          type: "ALONG_PAIR_CODE",
          extensionId,
          code: result.code,
          requestId: pairing.requestId,
        },
        window.location.origin,
      );
      setNote("Waiting for the extension to connect…");
    } catch (error) {
      if (!currentAttempt(pairing)) return;
      attempt.current = null;
      setNote(error instanceof Error ? error.message : "Pairing unavailable.");
      setConnecting(false);
    }
  }

  useEffect(() => {
    if (!connecting) return;
    const timeout = window.setTimeout(() => {
      attempt.current?.abort.abort();
      attempt.current = null;
      setConnecting(false);
      setNote(
        "No reply from the extension. Check that it is loaded and has access to this Along address.",
      );
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [connecting]);

  async function bringIntoConversation(item: Pending) {
    const snapshot = current.current.state.snapshot;
    if (
      importing.current ||
      item.sessionId !== snapshot?.sessionId ||
      item.epoch !== snapshot.epoch
    )
      return;
    const generation = importGeneration.current;
    importing.current = true;
    setBusy(true);
    try {
      const accepted = await controller.receiveDiscovery(item.handoffId);
      if (generation !== importGeneration.current) return;
      if (accepted) {
        setPending(null);
        failed.current = null;
      } else failed.current = item.handoffId;
    } catch {
      if (generation === importGeneration.current)
        failed.current = item.handoffId;
    } finally {
      if (generation === importGeneration.current) {
        importing.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    if (!paired || !sessionId || epoch === undefined) return;
    let disposed = false;
    let fetching = false;
    const poll = async () => {
      if (
        disposed ||
        fetching ||
        importing.current ||
        document.visibilityState !== "visible"
      )
        return;
      const generation = pairGeneration.current;
      fetching = true;
      try {
        const response = await fetch(
          `/api/discovery/inbox?sessionId=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" },
        );
        if (
          disposed ||
          generation !== pairGeneration.current ||
          attempt.current
        )
          return;
        if (!response.ok) {
          if ([401, 403, 404, 410].includes(response.status))
            disconnected(
              "This extension connection has expired. Reconnect to continue discovering.",
            );
          return;
        }
        const data = await response.json();
        const item: Pending | null = data.pending ?? null;
        if (
          disposed ||
          generation !== pairGeneration.current ||
          attempt.current
        )
          return;
        if (!item || item.sessionId !== sessionId || item.epoch !== epoch) {
          setPending(null);
          failed.current = null;
          return;
        }
        setPending(item);
        const { state: now, hasDraft: typing } = current.current;
        if (
          canAutoImportDiscovery(now, typing) &&
          failed.current !== item.handoffId
        )
          await bringIntoConversation(item);
      } catch {
        /* Discovery availability must never break the voice agent. */
      } finally {
        fetching = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    window.addEventListener("focus", poll);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", poll);
    };
  }, [paired, sessionId, epoch, controller]);

  if (!extensionId && !pending && !paired) return null;
  return (
    <aside className={styles.companion} aria-label="Chrome companion">
      <span className={styles.icon}>
        <Compass size={21} />
      </span>
      <div className={styles.copy}>
        <strong>
          {pending
            ? "A discovery is ready to join you"
            : paired
              ? "Your Chrome companion is connected"
              : "Bring your browsing into this conversation"}
        </strong>
        <p>
          {pending
            ? `${pending.candidate.title}. Your current conversation stays with you.`
            : paired
              ? "New discoveries return here, with your requirements and conversation intact."
              : (note ??
                "Connect Along’s extension once, then discuss the things you discover by voice or text.")}
        </p>
      </div>
      {pending && (
        <button
          disabled={busy}
          onClick={() => void bringIntoConversation(pending)}
        >
          {busy ? <LoaderCircle size={16} /> : <ArrowUpRight size={16} />} Bring
          into conversation
        </button>
      )}
      {paired && !pending && <Check size={20} aria-label="Connected" />}
      {extensionId && (
        <button
          disabled={!sessionId || epoch === undefined || connecting || busy}
          onClick={() => void connectExtension()}
        >
          {connecting
            ? "Connecting…"
            : paired || hasConnected
              ? "Reconnect extension"
              : "Connect extension"}
        </button>
      )}
    </aside>
  );
}

export function DiscoveryContext({
  reference,
  assessment,
  onCommand,
}: {
  reference: DiscoveryReference;
  assessment?: DiscoveryAssessment;
  onCommand: (text: string) => void;
}) {
  const { candidate, source, mode } = reference;
  return (
    <article
      className={styles.reference}
      aria-label="Discovery in this conversation"
    >
      <div className={styles.referenceTop}>
        <span className={styles.pill}>
          <Compass size={13} />{" "}
          {mode === "demo" ? "DEMO DISCOVERY" : "FROM YOUR BROWSING"}
        </span>
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          Original inspiration <ArrowUpRight size={13} />
        </a>
      </div>
      <h2>{candidate.title}</h2>
      {mode === "demo" &&
        candidate.imageUrl?.startsWith("/catalog/images/") && (
          <img
            className={styles.referenceImage}
            src={candidate.imageUrl}
            alt={`${candidate.title}; catalog photograph or labelled illustration, variant may differ`}
          />
        )}
      <p>
        {candidate.linkKind === "search"
          ? "Suggested search; no listing verified"
          : candidate.match === "exact"
            ? "Identity matched"
            : "A similar option — exact identity is unverified"}
        .{" "}
        {mode === "demo"
          ? "Prepared catalog example; this is not a live Coupang listing or price."
          : "Confirm identity, price and availability on Coupang."}
      </p>
      <div className={styles.referenceBottom}>
        <span>
          {candidate.price
            ? new Intl.NumberFormat("en", {
                style: "currency",
                currency: candidate.price.currency,
              }).format(candidate.price.amount)
            : "Price not verified"}
          {candidate.price && mode === "demo" ? " · demo item price" : ""}
        </span>
        <a href={candidate.url} target="_blank" rel="noopener noreferrer">
          {candidate.linkKind === "search"
            ? "Search on Coupang"
            : "View listing"}{" "}
          <ArrowUpRight size={14} />
        </a>
      </div>
      {assessment && (
        <section
          className={styles.assessment}
          aria-label="How this fits your needs"
        >
          <h3>How this fits your needs</h3>
          {assessment.requirements.length > 0 && (
            <p>Keeping in mind: {assessment.requirements.join(" · ")}</p>
          )}
          <ul className={styles.fitChecks}>
            {assessment.checks.map((check) => (
              <li key={check.key} data-status={check.status}>
                <strong>
                  {check.label}{" "}
                  <span>
                    {check.status === "match"
                      ? "Fits"
                      : check.status === "conflict"
                        ? "Doesn’t fit"
                        : "Not verified"}
                  </span>
                </strong>
                <p>{check.detail}</p>
                <small>
                  {check.source === "catalog"
                    ? "Demo catalog evidence"
                    : check.source === "listing"
                      ? mode === "demo"
                        ? "Demo item price"
                        : "Listing snapshot"
                      : "More information needed"}
                </small>
              </li>
            ))}
          </ul>
          <p className={styles.nextQuestion}>{assessment.nextQuestion}</p>
          {assessment.alternatives.length > 0 && (
            <details className={styles.alternatives}>
              <summary>
                Compare with {assessment.alternatives.length} catalog option
                {assessment.alternatives.length === 1 ? "" : "s"}
              </summary>
              <p>{assessment.alternativesNotice}</p>
              <ul>
                {assessment.alternatives.map((alternative) => (
                  <li key={alternative.productId}>
                    <strong>{alternative.title}</strong>
                    <span>
                      {new Intl.NumberFormat("en", {
                        style: "currency",
                        currency: alternative.total.currency,
                      }).format(alternative.total.amount)}{" "}
                      · demo total
                    </span>
                    <p>{alternative.reason}</p>
                    {alternative.compromises.length > 0 && (
                      <p>Trade-offs: {alternative.compromises.join(" · ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      <div className={styles.questions}>
        {mode === "demo" && candidate.catalogProductId && (
          <button
            onClick={() =>
              onCommand(`Show catalog ${candidate.catalogProductId}`)
            }
          >
            Explore this demo product
          </button>
        )}
        <button onClick={() => onCommand("Why is this similar?")}>
          Why this match?
        </button>
        <button onClick={() => onCommand("How does this fit my requirements?")}>
          Check my requirements
        </button>
        <button onClick={() => onCommand("Back to my catalog")}>
          Back to my catalog
        </button>
      </div>
    </article>
  );
}
