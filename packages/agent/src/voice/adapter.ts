import { VOICE_ADAPTER, type SpeakableResult } from "@coupang/contract";

export type VoiceChannel = SpeakableResult["channel"];

export interface VoiceAdapter {
  readonly id: string;
  readonly duplex: boolean;
  /** Mint / connect — live implementation exchanges WebRTC SDP; substitute is no-op. */
  connect(sessionId: string): Promise<{ ok: boolean; transport: string }>;
  /** Inject typed/image/link user content so replies stay spoken. */
  injectUserText(sessionId: string, text: string): Promise<void>;
  append(
    sessionId: string,
    channel: VoiceChannel,
    content: string,
    meta?: { turnId?: string; delegationId?: string | null },
  ): Promise<void>;
  interrupt(sessionId: string, reason: string): Promise<void>;
  pauseNarrationForVideo(sessionId: string): Promise<void>;
  resumeAfterVideo(sessionId: string, takeaway: string): Promise<void>;
}

/** Deterministic substitute for AFK / tests — records spoken outputs. */
export class FixtureVoiceAdapter implements VoiceAdapter {
  readonly id = "fixture-substitute";
  readonly duplex = true;
  log: Array<{
    sessionId: string;
    channel: VoiceChannel;
    content: string;
    at: number;
  }> = [];
  interrupted: string[] = [];
  videoPaused = new Set<string>();

  async connect(sessionId: string) {
    return { ok: true, transport: `fixture:${sessionId}` };
  }

  async injectUserText(sessionId: string, text: string) {
    this.log.push({
      sessionId,
      channel: "thinking",
      content: `[user-inject] ${text}`,
      at: Date.now(),
    });
  }

  async append(
    sessionId: string,
    channel: VoiceChannel,
    content: string,
  ): Promise<void> {
    if (this.videoPaused.has(sessionId) && channel === "commentary") {
      this.log.push({
        sessionId,
        channel: "thinking",
        content: `[held during video] ${content}`,
        at: Date.now(),
      });
      return;
    }
    this.log.push({ sessionId, channel, content, at: Date.now() });
  }

  async interrupt(sessionId: string, reason: string) {
    this.interrupted.push(`${sessionId}:${reason}`);
    await this.append(sessionId, "instructions", "Stop current answer. Wait for the shopper.");
  }

  async pauseNarrationForVideo(sessionId: string) {
    this.videoPaused.add(sessionId);
    await this.append(sessionId, "instructions", "Pause shopping narration for video playback.");
  }

  async resumeAfterVideo(sessionId: string, takeaway: string) {
    this.videoPaused.delete(sessionId);
    await this.append(sessionId, "commentary", takeaway);
  }
}

export type LiveMintResult =
  | {
      mode: "live";
      model: string;
      transport: "webrtc";
      delegation: "client";
      duplex: true;
      clientSecret: string;
      expiresAt: string | null;
      sessionId: string;
    }
  | {
      mode: "not_connected";
      note: string;
      duplex: false;
    };

/**
 * GPT-Live duplex adapter (client delegation).
 * `mint()` creates an ephemeral client secret when OPENAI_API_KEY is present;
 * otherwise returns authenticated `not_connected` (never a silent fake duplex claim).
 */
export class GptLiveVoiceAdapter implements VoiceAdapter {
  readonly id = VOICE_ADAPTER.id;
  readonly duplex = VOICE_ADAPTER.duplex;
  pending: Array<Record<string, unknown>> = [];
  private fallback = new FixtureVoiceAdapter();
  private minted = new Map<string, LiveMintResult & { mode: "live" }>();

  constructor(private readonly apiKey?: string) {}

  async connect(sessionId: string) {
    const minted = await this.mint(sessionId);
    if (minted.mode !== "live") {
      return this.fallback.connect(sessionId);
    }
    this.pending.push({
      type: "live.session.create",
      sessionId,
      model: VOICE_ADAPTER.model,
      transport: VOICE_ADAPTER.transport,
      delegation: { type: "client" },
    });
    return { ok: true, transport: "webrtc" };
  }

