/** Local playback policy only. Acoustic activity never authorizes a shopping
 * action or establishes that a provider conversational turn is complete. */
const INTERRUPTION_ONSET_MS = 200;
const RECENT_INPUT_MS = 250;
const END_PAUSE_MS = 100;
const CANDIDATE_QUIET_MS = 25;
const STEADY_BACKGROUND_MS = 150;
const MAX_BACKGROUND_RMS = 0.02;

export class LivePlaybackGate {
  private noiseFloor = 0.002;
  private inputSince: number | null = null;
  private overlapSince: number | null = null;
  private lastInput = -Infinity;
  private lastQuietInput = -Infinity;
  private lastPlaybackInput = -Infinity;
  private lastOutput = -Infinity;
  private backgroundSince: number | null = null;
  private backgroundMin = 0;
  private backgroundMax = 0;
  private waitingForInput = false;
  private controlAccepted = false;
  private outputBoundary = false;
  private drainedBoundary = false;
  private freshCaption = false;
  private replyBoundary = false;
  private captionAfterUser = false;
  muted = false;

  private clearOutputEvidence() {
    this.outputBoundary = this.drainedBoundary = this.freshCaption = false;
    this.replyBoundary = this.captionAfterUser = false;
  }

  private significantInput(input: number) {
    return input > Math.max(0.012, this.noiseFloor * 3.5);
  }

  private learnSteadyBackground(
    now: number,
    input: number,
    capturing: boolean,
  ) {
    // RMS alone cannot identify speech. Only a bounded, low-level signal that
    // stays within 25% for 150ms can raise the ambient floor during playback.
    // Louder speech and transient spikes never train it. In particular, the
    // changing loudness of headphone output is not evidence of room noise.
    if (!capturing || input < 0.004 || input > MAX_BACKGROUND_RMS) {
      this.backgroundSince = null;
      return;
    }
    const low = Math.min(this.backgroundMin, input);
    const high = Math.max(this.backgroundMax, input);
    if (this.backgroundSince === null || high > low * 1.25) {
      this.backgroundSince = now;
      this.backgroundMin = this.backgroundMax = input;
      return;
    }
    this.backgroundMin = low;
    this.backgroundMax = high;
    if (now - this.backgroundSince >= STEADY_BACKGROUND_MS)
      this.noiseFloor = Math.max(this.noiseFloor, low);
  }

  reset() {
    this.noiseFloor = 0.002;
    this.inputSince = null;
    this.overlapSince = null;
    this.lastInput = this.lastOutput = -Infinity;
    this.lastQuietInput = -Infinity;
    this.lastPlaybackInput = -Infinity;
    this.backgroundSince = null;
    this.backgroundMin = this.backgroundMax = 0;
    this.waitingForInput = false;
    this.controlAccepted = false;
    this.clearOutputEvidence();
    this.muted = false;
  }

  /** Manual stop stays silent until the shopper speaks again. */
  stop(now: number) {
    if (this.muted) return false;
    this.muted = true;
    this.waitingForInput = true;
    this.lastOutput = now;
    this.controlAccepted = false;
    this.clearOutputEvidence();
    return true;
  }

  /** The application accepted our stop request; this is not provider playback
   * completion, and never opens the gate by itself. */
  stopRequestAccepted() {
    this.controlAccepted = true;
  }

  candidateTranscript(afterUser: boolean) {
    this.freshCaption = true;
    this.captionAfterUser ||= afterUser;
  }

  discardCandidateTranscript() {
    this.freshCaption = this.captionAfterUser = false;
  }

  acceptsCandidateCaption(now: number, afterUser: boolean, input: number) {
    return (
      this.muted &&
      !this.waitingForInput &&
      !this.significantInput(input) &&
      // Buffer a timestamped reply as soon as input and old output have
      // briefly quieted. Audible release still needs the full end pause and
      // stop acknowledgment; neither should cost us the first reply words.
      // Read current microphone energy here, since text can precede the next
      // 25ms media sample that observes the shopper finishing their thought.
      ((afterUser && (now - this.lastOutput >= 50 || this.replyBoundary)) ||
        (this.controlAccepted &&
          (now - this.lastOutput >= 120 || this.outputBoundary)))
    );
  }

  inputTranscript(now: number) {
    // Transcripts can trail the actual utterance. Their arrival time must not
    // restart the quiet period or discard a response already ready to play.
    if (this.muted && this.hasRecentInput(now)) {
      this.waitingForInput = false;
      this.lastInput = Math.max(this.lastInput, this.lastQuietInput);
    }
  }

