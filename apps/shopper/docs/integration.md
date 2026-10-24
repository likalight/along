# Session shell integration

## Authoritative state

The shopper UI talks to `AuthoritativeSessionStore` through same-origin `POST /api/session` (`lib/session/http-transport.ts`). That adapter wraps the backend `SessionStore` in-process — there is no separate backend process or agent secret for the Next.js demo. Fixture `lib/session/store.ts`, `/presenter`, and `/canvas-preview` remain isolated rehearsal surfaces and are **not** demo proof.

`SessionTransport` exposes connect, send, cancel, mode, presented, and lifecycle. Extra `heading`, `message`, `cards`, `category`, `summary`, and `receipt` fields are presentation projections only. Map backend accepted snapshots through `lib/integration/projection.ts`.

`connect` returns the latest complete session snapshot. The controller calls it after cancellation/reconnect to reconcile an already committed turn. It does not replay old commands or narration. Conflict responses carry the current snapshot and require another deliberate user turn.

Every accepted update must match session, epoch, current turn and an advancing revision. Voice lifecycle events also carry playback ID and optional summary ID. A late response cannot update the stage after a new draft, interruption, mode change, reconnect, or later turn.

## Cancellation ordering

A typed submission, adapter barge-in, Escape or pause increments a client generation, aborts the pending fetch, stops capture and speech, clears current playback identity, and queues server cancellation with the original session/epoch/turn/revision. **Ordinary draft edits do not cancel an already presented summary.**

The next input waits for cancellation and pending media lifecycle acknowledgments, reconnects to the latest snapshot and sends a new event/turn identity.

## Speech provider seam

`createSpeechAdapter(sessionId)` calls `POST /api/voice/mint`. When mint returns `mode:"live"` with a client secret, the shell uses `LiveSpeechAdapter` (GPT-Live client delegation). Otherwise it uses the labeled `BrowserSpeechAdapter` fallback and never claims duplex.

`SpeechAdapter.start/stop/speak/cancel/dispose` report actual capture activation, trusted final shopper transcripts, barge-in and recoverable errors. `speak` reports `audio.started`, `audio.completed` only after full uninterrupted playback, and `audio.interrupted` on output failure. Media/video transcripts must never enter the trusted `transcript` callback.

Video lifecycle from `ProductCanvas` is forwarded via `controller.handleMediaEvent` → `video.started` / `video.stopped` on the authoritative store so narration can pause.

## Confirmation and recovery

Summaries expose status `presenting` | `eligible` | `invalidated` | `confirmed`. Interrupted narration moves the shell to a `recovery` view with the selection preserved. Mode switch invalidates pending voice eligibility and re-displays the full summary. There is no purchase button — only the exact phrase `Confirm this simulated purchase` (text, or voice with trusted evidence) approves. Receipts are unmistakably **SIMULATED** and idempotent.

## Persistence

Sessions are process-local with a two-hour TTL. Use a single sticky Node process for the closed demo. Restarting loses sessions.

## Scope and verification

Automated checks cover modality paths, epoch/revision conflicts, cancellation, presentation before approval, and receipts. Browser speech tests use lifecycle fakes; they do not establish live speech recognition quality. Live GPT-Live mint requires `OPENAI_API_KEY`; without it mint returns authenticated `not_connected`.
