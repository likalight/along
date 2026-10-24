import type { AgentState } from "@/components/ui/orb";
import type { VoiceStatus } from "@/lib/session/contract";

/** Playback takes priority while the microphone stays open for interruptions. */
export function voiceOrbState(
  status: VoiceStatus,
  capturing: boolean,
): AgentState {
  if (status === "speaking") return "talking";
  if (capturing) return "listening";
  if (status === "thinking") return "thinking";
  return null;
}
