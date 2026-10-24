import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getRuntime } from "@/lib/integration/runtime";
import {
  DiscoveryError,
  type DiscoveryResult,
  type PendingHandoff,
} from "./types";
import { extensionId, extensionOrigin } from "./security";

export const CODE_TTL_MS = 5 * 60_000;
export const TOKEN_TTL_MS = 2 * 60 * 60_000;
export const RESULT_TTL_MS = 10 * 60_000;
export type Pair = {
  sessionId: string;
  epoch: number;
  extensionId: string;
  expiresAt: number;
  key: string;
  generation: number;
};
type Code = Omit<Pair, "key" | "generation">;
type StoredResult = {
  pairKey: string;
  sessionId: string;
  epoch: number;
  expiresAt: number;
  result: DiscoveryResult;
};
type Rate = { count: number; until: number };
type State = {
  codes: Map<string, Code>;
  pairs: Map<string, Pair>;
  results: Map<string, StoredResult>;
  pending: Map<string, PendingHandoff>;
  handedOff: Map<string, PendingHandoff>;
  rates: Map<string, Rate>;
};
const globals = globalThis as unknown as { __alongDiscovery?: State };
const state = (): State =>
  (globals.__alongDiscovery ??= {
    codes: new Map(),
    pairs: new Map(),
    results: new Map(),
    pending: new Map(),
    handedOff: new Map(),
    rates: new Map(),
  });
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
function sweep() {
  const s = state(),
    now = Date.now();
  for (const map of [s.codes, s.pairs, s.results, s.pending, s.handedOff]) {
    for (const [key, value] of map) if (value.expiresAt <= now) map.delete(key);
  }
  for (const [key, rate] of s.rates) if (rate.until <= now) s.rates.delete(key);
}
function bounded(map: Map<string, unknown>, max = 1000) {
  if (map.size >= max)
    throw new DiscoveryError(
      "Discovery capacity reached. Try again later.",
      503,
    );
}
export function rateLimit(key: string, limit: number, interval = 60_000) {
  sweep();
  const rates = state().rates,
    current = rates.get(key);
  if (current && current.until > Date.now()) {
    if (current.count >= limit)
      throw new DiscoveryError(
        "Discovery rate limit reached. Wait before trying again.",
        429,
      );
    current.count++;
  } else {
    bounded(rates, 3000);
    rates.set(key, { count: 1, until: Date.now() + interval });
  }
}
function epoch(sessionId: string) {
  try {
    return getRuntime().store.core.get(sessionId).epoch;
  } catch {
    revokeSession(sessionId);
    throw new DiscoveryError("Shopper session expired. Pair again.", 401);
  }
}
function current(pair: Pick<Pair, "sessionId" | "epoch" | "expiresAt">) {
  if (pair.expiresAt <= Date.now() || epoch(pair.sessionId) !== pair.epoch) {
    revokeSession(pair.sessionId, pair.epoch);
    throw new DiscoveryError(
      "Pairing expired or the shopper session was reset. Pair again.",
      401,
    );
  }
}
export function createPairCode(sessionId: string, id: unknown) {
  sweep();
  const eid = extensionId(id),
    capturedEpoch = epoch(sessionId),
    s = state();
  rateLimit("create:" + sessionId, 5);
  for (const [key, code] of s.codes)
    if (code.sessionId === sessionId && code.extensionId === eid)
      s.codes.delete(key);
  bounded(s.codes);
  const code = secret(),
    expiresAt = Date.now() + CODE_TTL_MS;
  s.codes.set(hash(code), {
    sessionId,
    epoch: capturedEpoch,
    extensionId: eid,
    expiresAt,
  });
  return { code, sessionId, epoch: capturedEpoch, expiresAt };
}
export function claimPair(
  request: Request,
  rawCode: unknown,
  rawExtensionId: unknown,
) {
  sweep();
  const origin = extensionOrigin(request),
    eid = extensionId(rawExtensionId);
  if (origin !== "chrome-extension://" + eid)
    throw new DiscoveryError("Extension ID does not match its origin.", 403);
  rateLimit("claim:all", 100);
  rateLimit("claim:" + eid, 10);
  if (typeof rawCode !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(rawCode))
    throw new DiscoveryError("Invalid or expired pairing code.", 401);
  const s = state(),
    key = hash(rawCode),
    code = s.codes.get(key);
  if (!code || code.extensionId !== eid)
    throw new DiscoveryError("Invalid or expired pairing code.", 401);
  current(code);
  s.codes.delete(key); // Consume synchronously before generating the bearer.
  for (const [token, old] of s.pairs)
    if (old.sessionId === code.sessionId && old.extensionId === eid)
      s.pairs.delete(token);
  bounded(s.pairs);
  const token = secret(),
    tokenKey = hash(token),
    pair: Pair = {
      ...code,
      key: tokenKey,
      generation: 0,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    };
  s.pairs.set(tokenKey, pair);
  return { token, pair };
}
export function authenticateExtension(request: Request): Pair {
  sweep();
  const origin = extensionOrigin(request);
  const m = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(
    request.headers.get("authorization") ?? "",
  );
  const pair = m ? state().pairs.get(hash(m[1])) : undefined;
  if (!pair || origin !== "chrome-extension://" + pair.extensionId)
    throw new DiscoveryError("Unauthorized extension pairing.", 401);
  current(pair);
  rateLimit("request:" + pair.key, 90);
  return pair;
}
export function assertPairCurrent(pair: Pair) {
  if (state().pairs.get(pair.key) !== pair)
    throw new DiscoveryError("Pairing revoked.", 401);
  current(pair);
}
export function beginDiscovery(pair: Pair) {
  assertPairCurrent(pair);
  return ++pair.generation;
}
export function retainResult(
  pair: Pair,
  result: DiscoveryResult,
  generation: number,
) {
  assertPairCurrent(pair);
  if (pair.generation !== generation)
    throw new DiscoveryError("A newer observation replaced this result.", 409);
  const s = state();
  // Only the normalized public result survives: neither frame bytes nor raw page text is retained.
  sweep();
  // The panel retains recent discoveries. A later (even duplicate) lookup must
  // not invalidate an earlier card that is still inside its bounded lifetime.
  const retained = [...s.results.entries()].filter(
    ([, prior]) => prior.pairKey === pair.key,
  );
  for (const [key] of retained.slice(0, Math.max(0, retained.length - 11)))
    s.results.delete(key);
  bounded(s.results);
  s.results.set(result.observationId, {
    pairKey: pair.key,
    sessionId: pair.sessionId,
    epoch: pair.epoch,
    expiresAt: Date.now() + RESULT_TTL_MS,
    result: structuredClone(result),
  });
}
export function createHandoff(
  pair: Pair,
  observationId: unknown,
  candidateId: unknown,
) {
  sweep();
  assertPairCurrent(pair);
  if (
    typeof observationId !== "string" ||
    observationId.length > 100 ||
    typeof candidateId !== "string" ||
    candidateId.length > 200
  )
    throw new DiscoveryError("A current result and candidate are required.");
  const key = pair.key + ":" + observationId + ":" + candidateId,
    s = state(),
    previous = s.handedOff.get(key);
  if (previous) return structuredClone(previous); // Never resurrect an acknowledged arrival.
  const record = s.results.get(observationId);
  const candidate = record?.result.candidates.find((c) => c.id === candidateId);
  if (
    !record ||
    record.pairKey !== pair.key ||
    !candidate ||
    record.expiresAt <= Date.now()
  )
    throw new DiscoveryError(
      "This result is stale. Discover the product again.",
      409,
    );
  bounded(s.handedOff);
  const handoff: PendingHandoff = {
    handoffId: randomUUID(),
    observationId,
    sessionId: pair.sessionId,
    epoch: pair.epoch,
    source: structuredClone(record.result.source),
    candidate: structuredClone(candidate),
    mode: record.result.mode,
    expiresAt: Math.min(pair.expiresAt, Date.now() + RESULT_TTL_MS),
  };
  s.pending.set(pair.sessionId, handoff);
  s.handedOff.set(key, handoff);
  return structuredClone(handoff);
}
export function getPendingHandoff(sessionId: string): PendingHandoff | null {
  sweep();
  const pending = state().pending.get(sessionId);
  if (!pending) return null;
  current(pending);
  return structuredClone(pending);
}
export function acknowledgeHandoff(sessionId: string, handoffId: string) {
  const pending = getPendingHandoff(sessionId);
  if (!pending || pending.handoffId !== handoffId) return false;
  state().pending.delete(sessionId);
  return true;
}
export function revokeSession(sessionId: string, epoch?: number) {
  const s = state();
  for (const map of [s.codes, s.pairs, s.results, s.handedOff]) {
    for (const [key, value] of map)
      if (
        value.sessionId === sessionId &&
        (epoch === undefined || value.epoch === epoch)
      )
        map.delete(key);
  }
  const pending = s.pending.get(sessionId);
  if (pending && (epoch === undefined || pending.epoch === epoch))
    s.pending.delete(sessionId);
}
