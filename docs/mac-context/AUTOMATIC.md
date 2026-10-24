# Automatic Mac preferences (local demo)

The Mac companion now sends new, redacted supported-app excerpts to the local Along server while learning is enabled. The server uses the configured OpenAI Responses API to extract explicit shopping preferences, validates a bounded enum result and exact source evidence, then persists inferred memories on this Mac. It does not mark an inference as approved.

## Run

1. Add `OPENAI_API_KEY` to the Git-ignored `apps/shopper/.env.local`.
2. Run `node scripts/context/configure.mjs` (defaults to `http://127.0.0.1:4339`; set `ALONG_CONTEXT_URL` for another local port).
3. Run `npm run build`, then `npm run start -w @along/shopper -- --port 4339`.
4. Build the companion using `sh apps/mac-companion/build-app.sh`, and open `apps/mac-companion/dist/Along Context.app`. macOS may require refreshing Accessibility after an ad-hoc rebuild.
5. Click Allow/Resume after reading the disclosure. Click Open Along once to pair the browser. New captured preferences appear in `/context` and seed new conversations without import/export.

The local pairing configuration is generated with a random device token in a private `~/Library/Application Support/AlongContext/connection.json` file. The server reads that path only when `ALONG_CONTEXT_DIRECTORY` is explicitly configured. The provider key stays on the server. Pairing exchanges a fragment token for an HttpOnly, SameSite=Strict browser cookie; the fragment is immediately removed. Native observations require the device bearer token, not merely a paired browser cookie. Host and origin must match the configured loopback endpoint. This is not a hosted multi-user authentication system; deployment requires real per-user authentication and encrypted remote device registration.

## Behavior and limits

- Supported automatic preferences today: bag colour, bag style, and weight-versus-capacity priority. This is not a general biography or access to ChatGPT history, Instagram, Facebook or full email inboxes.
- Text capture remains restricted to the foreground TextEdit/Notes/Mail/Outlook accessibility surface already supported by the collector. Browsers and other apps produce counts only; counts are not sent for inference. No screenshots, clipboard, raw keystrokes or audio capture.
- Text is redacted again server-side, sent to OpenAI with `store: false`, and never persisted by this memory server. Redaction is best effort; do not enable sources containing information you do not want sent. The companion retains local activity under its existing 24-hour/1,000-event policy.
- Only explicit first-person durable preferences are eligible. Quotes, other people's messages, advertisements, hypothetical requests and sensitive attributes are excluded by the extractor instructions. Model output still requires a supported enum, confidence >= .85 and an exact source quote. These checks reduce errors; they cannot prove authorship or truth. The UI labels inferences and exposes their source and confidence.
- Preferences expire after 90 days. They are soft defaults, not budget, fit, purchase or payment authority. Current shopping instructions win. Active sessions are not overwritten; new conversations pick up the latest memory.
- Pause learning stops new inference; Pause in the Mac companion stops both capture and learning. Server restart pauses inference. Memories remain available until forgotten or expired. Resume in the companion reconnects learning.
- Corrected/forgotten fields are protected from relearning until Reset corrections is chosen. Forget all also pauses learning. Existing conversations retain their snapshots; start a new conversation after forgetting. Deletion of native history is separate from Forget in the browser; the native Delete action attempts both and surfaces an offline failure.
- Single process/local profile. Model requests are serialized, limited to six per minute, use a 30-second timeout, and deduplicate accepted source IDs. Native retries keep at most eight events for five minutes. In-flight results are discarded if pause/delete/correction changes the memory generation.
- No key, pairing secret, raw activity or user profile is checked into Git.

## Verification

`scripts/context/automatic-smoke.mjs` runs actual HTTP and actual OpenAI extraction against a disposable profile (`ALONG_CONTEXT_QA_DIRECTORY=/tmp/along-context-qa-…`). It verifies automatic session personalization, unpaired-browser isolation, cross-origin rejection, native-only ingestion, duplicate event handling, correction protection, reconnect preservation, unsupported/expired events, and forget/pause. It never reads personal activity. Use separate server/profile ports from the user's app.

Verified on 25 October 2026 with the user-supplied API configuration:

- Actual foreground TextEdit capture after Accessibility permission refresh → native upload → live model extraction → preferences visible in the paired browser. Synthetic email/password text was redacted.
- A new live shopping conversation automatically used olive/backpack/low-weight preferences without the request mentioning them, returned catalog choices, and explicitly disclosed unverified colour availability.
- A separate live shopping flow reached a simulated purchase receipt; no real order or payment was placed.
- Synthetic inferred preferences were removed after verification; native recording and server learning were left paused.
- Backend (80), agent (107), shopper (284), microphone timeout/cancellation (2), browser journey (13) and canvas (13) checks passed, along with TypeScript checks, production builds and the Swift release build.
- Real voice audio is not verified: the built-in browser microphone permission remained pending. The adapter now times out after 20 seconds, exposes typing/retry, and stops a late-granted stream. That recovery was verified in the real browser.

The live shopping model took noticeably longer than memory extraction in this run. Functional correctness is verified; interactive voice latency and a spoken round trip remain separate checks.