  /**
   * Mint a client-delegated live voice session, or return not_connected.
   * Does not fabricate duplex capability when the provider call fails.
   */
  async mint(sessionId: string): Promise<LiveMintResult> {
    if (!this.apiKey) {
      return {
        mode: "not_connected",
        duplex: false,
        note: "OPENAI_API_KEY is not set. Text mode and the browser speech fallback remain available; live duplex is not connected.",
      };
    }
    const cached = this.minted.get(sessionId);
    if (cached) return cached;
    try {
      // Realtime GA: ephemeral client secrets (beta /v1/realtime/sessions retired).
      const res = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            expires_after: { anchor: "created_at", seconds: 600 },
            session: {
              type: "realtime",
              model: VOICE_ADAPTER.model,
              audio: { output: { voice: "alloy" } },
            },
          }),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return {
          mode: "not_connected",
          duplex: false,
          note: `Live voice mint failed (${res.status}). Text mode remains available. ${detail.slice(0, 180)}`,
        };
      }
      const body = (await res.json()) as {
        value?: string;
        expires_at?: number;
        client_secret?: { value?: string; expires_at?: number };
        session?: { id?: string; model?: string };
        id?: string;
      };
      const secret = body.value ?? body.client_secret?.value;
      if (!secret) {
        return {
          mode: "not_connected",
          duplex: false,
          note: "Live voice mint returned no client secret. Text mode remains available.",
        };
      }
      const expiresUnix = body.expires_at ?? body.client_secret?.expires_at;
      const live: LiveMintResult & { mode: "live" } = {
        mode: "live",
        model: body.session?.model ?? VOICE_ADAPTER.model,
        transport: "webrtc",
        delegation: "client",
        duplex: true,
        clientSecret: secret,
        expiresAt: expiresUnix
          ? new Date(expiresUnix * 1000).toISOString()
          : null,
        sessionId: body.session?.id ?? body.id ?? sessionId,
      };
      this.minted.set(sessionId, live);
      return live;
    } catch (e) {
      return {
        mode: "not_connected",
        duplex: false,
        note: `Live voice mint error: ${e instanceof Error ? e.message : "unknown"}. Text mode remains available.`,
      };
    }
  }

  async injectUserText(sessionId: string, text: string) {
    this.pending.push({
      type: "live.user_text",
      sessionId,
      text,
      speakReply: true,
    });
    if (!this.apiKey) await this.fallback.injectUserText(sessionId, text);
  }

  async append(
    sessionId: string,
    channel: VoiceChannel,
    content: string,
    meta?: { turnId?: string; delegationId?: string | null },
  ) {
    const type =
      channel === "commentary"
        ? "session.commentary.append"
        : channel === "thinking"
          ? "session.thinking.append"
          : "session.instructions.append";
    this.pending.push({
      type,
      sessionId,
      content,
      delegation_id: meta?.delegationId ?? null,
      turnId: meta?.turnId,
    });
    if (!this.apiKey) await this.fallback.append(sessionId, channel, content);
  }

  async interrupt(sessionId: string, reason: string) {
    this.pending.push({ type: "live.interrupt", sessionId, reason });
    if (!this.apiKey) await this.fallback.interrupt(sessionId, reason);
  }

  async pauseNarrationForVideo(sessionId: string) {
    this.pending.push({ type: "live.video_pause", sessionId });
    if (!this.apiKey) await this.fallback.pauseNarrationForVideo(sessionId);
  }

  async resumeAfterVideo(sessionId: string, takeaway: string) {
    this.pending.push({ type: "live.video_resume", sessionId, takeaway });
    if (!this.apiKey) await this.fallback.resumeAfterVideo(sessionId, takeaway);
  }

  get substituteLog() {
    return this.fallback.log;
  }
}
