export type DiscoveryMode = "demo" | "live" | "unavailable";
export type Observation = {
  pageUrl: string;
  title: string;
  text?: string;
  kind: "product" | "post" | "video";
  imageDataUrl?: string;
};
export type Candidate = {
  id: string;
  title: string;
  url: string;
  imageUrl?: string;
  /** Major currency units. Demo USD amounts are fictional item prices, never Coupang quotes. */
  price: { amount: number; currency: "USD" | "KRW" } | null;
  match: "similar" | "exact";
  reasons: string[];
  unknowns: string[];
  catalogProductId?: string;
  linkKind: "listing" | "search";
};
export type DiscoveryResult = {
  observationId: string;
  mode: DiscoveryMode;
  notice: string;
  source: { url: string; title: string };
  candidates: Candidate[];
};
export type PendingHandoff = {
  handoffId: string;
  observationId: string;
  sessionId: string;
  epoch: number;
  source: DiscoveryResult["source"];
  candidate: Candidate;
  mode: DiscoveryMode;
  expiresAt: number;
};
export class DiscoveryError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
