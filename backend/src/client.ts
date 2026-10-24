/** Framework-neutral client. Import types directly; do NOT put agentToken in frontend builds. */
import type {
  Session,
  Proposal,
  VoiceObservation,
  SessionEvent,
  Constraints,
} from "./contracts.ts";
export class BackendError extends Error {
  status: number;
  code: string;
  details: unknown;
  constructor(
    status: number,
    error: { code: string; message: string; details?: unknown },
  ) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}
export class ConciergeClient {
  baseUrl: string;
  accessToken?: string;
  sessionId?: string;
  private agentToken?: string;
  constructor(
    baseUrl = "http://127.0.0.1:4318",
    options: {
      sessionId?: string;
      accessToken?: string;
      agentToken?: string;
    } = {},
  ) {
    if (options.agentToken && "window" in globalThis)
      throw new Error("agentToken is a server-only credential; use a trusted backend bridge.");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    Object.assign(this, options);
  }
  private headers(agent = false) {
    return {
      "Content-Type": "application/json",
      ...(this.accessToken
        ? { Authorization: `Bearer ${this.accessToken}` }
        : {}),
      ...(agent && this.agentToken ? { "X-Agent-Token": this.agentToken } : {}),
    };
  }
  private async request(path: string, body?: unknown, agent = false) {
    const response = await fetch(this.baseUrl + path, {
      method: body === undefined ? "GET" : "POST",
      headers: this.headers(agent),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) throw new BackendError(response.status, data.error);
    return data;
  }
  private path(action = "") {
    if (!this.sessionId) throw new Error("Create or resume a session first.");
    return `/v1/sessions/${this.sessionId}${action ? "/" + action : ""}`;
  }
  async create(scenarioId?: string): Promise<Session> {
    const data = await this.request(
      "/v1/sessions",
      scenarioId ? { scenarioId } : {},
    );
    this.sessionId = data.session.id;
    this.accessToken = data.accessToken;
    return data.session;
  }
  async snapshot(): Promise<Session> {
    return (await this.request(this.path())).session;
  }
  async turn(expectedRevision: number): Promise<Session> {
    return (await this.request(this.path("turns"), { expectedRevision }))
      .session;
  }
  async cancel(turnId: string): Promise<Session> {
    return (await this.request(this.path("cancel"), { turnId })).session;
  }
  async reset(expectedRevision: number): Promise<Session> {
    return (await this.request(this.path("reset"), { expectedRevision }))
      .session;
  }
  async propose(proposal: Proposal) {
    return this.request(this.path("proposals"), proposal, true);
  }
  async summarize(expectedRevision: number, turnId: string): Promise<Session> {
    return (
      await this.request(
        this.path("summaries"),
        { expectedRevision, turnId },
        true,
      )
    ).session;
  }
  async presentation(
    summary: NonNullable<Session["summary"]>,
    event:
      | "displayed"
      | "playback_started"
      | "playback_completed"
      | "playback_interrupted",
  ): Promise<Session> {
    return (
      await this.request(this.path("presentation"), {
        summaryId: summary.id,
        turnId: summary.responseTurnId,
        textHash: summary.textHash,
        event,
      }, event !== "displayed")
    ).session;
  }
  async approve(observation: VoiceObservation) {
    return this.request(this.path("approval"), observation, true);
  }
  async search(
    constraints: Constraints,
    quantity = 1,
    excludedProductIds: string[] = [],
  ) {
    return this.request("/v1/catalog/search", {
      constraints,
      quantity,
      excludedProductIds,
    });
  }
  async catalog() {
    return this.request("/v1/catalog");
  }
  async *events(
    signal?: AbortSignal,
  ): AsyncGenerator<SessionEvent | { type: "session.expired" | "session.ended" }> {
    const response = await fetch(this.baseUrl + this.path("events"), {
      headers: this.headers(),
      signal,
    });
    if (!response.ok)
      throw new BackendError(response.status, (await response.json()).error);
    const reader = response.body!.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (chunk.startsWith("data: ")) yield JSON.parse(chunk.slice(6));
        }
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
}
