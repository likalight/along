/** Browser/server client for issue #2. agentToken is optional and MUST stay server-side. */
import type { InputEnvelope } from "./contracts.ts";
import type { sessionView } from "./integration.ts";
import { BackendError } from "./client.ts";
export type ShoppingSnapshot = ReturnType<typeof sessionView>;
export class IntegrationClient {
  readonly baseUrl: string;
  sessionId?: string;
  accessToken?: string;
  private agentToken?: string;
  constructor(
    baseUrl = "http://127.0.0.1:4318",
    options: {
      sessionId?: string;
      accessToken?: string;
      agentToken?: string;
    } = {},
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "") + "/v1/integration";
    Object.assign(this, options);
  }
  private headers(agent = false) {
    return {
      ...(this.accessToken
        ? { Authorization: `Bearer ${this.accessToken}` }
        : {}),
      ...(agent && this.agentToken ? { "X-Agent-Token": this.agentToken } : {}),
    };
  }
  private path(action = "") {
    if (!this.sessionId) throw new Error("Create or resume a session first.");
    return `/sessions/${this.sessionId}${action ? "/" + action : ""}`;
  }
  async request(path: string, body?: unknown, agent = false) {
    const r = await fetch(this.baseUrl + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...this.headers(agent), "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await r.json();
    if (!r.ok) throw new BackendError(r.status, data.error);
    return data;
  }
  async create(scenarioId?: string): Promise<ShoppingSnapshot> {
    const r = await this.request("/sessions", scenarioId ? { scenarioId } : {});
    this.sessionId = r.session.sessionId;
    this.accessToken = r.accessToken;
    return r.session;
  }
  async snapshot(): Promise<ShoppingSnapshot> {
    return (await this.request(this.path())).session;
  }
  async catalog() {
    return this.request("/catalog");
  }
  async scenarios() {
    return this.request("/scenarios");
  }
  async input(
    snapshot: ShoppingSnapshot,
    modality: InputEnvelope["modality"],
    payload: { text?: string; attachmentId?: string; url?: string },
    identity = { eventId: crypto.randomUUID(), turnId: crypto.randomUUID() },
  ): Promise<ShoppingSnapshot> {
    return (
      await this.request(this.path("inputs"), {
        sessionId: snapshot.sessionId,
        epoch: snapshot.epoch,
        ...identity,
        baseRevision: snapshot.revision,
        modality,
        ...payload,
        visibleRevision: snapshot.revision,
        visibleProductIds: snapshot.displayOrder,
        source: "shopper",
      })
    ).session;
  }
  async action(
    snapshot: ShoppingSnapshot,
    action: string,
    payload: Record<string, unknown>,
    eventId = crypto.randomUUID(),
  ): Promise<ShoppingSnapshot> {
    return (
      await this.request(
        this.path("actions"),
        {
          sessionId: snapshot.sessionId,
          epoch: snapshot.epoch,
          eventId,
          turnId: snapshot.turn?.id,
          baseRevision: snapshot.revision,
          action,
          payload,
          evidenceIds: [],
        },
        true,
      )
    ).session;
  }
  async presentation(
    summary: NonNullable<ShoppingSnapshot["summary"]>,
    event:
      | "displayed"
      | "playback_started"
      | "playback_completed"
      | "playback_interrupted",
  ): Promise<ShoppingSnapshot> {
    return (
      await this.request(this.path("presentation"), {
        summaryId: summary.id,
        turnId: summary.responseTurnId,
        textHash: summary.textHash,
        event,
      })
    ).session;
  }
  async mode(
    snapshot: ShoppingSnapshot,
    mode: "voice" | "text",
  ): Promise<ShoppingSnapshot> {
    return (
      await this.request(this.path("mode"), {
        expectedRevision: snapshot.revision,
        mode,
      })
    ).session;
  }
  async cancel(snapshot: ShoppingSnapshot): Promise<ShoppingSnapshot> {
    return (
      await this.request(this.path("cancel"), { turnId: snapshot.turn?.id })
    ).session;
  }
  async reset(snapshot: ShoppingSnapshot): Promise<ShoppingSnapshot> {
    return (
      await this.request(this.path("reset"), {
        expectedRevision: snapshot.revision,
      })
    ).session;
  }
  async upload(snapshot: ShoppingSnapshot, image: Blob) {
    const r = await fetch(this.baseUrl + this.path("attachments"), {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": image.type,
        "X-Session-Revision": String(snapshot.revision),
      },
      body: image,
    });
    const result = await r.json();
    if (!r.ok) throw new BackendError(r.status, result.error);
    return result as {
      session: ShoppingSnapshot;
      attachment: { id: string; contentType: string; size: number };
    };
  }
  async attachment(id: string): Promise<Blob> {
    const r = await fetch(
      this.baseUrl + this.path("attachments/" + encodeURIComponent(id)),
      { headers: this.headers() },
    );
    if (!r.ok) throw new BackendError(r.status, (await r.json()).error);
    return r.blob();
  }
  /** Call only from trusted user-input ingestion, never register as a model tool. */
  async confirm(
    snapshot: ShoppingSnapshot,
    modality: "voice" | "text",
    voiceEvidence?: {
      transcript: string;
      final: boolean;
      confidence: number;
      source: "shopper";
      echoDetected: boolean;
    },
    eventId = crypto.randomUUID(),
  ) {
    return this.request(
      this.path("confirm"),
      {
        sessionId: snapshot.sessionId,
        epoch: snapshot.epoch,
        eventId,
        turnId: snapshot.turn?.id,
        baseRevision: snapshot.revision,
        summaryId: snapshot.summary?.id,
        summaryRevision: snapshot.summary?.revision,
        modality,
        explicitIntent: "confirm_simulated_purchase",
        ...(voiceEvidence ? { voiceEvidence } : {}),
      },
      true,
    );
  }
  async *events(
    signal?: AbortSignal,
  ): AsyncGenerator<
    | { type: "session.updated"; snapshot: ShoppingSnapshot; revision: number }
    | { type: "session.expired" }
  > {
    const r = await fetch(this.baseUrl + this.path("events"), {
      headers: this.headers(),
      signal,
    });
    if (!r.ok) throw new BackendError(r.status, (await r.json()).error);
    const reader = r.body!.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        buffer += decoder.decode(part.value, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const line = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (line.startsWith("data: ")) yield JSON.parse(line.slice(6));
        }
      }
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  }
}
