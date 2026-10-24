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
    await this.append(
      sessionId,
      "instructions",
      "Stop current answer. Wait for the shopper.",
    );
  }

  async pauseNarrationForVideo(sessionId: string) {
    this.videoPaused.add(sessionId);
    await this.append(
      sessionId,
      "instructions",
      "Pause shopping narration for video playback.",
    );
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
 * Orchestrator event bridge. The shopper app owns live media connections.
 * Creating a shopping session never opens a provider session or spends tokens.
 */
export class GptLiveVoiceAdapter implements VoiceAdapter {
  readonly id = VOICE_ADAPTER.id;
  readonly duplex = VOICE_ADAPTER.duplex;
  pending: Array<Record<string, unknown>> = [];
  private fallback = new FixtureVoiceAdapter();
  constructor(private readonly apiKey?: string) {}

  async connect(sessionId: string) {
    // Orchestrator creation is not a microphone action. The shopper owns its
    // authenticated WebRTC handshake after the user explicitly starts voice.
    return { ok: true, transport: `deferred:${sessionId}` };
  }

  async mint(_sessionId: string): Promise<LiveMintResult> {
    return {
      mode: "not_connected",
      duplex: false,
      note: "Live audio is available through the shopper app's explicit Start Chat flow. This diagnostic harness does not open provider sessions.",
    };
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
