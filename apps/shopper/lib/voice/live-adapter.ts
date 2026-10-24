import type {
  Playback,
  SpeechAdapter,
  SpeechCallbacks,
  VoiceChoice,
} from "./adapter";

type Narration = {
  identity: Playback;
  emit: Parameters<SpeechAdapter["speak"]>[2];
  abort: AbortController;
  audio?: HTMLAudioElement;
  url?: string;
  started: boolean;
  clearCue?: () => void;
};

/**
 * OpenAI microphone transcription over WebRTC plus exact, server-authorized TTS.
 * Half duplex: the microphone is muted throughout processing and narration.
 * The project key and trusted transcription evidence stay on our server.
 */
export class LiveSpeechAdapter implements SpeechAdapter {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private callId: string | null = null;
  private connecting: Promise<void> | null = null;
  private connectionAbort: AbortController | null = null;
  private callbacks: SpeechCallbacks | null = null;
  private captureGeneration = 0;
  private captureQueue: Promise<void> = Promise.resolve();
  private capturing = false;
  private disposed = false;
  private items = new Set<string>();
  private delivered = new Set<string>();
  private narration: Narration | null = null;
  private voice: VoiceChoice = "marin";

  constructor(private readonly options: { sessionId: string }) {}

  setVoice(voice: VoiceChoice) {
    this.voice = voice;
  }

  private capture(enabled: boolean): Promise<void> {
    const callId = this.callId;
    if (!callId) return Promise.resolve();
    this.captureQueue = this.captureQueue
      .catch(() => {})
      .then(async () => {
        if (this.callId !== callId)
          throw new Error(
            "The voice connection expired. Retry voice to reconnect.",
          );
        try {
          const response = await fetch("/api/voice/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: this.options.sessionId,
              callId,
              enabled,
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok)
            throw new Error(
              "The voice connection expired. Retry voice to reconnect.",
            );
        } catch (error) {
          // A failed barrier cannot leave a reusable but unverified voice call.
          // A late failure from an older call must not close its replacement.
          if (this.callId === callId) this.closeConnection();
          throw error;
        }
      });
    return this.captureQueue;
  }

  private onProviderEvent(raw: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    if (this.disposed) return;
    if (event.type === "input_audio_buffer.speech_started") {
      if (this.capturing && typeof event.item_id === "string")
        this.items.add(event.item_id);
      return;
    }
    if (
      event.type === "conversation.item.input_audio_transcription.completed"
    ) {
      const itemId = event.item_id;
      if (
        !this.capturing ||
        !this.callId ||
        typeof itemId !== "string" ||
        !this.items.has(itemId) ||
        this.delivered.has(itemId) ||
        typeof event.transcript !== "string" ||
        !event.transcript.trim()
      )
        return;
      this.delivered.add(itemId);
      this.items.delete(itemId);
      // Stop accepting sound before handing the final utterance to the controller.
      // Confidence is never manufactured here; the server resolves this provider ID.
      this.capturing = false;
      this.stream?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      this.callbacks?.capture(false);
      this.callbacks?.transcript(event.transcript.trim(), {
        callId: this.callId,
        itemId,
      });
    } else if (
      event.type === "conversation.item.input_audio_transcription.failed" &&
      this.capturing
    ) {
      this.stop();
      this.callbacks?.error(
        "OpenAI could not transcribe that utterance. Retry voice or choose text mode.",
      );
    }
  }

