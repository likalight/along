import type { Playback, SpeechAdapter, SpeechCallbacks } from "./adapter";
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult:
    | ((e: {
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
        resultIndex: number;
      }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  abort: () => void;
};
export class BrowserSpeechAdapter implements SpeechAdapter {
  private recognition: Recognition | null = null;
  private stream: MediaStream | null = null;
  private generation = 0;
  private outputMuted = false;
  setOutputMuted(muted: boolean) {
    this.outputMuted = muted;
    if (muted) this.cancel();
  }
  private playback: {
    identity: Playback;
    emit: Parameters<SpeechAdapter["speak"]>[2];
  } | null = null;
  async start(callbacks: SpeechCallbacks) {
    this.stop();
    const generation = ++this.generation;
    const SpeechRecognition =
      (
        window as unknown as {
          SpeechRecognition?: new () => Recognition;
          webkitSpeechRecognition?: new () => Recognition;
        }
      ).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition })
        .webkitSpeechRecognition;
    if (!SpeechRecognition)
      throw new Error(
        "Voice recognition is unavailable in this browser. Choose text mode or try Chrome.",
      );
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const r = new SpeechRecognition();
    this.recognition = r;
    r.continuous = true;
    r.interimResults = false;
    r.lang = "en-US";
    r.onstart = () => {
      if (generation === this.generation) callbacks.capture(true);
    };
    r.onspeechstart = () => {
      if (generation === this.generation) callbacks.bargeIn();
    };
    r.onresult = (e) => {
      if (generation !== this.generation) return;
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal)
          callbacks.transcript(e.results[i][0].transcript.trim());
    };
    r.onerror = (e) => {
      if (generation !== this.generation) return;
      this.stop();
      callbacks.capture(false);
      callbacks.error(
        e.error === "not-allowed"
          ? "Microphone permission was denied. You can explicitly choose text mode."
          : `Voice input stopped (${e.error}). Retry voice or choose text mode.`,
      );
    };
    r.onend = () => {
      if (generation !== this.generation) return;
      this.stop();
      callbacks.capture(false);
      callbacks.ended();
    };
    try {
      r.start();
    } catch (error) {
      this.stop();
      throw error;
    }
  }
  stop() {
    this.generation++;
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onstart = null;
      this.recognition.onspeechstart = null;
      this.recognition.abort();
      this.recognition = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
  speak(
    text: string,
    identity: Playback,
    emit: Parameters<SpeechAdapter["speak"]>[2],
  ) {
    this.cancel();
    if (this.outputMuted) {
      emit("audio.interrupted", identity);
      return;
    }
    this.stop(); // Half-duplex fallback: assistant audio cannot be recognised as a shopper command.
    if (!("speechSynthesis" in window)) {
      throw new Error(
        "Spoken output is unavailable. Choose text mode to review the full summary.",
      );
    }
    const playback = { identity, emit };
    let started = false;
    this.playback = playback;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onstart = () => {
      if (this.playback === playback && !started) {
        started = true;
        emit("audio.started", identity);
      }
    };
    utterance.onend = () => {
      if (this.playback === playback) {
        this.playback = null;
        emit(started ? "audio.completed" : "audio.interrupted", identity);
      }
    };
    utterance.onerror = () => {
      if (this.playback === playback) {
        this.playback = null;
        emit("audio.interrupted", identity);
      }
    };
    window.speechSynthesis.speak(utterance);
  }
  cancel() {
    const p = this.playback;
    this.playback = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
    if (p) p.emit("audio.interrupted", p.identity);
  }
  dispose() {
    this.stop();
    this.cancel();
  }
}
