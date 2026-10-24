import type {
  Identity,
  VoiceEvidence,
  NarrationSegment,
  Session,
  TurnActivity,
} from "@/lib/session/contract";
export type VoiceChoice = "marin" | "cedar" | "coral";
export type Playback = Identity & {
  playbackId: string;
  summaryId?: string;
  summaryRevision?: number;
};
export type SpeechCallbacks = {
  capture: (active: boolean) => void;
  transcript: (text: string, evidence?: VoiceEvidence) => void;
  bargeIn: () => void;
  error: (message: string) => void;
  ended: () => void;
  /** Live captions are display only, never purchase authorization or turn evidence. */
  caption?: (speaker: "user" | "assistant", text: string) => void;
  /** A new local playback epoch passed the recovery gate after interruption.
   * Fired before its buffered captions; not proof of provider turn completion. */
  playbackResumed?: () => void;
  speaking?: (active: boolean) => void;
  backend?: (state: {
    snapshot?: Session;
    activity?: TurnActivity | null;
    pending: boolean;
    error?: string | null;
  }) => void;
};
export interface SpeechAdapter {
  readonly fullDuplex?: boolean;
  /** Supersede delegated work before an explicit text/canvas request. */
  prepareTurn?(): Promise<void>;
  sync?(): Promise<void>;
  setVoice?(voice: VoiceChoice): void;
  setOutputMuted?(muted: boolean): void;
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
    onError?: (message: string) => void,
    narration?: {
      segments: NarrationSegment[];
      onProduct: (productId: string | null) => void;
    },
  ): void;
  cancel(): void;
  dispose(): void;
}
