import { describe, expect, it } from "vitest";
import type { VoiceStatus } from "@/lib/session/contract";
import { voiceOrbState } from "@/lib/voice/orb-state";

describe("voice orb visual state", () => {
  it.each([
    ["ready", false, null],
    ["listening", true, "listening"],
    ["thinking", false, "thinking"],
    ["thinking", true, "listening"],
    ["speaking", false, "talking"],
    ["speaking", true, "talking"],
    ["listening", false, null],
    ["paused", false, null],
    ["reconnecting", false, null],
    ["error", false, null],
  ] as const)(
    "maps %s with capture=%s to %s",
    (status, capturing, expected) => {
      expect(voiceOrbState(status, capturing)).toBe(expected);
    },
  );

  it("follows interruption, stop and error immediately without retaining playback", () => {
    const transitions: [VoiceStatus, boolean][] = [
      ["ready", false],
      ["listening", true],
      ["thinking", false],
      ["speaking", true],
      ["listening", true], // interrupted; capture is still active
      ["paused", false], // stopped
      ["speaking", false],
      ["error", false],
      ["ready", false],
    ];
    expect(
      transitions.map(([status, capturing]) =>
        voiceOrbState(status, capturing),
      ),
    ).toEqual([
      null,
      "listening",
      "thinking",
      "talking",
      "listening",
      null,
      "talking",
      null,
      null,
    ]);
  });
});
