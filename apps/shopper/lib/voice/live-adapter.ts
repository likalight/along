import type { Playback, SpeechAdapter, SpeechCallbacks } from "./adapter";

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult:
    | ((e: {
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
        resultIndex: number;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  abort: () => void;
  stop: () => void;
};

/**
 * GPT-Live client-delegated speech adapter.
 * Holds the minted client secret for WebRTC peer setup. Capture/speak currently
 * use the browser media APIs while forwarding the same lifecycle identities the
 * authoritative store expects.
 */
export class LiveSpeechAdapter implements SpeechAdapter {
  private callbacks: SpeechCallbacks | null = null;
  private recognition: Recognition | null = null;
  private utterance: SpeechSynthesisUtterance | null = null;
  private stream: MediaStream | null = null;
  private disposed = false;
  private speaking = false;

  constructor(
    private readonly live: { clientSecret: string; model?: string },
  ) {}

  async start(callbacks: SpeechCallbacks): Promise<void> {
    if (this.disposed) return;
    this.callbacks = callbacks;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      callbacks.capture(true);
    } catch {
      callbacks.error(
        "Microphone access was denied. Explicitly choose text mode to continue.",
      );
      return;
    }
    const SpeechRecognitionCtor =
      (
        window as unknown as {
          SpeechRecognition?: new () => Recognition;
          webkitSpeechRecognition?: new () => Recognition;
        }
      ).SpeechRecognition ??
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => Recognition;
        }
      ).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      callbacks.error(
        "Speech recognition unavailable. Explicitly choose text mode.",
      );
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      if (this.speaking || this.disposed) return;
      const result = event.results[event.results.length - 1];
      if (!result?.[0] || !result.isFinal) return;
      const text = result[0].transcript.trim();
      if (text) callbacks.transcript(text);
    };
    recognition.onerror = () => {
      if (!this.disposed)
        callbacks.error(
          "Live voice capture error. You can switch to text mode.",
        );
    };
    recognition.onend = () => {
      if (!this.disposed && !this.speaking) callbacks.ended();
    };
    this.recognition = recognition;
    recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
    this.recognition = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.callbacks?.capture(false);
  }

  speak(
    text: string,
    identity: Playback,
    onEvent: (
      type:
        | "audio.started"
        | "audio.completed"
        | "audio.interrupted"
        | "input.barge_in",
      identity: Playback,
    ) => void,
  ): void {
    if (this.disposed) return;
    this.speaking = true;
    this.recognition?.stop();
    this.stream?.getTracks().forEach((t) => {
      t.enabled = false;
    });
    // Retain client secret for future RTCPeerConnection negotiate.
    void this.live.clientSecret;
    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;
    utterance.onstart = () => onEvent("audio.started", identity);
    utterance.onend = () => {
      this.speaking = false;
      this.utterance = null;
      onEvent("audio.completed", identity);
      this.stream?.getTracks().forEach((t) => {
        t.enabled = true;
      });
      try {
        this.recognition?.start();
      } catch {
        /* already started */
      }
    };
    utterance.onerror = () => {
      this.speaking = false;
      this.utterance = null;
      onEvent("audio.interrupted", identity);
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  cancel(): void {
    if (this.utterance) {
      window.speechSynthesis.cancel();
      this.utterance = null;
    }
    this.speaking = false;
    this.callbacks?.bargeIn();
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
    this.stop();
    this.callbacks = null;
  }
}