  hasRecentInput(now: number, withinMs = RECENT_INPUT_MS) {
    return now - this.lastQuietInput <= withinMs;
  }

  hasRecentPlaybackInput(now: number) {
    return now - this.lastPlaybackInput <= RECENT_INPUT_MS;
  }

  sample(now: number, input: number, output: number, capturing: boolean) {
    const outputGap = now - this.lastOutput;
    const outputSound = output > 0.008;
    if (outputSound && outputGap >= 200 && !this.muted)
      this.lastPlaybackInput = -Infinity;
    if (output > 0.008) this.lastOutput = now;
    const outputActive = now - this.lastOutput < 200;
    this.learnSteadyBackground(now, input, capturing);
    // Browser echo cancellation and noise suppression are the first defense.
    // A residual-output margin, adaptive ambient floor, and sustained onset
    // avoid treating quiet speaker bleed or isolated clicks as interruptions.
    const threshold = Math.max(
      0.012,
      this.noiseFloor * 3.5,
      this.muted ? 0 : output * 0.22,
    );
    let discardCaption = false;
    if (capturing && input > Math.max(0.004, this.noiseFloor * 1.5)) {
      this.lastQuietInput = now;
      if (outputSound && !this.muted) this.lastPlaybackInput = now;
    }
    if (capturing && input > threshold && outputActive)
      this.overlapSince ??= now;
    else this.overlapSince = null;
    if (capturing && input > threshold) {
      this.inputSince ??= now;
      this.lastInput = now;
      if (this.muted) {
        // Renewed speech invalidates a candidate immediately, without another
        // 200ms interruption dwell. Keep the adaptive threshold here so quiet
        // background noise does not turn into an indefinite recovery delay.
        this.clearOutputEvidence();
        discardCaption = true;
      }
      if (now - this.inputSince >= INTERRUPTION_ONSET_MS) {
        this.waitingForInput = false;
        this.clearOutputEvidence();
        discardCaption = this.muted;
      }
    } else {
      this.inputSince = null;
      if (capturing && !outputActive && input < threshold)
        this.noiseFloor = this.noiseFloor * 0.96 + input * 0.04;
    }

    // Only CURRENT sustained overlap may interrupt. The preceding solo input
    // and a lingering "active" flag must not mute its quick response.
    const interrupted =
      !this.muted &&
      this.overlapSince !== null &&
      now - this.overlapSince >= INTERRUPTION_ONSET_MS;
    if (interrupted) {
      this.muted = true;
      this.waitingForInput = false;
      this.controlAccepted = false;
      this.clearOutputEvidence();
    }
    // The media element keeps playing silently so old WebRTC audio drains.
    // Record output onset before the end pause elapses: a quick new response
    // must not be swallowed just because it started inside that pause. The
    // stronger path needs text timestamped after the shopper's correction and
    // at least 50ms of remote quiet. It can remember a boundary while the stop
    // request is pending, but cannot play it until the request is accepted.
    if (
      this.muted &&
      !this.waitingForInput &&
      now - this.lastInput >= CANDIDATE_QUIET_MS &&
      outputSound &&
      outputGap >= 50
    )
      this.replyBoundary = true;
    // Without that user timestamp, keep the more conservative post-request
    // 120ms boundary plus fresh text, or the 600ms transcript-free fallback.
    if (
      this.muted &&
      this.controlAccepted &&
      !this.waitingForInput &&
      now - this.lastInput >= CANDIDATE_QUIET_MS &&
      outputSound &&
      outputGap >= 120
    ) {
      this.outputBoundary = true;
      this.drainedBoundary = outputGap >= 600;
    }
    const resumed =
      this.muted &&
      this.controlAccepted &&
      !this.waitingForInput &&
      now - this.lastInput >= END_PAUSE_MS &&
      outputSound &&
      ((this.replyBoundary && this.captionAfterUser) ||
        (this.outputBoundary && (this.drainedBoundary || this.freshCaption)));
    // GPT-Live has no output-turn completion/identity event. This combines
    // acoustic and transcript evidence, but cannot prove semantic freshness:
    // an old answer resumed after a long pause can resemble a new response.
    if (resumed) {
      this.muted = false;
    }
    return {
      interrupted,
      resumed,
      discardCaption,
      muted: this.muted,
      speaking: outputActive && !this.muted,
    };
  }
}

export function audioRms(values: Float32Array) {
  let sum = 0;
  for (const value of values) sum += value * value;
  return Math.sqrt(sum / values.length);
}
