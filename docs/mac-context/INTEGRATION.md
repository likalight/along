# Mac context integration handoff

> Historical PR #26 handoff. Automatic local inference and browser pairing are now implemented; see [AUTOMATIC.md](AUTOMATIC.md) for the current setup, scope, and verification.

## Scope of this PR

Adds an opt-in native Mac collector and a validated preference import boundary in Along. This is a working foundation, **not automatic AI memory or a completed background-sync feature**. The user chose to use the AI teammate's connection when supplied; this PR creates no provider credentials or model calls.

- Mac: one primary Allow action, then Pause; starts paused on each launch. App usage plus bounded accessible text in supported native apps; exclusions and inspection under Settings.
- Web: `/context` validates a versioned export and stores approved bag colour/style preferences in this browser. No raw activity text is sent to the shopping session endpoint.
- Session: new `connect` requests optionally carry `reviewedContext`. Existing clients omitting it behave as before. Existing-session reconnect does not reseed. Current explicit instructions override the imported soft preference. Import does not authorize checkout.
- Current main's authenticated voice evidence, live sideband, activity reporting, checkout flow, catalog and frontend layout are retained.

## Team integration points

`apps/mac-companion/Sources/AlongContext/Models.swift` defines native `Activity`, `ReviewedMemory`, and version-1 `ContextExport`. Native records stay in Application Support with a 24-hour/1,000-record cap; reviewed preferences expire in 90 days.

`apps/shopper/lib/context/memory.ts` owns the shared browser/server validator. Version 1 accepts at most one `color` and one `shape`, with enum values. Each item has `id`, `key`, `value`, `sourceApp`, `sourceEventID`, `observedAt`, `approvedAt`. These source labels are unverified user-supplied data, not identity or proof of a preference.

`POST /api/session` accepts optional `reviewedContext` on new-session `connect`, validates before allocating a session, then initializes soft preferences through `AuthoritativeSessionStore.initializeReviewedPreferences`. The core store only permits initialization before any turns, history, receipt or preferences exist.

## Automatic learning follow-up

Do not represent AI-generated guesses as `approvedAt` or silently feed them through the reviewed-preference schema. The teammate connection needs a separate inferred-memory contract with provenance, confidence, expiry and correction/deletion semantics. Connect it through an authenticated, per-user/device channel; do not expose a global local activity file to arbitrary web sessions. Consent must name what leaves the Mac and its destination before text is sent to a model. No model endpoint is supplied or assumed here.

The desired subsequent UX is Allow → scoped capture → automatic inference → session personalization, with pause/delete/correction instead of review/export. This PR does not claim that subsequent UX is implemented.

## Verified against main 57cb4f0

- Full monorepo build and typecheck pass.
- Existing backend: 73 checks; agent: 104; shopper: 278.
- Existing browser journeys: 13 passed.
- HTTP context smoke: seeded shortlist, current preference corrections, reconnect preservation, independent empty session, rejected unsupported/expired data, and authentication boundary.
- Native release build and real TextEdit capture verified locally; synthetic preference text captured and sample email/password line redacted. Capture then paused and file contents remained unchanged. Other apps were excluded during that test.

Native binaries, machine-local activity, exported personal data, credentials and desktop screenshots are not part of the PR. The native bundle is ad-hoc signed; changed builds require replacing the old macOS permission entry. Stable signing/notarization remains a distribution task.
