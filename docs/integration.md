# Session shell integration

## Authoritative state

`SessionTransport` in `lib/session/contract.ts` exposes connect, send, cancel, mode, and lifecycle. Replace `httpTransport` with a backend-backed implementation without changing the stage or composer. The current fixture uses the same contract v1 identifiers. Extra `heading`, `message`, `cards`, `category`, `summary`, and `receipt` fields are presentation projections for this shell, not a replacement for the catalog contract. Map backend accepted snapshots to these projections at the transport boundary.

`connect` returns the latest complete session snapshot. The controller calls it after cancellation/reconnect to reconcile an already committed turn. It does not replay old commands or narration. Conflict responses carry the current snapshot and require another deliberate user turn.

Every accepted update must match session, epoch, current turn and an advancing revision. Voice lifecycle events also carry playback ID and optional summary ID. A late response cannot update the stage after a new draft, interruption, mode change, reconnect, or later turn.

## Cancellation ordering

A draft edit, typed submission, adapter barge-in, Escape or pause increments a client generation, aborts the pending fetch, stops capture and speech, clears current playback identity, and queues server cancellation with the original session/epoch/turn/revision. Server cancellation is necessary even when fetch is aborted: cancellation of a network request is not proof that backend work was cancelled.

The next input waits for cancellation and pending media lifecycle acknowledgments, reconnects to the latest snapshot and sends a new event/turn identity. Backend proposals/actions must enforce cancellation before committing and reject superseded revisions atomically. The in-memory fixture is synchronous and demonstrates these rules; live distributed execution needs its own transactional implementation.

## Speech provider seam

Implement `SpeechAdapter.start/stop/speak/cancel/dispose` from `lib/voice/adapter.ts`. `start` reports actual capture activation, trusted final shopper transcripts, barge-in and recoverable errors. `speak` reports `audio.started`, `audio.completed` only after full uninterrupted playback, and `audio.interrupted` on output failure. Every callback must preserve the provided identity. Stop/dispose must release hardware and prevent late transcript delivery.

The controller serializes lifecycle writes so completion cannot overtake start. It checks identity again before applying acknowledgments or restarting capture. A live provider may derive orb intensity from measured levels; it must not infer lifecycle status from those levels or a timer. Media/video transcripts must never be supplied to the trusted `transcript` callback.

The bundled browser adapter intentionally stops recognition and releases tracks while speaking. Manual interruption is available; automatic full-duplex barge-in is not claimed for this fallback. Real microphone, speaker echo behavior and a selected live provider still require a device rehearsal.

## Confirmation

The server fixture creates and owns summaries and receipts. Every summary starts in `presenting`. The mounted summary view sends an identity-bound `summary.displayed` acknowledgment; text eligibility requires this acknowledgment, while voice eligibility additionally requires matching, full, uninterrupted playback completion. Cancellation while presenting invalidates it. The adapter cannot promote an interrupted summary by firing a stale completion. New non-approval inputs invalidate old summaries.

An explicit mode switch invalidates pending voice presentation, clears active playback, increments revision and returns the complete current summary again in the new mode. The UI displays every required summary field. If a direct text send unexpectedly changes mode while a summary exists, the controller displays the new summary and requires another fresh submission rather than using that same message as approval.

Only the exact trusted phrase `confirm simulated purchase` approves these bounded fixtures. Image/link inputs and vague assent cannot approve. Typed approval is available through the optional composer; there is no purchase button. The server must preserve idempotent receipts and validate the entire accepted order, including current compatibility, hard constraints and totals, when replacing the fixture.

## Scope and verification

Issue #3 provides the shell and fixture contract exercises. Product catalog/evidence surfaces (#4), production checkout orchestration (#5/#7), live session/voice integration (#7/#10), actual interpretation of images/links and full catalog constraint validation are separate work. The fixture UI labels missing evidence and synthetic data explicitly.

Automated checks cover both modality paths, epoch/revision conflicts, input idempotency, cancellation races, stale playback, denial, adapter barge-in, complete presentation before approval, explicit text redisplay, vague/media assent rejection, immutable receipts, upload/link states, reduced motion, keyboard use, narrow layouts and presenter separation. Browser speech tests use lifecycle fakes; they do not establish live speech recognition quality or real-device echo behavior.
