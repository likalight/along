import { requestMicrophone } from "./microphone";
import type { SpeechAdapter, SpeechCallbacks, VoiceChoice } from "./adapter";
import { audioRms, LivePlaybackGate } from "./live-playback-gate";

type AudioMeter = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  values: Float32Array<ArrayBuffer>;
};

function meterRms(meter: AudioMeter | null) {
  if (!meter) return 0;
  meter.analyser.getFloatTimeDomainData(meter.values);
  return audioRms(meter.values);
}

function requestsPlaybackYield(text: string) {
  const words = text
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/g, "");
  if (
    /^(?:m+h+m+|m+m+|uh[- ]?huh|yeah|yep|yes|okay|ok|right|sure|got it)$/.test(
      words,
    )
  )
    return false;
  // Short deliberate corrections can yield before the acoustic dwell time.
  // Partial words and brief listening sounds leave natural duplex behavior to
  // the voice model; this fallback is not a shopping-intent classifier.
  return (
    /^(?:no\b|wait\b|stop\b|actually\b|but\b|hold on\b|hang on\b)/.test(
      words,
    ) || words.split(/\s+/).length >= 3
  );
}

/** GPT-Live transports audio only. The authenticated server sideband owns tools,
 * task revisions and shopping state; browser transcripts are captions, not evidence. */
export class GptLiveAdapter implements SpeechAdapter {
  readonly fullDuplex = true;
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private stream: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private audioTimer: ReturnType<typeof setInterval> | null = null;
  private inputMeter: AudioMeter | null = null;
  private outputMeter: AudioMeter | null = null;
  private playbackGate = new LivePlaybackGate();
  private playbackEpoch = 0;
  private interruptedUserEnd = -1;
  private suppressedAssistantEnd = -1;
  private pendingAssistantCaption: {
    text: string;
    start: number;
    end: number;
  } | null = null;
  private assistantCaptionStart = -1;
  private speaking = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private callbacks: SpeechCallbacks | null = null;
  private callId: string | null = null;
  private voice: VoiceChoice = "marin";
  private disposed = false;
  private captureGeneration = 0;
  private connecting: Promise<void> | null = null;
  private captions = {
    user: { text: "", end: -1 },
    assistant: { text: "", end: -1 },
  };
  constructor(private readonly options: { sessionId: string }) {}

  setVoice(voice: VoiceChoice) {
    if (voice !== this.voice && this.callId) this.close();
    this.voice = voice;
  }

