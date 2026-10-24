import type { Identity } from "@/lib/session/contract";
export type Playback = Identity & {
  playbackId: string;
  summaryId?: string;
  summaryRevision?: number;
};
export type SpeechCallbacks = {
  capture: (active: boolean) => void;
  transcript: (text: string) => void;
  bargeIn: () => void;
  error: (message: string) => void;
  ended: () => void;
};
export interface SpeechAdapter {
  start(callbacks: SpeechCallbacks): Promise<void>;
  stop(): void;
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
  ): void;
  cancel(): void;
  dispose(): void;
}