  private async connect() {
    if (
      this.peer?.connectionState === "connected" &&
      this.channel?.readyState === "open"
    )
      return;
    this.closeConnection();
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    )
      throw new Error(
        "This browser does not support live audio. Open the demo in Chrome or choose text mode.",
      );
    const abort = new AbortController();
    this.connectionAbort = abort;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      throw new Error(
        "Microphone access was denied. Allow microphone access and retry, or choose text mode.",
      );
    }
    if (this.disposed || abort.signal.aborted) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    const peer = new RTCPeerConnection();
    this.peer = peer;
    stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
    const channel = peer.createDataChannel("oai-events");
    this.channel = channel;
    channel.onmessage = (event) => {
      if (this.peer === peer && typeof event.data === "string")
        this.onProviderEvent(event.data);
    };
    peer.onconnectionstatechange = () => {
      if (
        this.peer === peer &&
        !this.disposed &&
        peer.connectionState === "failed"
      ) {
        this.stop();
        this.callbacks?.error(
          "The OpenAI audio connection was lost. Retry voice to reconnect.",
        );
      }
    };
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const response = await fetch("/api/voice/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.options.sessionId,
          sdp: offer.sdp,
        }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ??
            "OpenAI voice connection failed. Retry or choose text mode.",
        );
      if (typeof result.sdp !== "string" || typeof result.callId !== "string")
        throw new Error("OpenAI returned an incomplete audio connection.");
      this.callId = result.callId;
      if (this.disposed || abort.signal.aborted) {
        this.closeConnection();
        return;
      }
      await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
      await new Promise<void>((resolve, reject) => {
        if (channel.readyState === "open") {
          resolve();
          return;
        }
        const finish = (error?: Error) => {
          clearTimeout(timer);
          channel.removeEventListener("open", opened);
          channel.removeEventListener("close", closed);
          abort.signal.removeEventListener("abort", cancelled);
          if (error) reject(error);
          else resolve();
        };
        const opened = () => finish();
        const closed = () =>
          finish(new Error("The OpenAI audio connection closed. Retry voice."));
        const cancelled = () =>
          finish(new Error("Audio connection cancelled."));
        const timer = setTimeout(
          () =>
            finish(
              new Error("OpenAI audio connection timed out. Retry voice."),
            ),
          20000,
        );
        channel.addEventListener("open", opened, { once: true });
        channel.addEventListener("close", closed, { once: true });
        abort.signal.addEventListener("abort", cancelled, { once: true });
        if (abort.signal.aborted) cancelled();
      });
    } catch (error) {
      this.closeConnection();
      throw error;
    }
  }

  async start(callbacks: SpeechCallbacks): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.captureGeneration;
    this.callbacks = callbacks;
    callbacks.capture(false);
    if (!this.connecting)
      this.connecting = this.connect().finally(() => {
        this.connecting = null;
      });
    await this.connecting;
    if (this.disposed || generation !== this.captureGeneration) return;
    this.items.clear();
    // The server clears the provider buffer and observes its acknowledgement
    // before enabling evidence capture. Only then can microphone audio resume.
    await this.capture(true);
    if (this.disposed || generation !== this.captureGeneration) return;
    this.capturing = true;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    callbacks.capture(true);
  }

  stop(): void {
    ++this.captureGeneration;
    this.capturing = false;
    this.items.clear();
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    void this.capture(false).catch(() => {});
    this.callbacks?.capture(false);
  }

  speak(
    text: string,
    identity: Playback,
    emit: Parameters<SpeechAdapter["speak"]>[2],
    onError?: (message: string) => void,
    cues?: Parameters<SpeechAdapter["speak"]>[4],
  ): void {
    this.cancel();
    this.stop();
    const narration: Narration = {
      identity,
      emit,
      abort: new AbortController(),
      started: false,
      clearCue: () => cues?.onProduct(null),
    };
    this.narration = narration;
    const reportError =
      onError ?? ((message: string) => this.callbacks?.error(message));
    void (async () => {
      try {
        await this.captureQueue;
        const segments =
          !identity.summaryId &&
          cues?.segments.length &&
          cues.segments.map((segment) => segment.text).join(" ") === text
            ? cues.segments
            : [{ text, productId: null }];
        const segmented = !identity.summaryId && segments === cues?.segments;
        // Prefetch bounded clips together. Playback events, never estimated timers,
        // select the visual cue, and the entire reply is one lifecycle unit.
        const blobs = await Promise.all(
          segments.map(async (segment, index) => {
            const response = await fetch("/api/voice/speech", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                sessionId: this.options.sessionId,
                text: segment.text,
                voice: this.voice,
                summaryId: identity.summaryId,
                ...(segmented
                  ? {
                      segmentIndex: index,
                      turnId: identity.turnId,
                      revision: identity.revision,
                    }
                  : {}),
              }),
              signal: AbortSignal.any([
                narration.abort.signal,
                AbortSignal.timeout(60000),
              ]),
            });
            if (!response.ok) {
              const result = await response.json().catch(() => ({}));
              throw new Error(
                result.error ??
                  "OpenAI narration failed. Retry or choose text mode.",
              );
            }
            return response.blob();
          }),
        );
        for (let index = 0; index < blobs.length; index++) {
          if (this.narration !== narration) return;
          narration.url = URL.createObjectURL(blobs[index]);
          const audio = new Audio(narration.url);
          narration.audio = audio;
          await new Promise<void>((resolve, reject) => {
            const cancelled = () => reject(new Error("Narration cancelled."));
            narration.abort.signal.addEventListener("abort", cancelled, {
              once: true,
            });
            audio.onplaying = () => {
              if (this.narration !== narration) return;
              if (!narration.started) {
                narration.started = true;
                emit("audio.started", identity);
              }
              cues?.onProduct(segments[index].productId);
            };
            audio.onended = () => {
              narration.abort.signal.removeEventListener("abort", cancelled);
              resolve();
            };
            audio.onerror = () =>
              reject(
                new Error("Audio playback failed. Retry or choose text mode."),
              );
            void audio.play().catch(reject);
          });
          if (this.narration !== narration) return;
          audio.onplaying = audio.onended = audio.onerror = null;
          URL.revokeObjectURL(narration.url);
          narration.url = undefined;
          narration.audio = undefined;
        }
        if (this.narration !== narration) return;
        this.narration = null;
        this.releaseAudio(narration);
        emit(
          narration.started ? "audio.completed" : "audio.interrupted",
          identity,
        );
      } catch (error) {
        if (this.narration !== narration) return;
        this.cancel();
        reportError(
          error instanceof Error ? error.message : "OpenAI narration failed.",
        );
      }
    })();
  }

  private releaseAudio(narration: Narration) {
    narration.clearCue?.();
    narration.abort.abort();
    if (narration.audio) {
      narration.audio.onplaying =
        narration.audio.onended =
        narration.audio.onerror =
          null;
      narration.audio.pause();
      narration.audio.removeAttribute("src");
      narration.audio.load();
    }
    if (narration.url) URL.revokeObjectURL(narration.url);
  }

  cancel(): void {
    const narration = this.narration;
    this.narration = null;
    if (narration) {
      this.releaseAudio(narration);
      narration.emit("audio.interrupted", narration.identity);
    }
  }

  private closeConnection() {
    this.connectionAbort?.abort();
    this.connectionAbort = null;
    const callId = this.callId;
    this.callId = null;
    this.channel?.close();
    this.channel = null;
    if (this.peer) this.peer.onconnectionstatechange = null;
    this.peer?.close();
    this.peer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (callId)
      void fetch("/api/voice/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: this.options.sessionId, callId }),
        keepalive: true,
      }).catch(() => {});
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.cancel();
    this.closeConnection();
    this.callbacks = null;
  }
}