  private async control(
    action: "stop-speaking" | "cancel-task" | "sync" | "disconnect",
  ) {
    const callId = this.callId;
    if (!callId) return;
    const response = await fetch("/api/voice/live/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: this.options.sessionId,
        callId,
        action,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        data.error ??
          "The live conversation could not be updated. Reconnect to continue.",
      );
    }
  }
  prepareTurn = () => this.control("cancel-task");
  sync = () => this.control("sync");

  private event(raw: string) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    const speaker =
      event.type === "session.input_transcript.delta"
        ? "user"
        : event.type === "session.output_transcript.delta"
          ? "assistant"
          : null;
    if (speaker && typeof event.delta === "string") {
      if (speaker === "user") {
        const end = event.end_ms;
        // A late fragment from the question must not cut off its new answer.
        // Browser captions are display-only; the server still receives it.
        if (typeof end === "number" && end <= this.assistantCaptionStart)
          return;
        const recentInput = this.playbackGate.hasRecentInput(Date.now());
        const inputText =
          (this.assistantCaptionStart >= 0 &&
          this.captions.user.end >= this.assistantCaptionStart
            ? this.captions.user.text
            : "") + event.delta;
        const wantsYield = requestsPlaybackYield(inputText);
        // Soft, meaningful input may miss the main acoustic threshold. It must
        // have overlapped audible output: a late caption of the question may
        // arrive after its answer's audio, before the first output caption.
        if (
          this.speaking &&
          !this.playbackGate.muted &&
          recentInput &&
          this.playbackGate.hasRecentPlaybackInput(Date.now()) &&
          wantsYield
        ) {
          this.cancel();
          this.callbacks?.bargeIn();
        }
        // A delayed fragment that ends before the buffered reply is already
        // represented by that response. Do not mistake ambient mic energy at
        // its arrival for a new utterance and restart the playback end pause.
        if (
          !this.pendingAssistantCaption ||
          typeof end !== "number" ||
          end > this.pendingAssistantCaption.start
        )
          this.playbackGate.inputTranscript(Date.now());
        if (
          (!this.speaking || this.playbackGate.muted || wantsYield) &&
          (recentInput ||
            (typeof end === "number" && end > this.captions.assistant.end))
        ) {
          this.captions.assistant = { text: "", end: -1 };
          this.assistantCaptionStart = -1;
        }
        if (
          this.playbackGate.muted &&
          this.pendingAssistantCaption &&
          typeof end === "number" &&
          end > this.pendingAssistantCaption.start
        ) {
          this.pendingAssistantCaption = null;
          this.playbackGate.discardCandidateTranscript();
        }
      }
      if (speaker === "assistant" && this.playbackGate.muted) {
        const start = event.start_ms;
        const end = event.end_ms;
        if (typeof start !== "number" || typeof end !== "number") return;
        const pending = this.pendingAssistantCaption;
        // Timestamped text can arrive just before the next 25ms media sample.
        // Keep a candidate new segment, without displaying it before playback.
        const afterUser =
          this.captions.user.end > this.interruptedUserEnd &&
          start >= this.captions.user.end;
        const afterGap = start - this.suppressedAssistantEnd >= 120;
        const continuing = pending && start >= pending.end;
        if (
          this.playbackGate.acceptsCandidateCaption(
            Date.now(),
            afterUser,
            meterRms(this.inputMeter),
          ) &&
          end > this.suppressedAssistantEnd &&
          (afterUser || afterGap || continuing)
        ) {
          this.pendingAssistantCaption = {
            text: (
              (pending && start - pending.end < 600 ? pending.text : "") +
              event.delta
            ).slice(-2500),
            start: pending && start - pending.end < 600 ? pending.start : start,
            end,
          };
          this.playbackGate.candidateTranscript(afterUser);
        } else
          this.suppressedAssistantEnd = Math.max(
            this.suppressedAssistantEnd,
            end,
          );
        return;
      }
      if (
        speaker === "assistant" &&
        typeof event.end_ms === "number" &&
        event.end_ms <= this.suppressedAssistantEnd
      )
        return;
      const caption = this.captions[speaker];
      // Timeline gaps group captions for readability only, never trigger backend work.
      if (
        typeof event.start_ms === "number" &&
        event.start_ms - caption.end > 1800
      ) {
        caption.text = "";
        if (speaker === "assistant") this.assistantCaptionStart = -1;
      }
      if (
        speaker === "assistant" &&
        this.assistantCaptionStart < 0 &&
        typeof event.start_ms === "number"
      )
        this.assistantCaptionStart = event.start_ms;
      caption.text = (caption.text + event.delta).slice(-2500);
      if (typeof event.end_ms === "number") caption.end = event.end_ms;
      this.callbacks?.caption?.(speaker, caption.text);
    } else if (event.type === "session.closed") {
      this.close();
      this.callbacks?.ended();
    } else if (event.type === "error") {
      // Provider messages may contain request details; show a safe action-oriented error.
      this.callbacks?.error(
        "The live voice service reported a problem. Reconnect or continue by typing.",
      );
    }
  }

  private setSpeaking(active: boolean) {
    if (active === this.speaking) return;
    this.speaking = active;
    this.callbacks?.speaking?.(active);
  }

  private yielded() {
    if (this.audio) this.audio.muted = true;
    const epoch = ++this.playbackEpoch;
    this.interruptedUserEnd = this.captions.user.end;
    this.suppressedAssistantEnd = this.captions.assistant.end;
    this.pendingAssistantCaption = null;
    this.captions.assistant = { text: "", end: -1 };
    this.assistantCaptionStart = -1;
    this.setSpeaking(false);
    const callId = this.callId;
    // This requests provider cooperation; local playback is already silent.
    // Never cancel backend work or disable the full-duplex microphone here.
    void this.control("stop-speaking")
      .then(() => {
        if (callId === this.callId && epoch === this.playbackEpoch)
          this.playbackGate.stopRequestAccepted();
      })
      .catch((error) => {
        if (callId !== this.callId || epoch !== this.playbackEpoch) return;
        this.close();
        this.callbacks?.error(error.message);
      });
  }

  private observeAudio(stream: MediaStream, direction: "input" | "output") {
    const context = (this.audioContext ??= new AudioContext());
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const key = direction === "input" ? "inputMeter" : "outputMeter";
    this[key]?.source.disconnect();
    this[key]?.analyser.disconnect();
    this[key] = {
      source,
      analyser,
      values: new Float32Array(analyser.fftSize),
    };
    if (this.audioTimer) return;
    this.audioTimer = setInterval(() => {
      const result = this.playbackGate.sample(
        Date.now(),
        meterRms(this.inputMeter),
        meterRms(this.outputMeter),
        this.stream?.getAudioTracks().some((track) => track.enabled) ?? false,
      );
      if (result.interrupted) {
        this.yielded();
        // The controller clears visual narration, preserving pending work.
        this.callbacks?.bargeIn();
      }
      if (result.discardCaption) this.pendingAssistantCaption = null;
      if (this.audio) this.audio.muted = result.muted;
      if (result.resumed) {
        this.callbacks?.playbackResumed?.();
        if (this.pendingAssistantCaption) {
          this.assistantCaptionStart = this.pendingAssistantCaption.start;
          this.captions.assistant = this.pendingAssistantCaption;
          this.pendingAssistantCaption = null;
          this.callbacks?.caption?.("assistant", this.captions.assistant.text);
        }
      }
      this.setSpeaking(result.speaking);
    }, 25);
    void context.resume().catch(() => {});
  }

  private poll(callId: string, signal: AbortSignal) {
    const run = async () => {
      if (signal.aborted || callId !== this.callId || this.disposed) return;
      try {
        const query = new URLSearchParams({
          sessionId: this.options.sessionId,
          callId,
        });
        const response = await fetch(`/api/voice/live/state?${query}`, {
          signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (signal.aborted || callId !== this.callId) return;
        if (!response.ok)
          throw new Error(
            data.error ??
              "Live shopping updates are unavailable. Reconnect to continue.",
          );
        this.callbacks?.backend?.(data);
      } catch (error) {
        if (!signal.aborted && callId === this.callId) {
          this.close();
          this.callbacks?.error(
            error instanceof Error
              ? error.message
              : "Live shopping updates disconnected.",
          );
        }
      } finally {
        if (!signal.aborted && callId === this.callId)
          this.pollTimer = setTimeout(run, 600);
      }
    };
    void run();
  }

  private async connect() {
    this.close();
    const abort = new AbortController();
    this.abort = abort;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof RTCPeerConnection === "undefined"
    )
      throw new Error(
        "Live voice requires microphone support. Open this demo in Chrome or continue by typing.",
      );
    const stream = await requestMicrophone(abort.signal);
    if (abort.signal.aborted || this.disposed) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    const peer = new RTCPeerConnection();
    this.peer = peer;
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    const audio = new Audio();
    audio.autoplay = true;
    this.audio = audio;
    peer.ontrack = (event) => {
      if (this.peer !== peer) return;
      const remote = event.streams[0] ?? new MediaStream([event.track]);
      audio.srcObject = remote;
      this.observeAudio(remote, "output");
      void audio
        .play()
        .catch(() =>
          this.callbacks?.error(
            "Your browser blocked voice playback. Allow audio for this page and reconnect.",
          ),
        );
    };
    const channel = peer.createDataChannel("oai-events");
    this.channel = channel;
    channel.onmessage = (event) => {
      if (this.peer === peer && typeof event.data === "string")
        this.event(event.data);
    };
    peer.onconnectionstatechange = () => {
      if (this.peer === peer && peer.connectionState === "failed") {
        this.close();
        this.callbacks?.error(
          "The live audio connection was lost. Reconnect to continue.",
        );
      }
    };
    try {
      this.observeAudio(stream, "input");
      await peer.setLocalDescription(await peer.createOffer());
      if (peer.iceGatheringState !== "complete")
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => {
            clearTimeout(timer);
            peer.removeEventListener("icegatheringstatechange", check);
            abort.signal.removeEventListener("abort", cancelled);
          };
          const check = () => {
            if (peer.iceGatheringState === "complete") {
              cleanup();
              resolve();
            }
          };
          const cancelled = () => {
            cleanup();
            reject(new Error("Voice connection cancelled."));
          };
          const timer = setTimeout(() => {
            cleanup();
            reject(new Error("Voice connection timed out."));
          }, 10000);
          peer.addEventListener("icegatheringstatechange", check);
          abort.signal.addEventListener("abort", cancelled, { once: true });
          check();
        });
      const response = await fetch("/api/voice/live/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.options.sessionId,
          sdp: peer.localDescription?.sdp,
          voice: this.voice,
        }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ??
            "GPT-Live could not connect. You can continue by typing.",
        );
      if (typeof result.sdp !== "string" || typeof result.callId !== "string")
        throw new Error(
          "The live voice service returned an incomplete connection.",
        );
      this.callId = result.callId;
      if (abort.signal.aborted || this.disposed) {
        this.close();
        return;
      }
      await peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          channel.removeEventListener("open", opened);
          channel.removeEventListener("close", closed);
          abort.signal.removeEventListener("abort", closed);
        };
        const opened = () => {
          cleanup();
          resolve();
        };
        const closed = () => {
          cleanup();
          reject(new Error("The live voice connection closed. Please retry."));
        };
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("The live voice connection timed out."));
        }, 20000);
        channel.addEventListener("open", opened, { once: true });
        channel.addEventListener("close", closed, { once: true });
        abort.signal.addEventListener("abort", closed, { once: true });
        if (channel.readyState === "open") opened();
        if (abort.signal.aborted) closed();
      });
      this.poll(result.callId, abort.signal);
    } catch (error) {
      this.close();
      throw error;
    }
  }

  async start(callbacks: SpeechCallbacks) {
    if (this.disposed) return;
    this.callbacks = callbacks;
    const generation = ++this.captureGeneration;
    if (!this.callId) {
      this.connecting ??= this.connect().finally(() => {
        this.connecting = null;
      });
      await this.connecting;
    }
    if (this.disposed || !this.callId || generation !== this.captureGeneration)
      return;
    ++this.playbackEpoch;
    this.pendingAssistantCaption = null;
    this.playbackGate.reset();
    if (this.audio) this.audio.muted = false;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    callbacks.capture(true);
  }
  stop() {
    ++this.captureGeneration;
    if (this.connecting && !this.callId) this.close();
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    this.callbacks?.capture(false);
  }
  cancel() {
    // Silence speech now; backend work and microphone capture continue.
    if (this.playbackGate.stop(Date.now())) this.yielded();
  }
  speak: SpeechAdapter["speak"] = (_text, _identity, _emit, onError) => {
    // Never turn a text/UI result into fabricated provider playback evidence.
    onError?.(
      "Live voice speaks verified backend results directly. Review purchase summaries on screen.",
    );
  };
  private close() {
    if (this.callId) void this.control("disconnect").catch(() => {});
    this.callId = null;
    this.abort?.abort();
    this.abort = null;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.audioTimer) clearInterval(this.audioTimer);
    this.pollTimer = null;
    this.audioTimer = null;
    for (const meter of [this.inputMeter, this.outputMeter]) {
      meter?.source.disconnect();
      meter?.analyser.disconnect();
    }
    this.inputMeter = this.outputMeter = null;
    ++this.playbackEpoch;
    this.pendingAssistantCaption = null;
    this.interruptedUserEnd = this.suppressedAssistantEnd = -1;
    this.assistantCaptionStart = -1;
    this.playbackGate.reset();
    this.captions = {
      user: { text: "", end: -1 },
      assistant: { text: "", end: -1 },
    };
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.channel?.close();
    this.channel = null;
    this.peer?.close();
    this.peer = null;
    this.audio?.pause();
    if (this.audio) this.audio.srcObject = null;
    this.audio = null;
    void this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.callbacks?.capture(false);
    this.speaking = false;
    this.callbacks?.speaking?.(false);
  }
  dispose() {
    this.disposed = true;
    this.close();
    this.callbacks = null;
  }
}
