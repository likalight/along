# Along Context — local Mac companion (v0.1)

This is a native AppKit prototype, not an integration with OpenAI's private Computer History service. It starts paused on every launch and has no network client, login item, hidden daemon, or automatic permission grant.

## Run

```sh
cd apps/mac-companion
sh build-app.sh
open 'dist/Along Context.app'
```

The bundle is locally ad-hoc signed. It is not notarized for public distribution. After a changed rebuild, remove the old Along Context entry from macOS Privacy & Security and add this exact bundle again; toggling an old entry may retain its obsolete code-signature requirement. A stable Developer ID signature is needed for smoother updates before distribution. Requires macOS 14+, Swift 6, and Apple command-line tools.

For the matching Along browser app, from the repository root:

```sh
npm run build -w @concierge/backend
npm run build -w @coupang/agent
ALONG_AGENT_MODE=fixture npm run dev -w @along/shopper -- --port 4331
```

The command above runs the existing offline development harness for reproducible verification. Production uses the team’s model connection; it does not silently fall back to fixtures.

Open http://127.0.0.1:4331/context in the built-in browser. The native Open Along import button opens this URL in the system default browser; browser-local preferences are not shared between browsers.

## First screen

The main window has one primary **Allow** button and a short access explanation. Allow enables app-usage capture (including subsequently opened apps) and supported native text. If Accessibility is missing, it opens the macOS permission screen and starts only after permission is granted and the app becomes active again. The button becomes **Pause**; later launches remain paused with **Resume**. Settings & history contains app exclusions, the native-text switch, inspection, export and deletion. OS permission cannot be replaced with an in-app consent button.

## Capture contract

- Nothing is captured before Allow. Allow selects all eligible apps; password managers, Keychain, system settings and the companion itself remain excluded. Per-app exclusions are available under Settings. A restricted allowlist mode remains available for TextEdit-only QA before first Allow. Changing selection pauses capture.
- Requires Accessibility, granted by the user. Permission is checked during recording; revocation pauses it.
- Global mouse-click, scroll, keyboard-activity counts and app activation, batched every three seconds. This does **not** read key characters, key codes, clipboard contents, screenshots, camera, or audio.
- Supported native-app text: TextEdit document text; accessible static text beneath the focused element in Notes, Mail and Outlook. Not all apps expose text; missing content is reported as no captured text. Allow includes this disclosed access; Settings can disable it separately.
- Reads only the current foreground app, with traversal, character and IPC timeout bounds. Password/form fields are skipped. Obvious secrets, URLs, emails and long numbers are redacted best-effort. This is not a guarantee that arbitrary sensitive prose can be detected.
- All browsers/unknown apps receive **activity counts only**. No browser title, URL, DOM or text access, because private browsing cannot reliably be identified through generic Accessibility. Browser-specific collection remains unimplemented.
- Sleep, screen sleep or session deactivation pauses; no automatic resume. Reviewing a row pauses capture to keep its source stable. Close the window to leave the visible menu-bar indicator; Quit stops collection.

## Storage and review

Files live in `~/Library/Application Support/AlongContext/`: directory mode 0700, JSON files mode 0600. They are not encrypted by this app; FileVault and machine security remain separate. Activity is capped at 1,000 entries and 24 hours. Retention runs at launch, each append/export and every minute while running. When the app is closed, pruning runs on next launch. Confirmed preferences expire after 90 days.

The timeline shows exactly what was persisted. V0.1 does **not** run an AI extractor. The user selects an activity and explicitly confirms a supported bag style or colour. These are personal assertions associated with an observation, not inferred facts or proof of purchase. Further fields need their own validation and ranking integration.

Export contains only reviewed enum preferences, source app labels, event identifiers and dates — never raw activity excerpts. `/context` previews and validates the export before the user enables it. The browser persists it locally; only on a new shopping session does it send reviewed preferences to Along. Reconnection does not reseed an existing session. Server validation repeats the field/value/date checks. Initialization is restricted to unused sessions and cannot mutate approval or checkout state. Current user statements can override imported preferences.

Forget in the browser removes future imports; existing sessions retain their current preference snapshot until a new session/expiry. Native Delete clears local activity and memories, not exported files or already-imported copies. There is no identity-based cross-device deletion/sync yet.

## Human-checkable walkthrough

1. Open a fresh TextEdit document with harmless sample text: “I prefer olive backpacks.”
2. Before first Allow, open Settings & history, Refresh app list, enable TextEdit only and opt into native text. Do not click the main Allow button during this restricted test.
3. Click Grant Accessibility, complete macOS permission yourself, and Start recording.
4. Switch to TextEdit, click/scroll/type; return to the companion and select the recorded row. Capture pauses. Inspect the excerpt.
5. Confirm colour olive and style backpack from that row; export reviewed preferences.
6. In Along `/context`, import, review, enable, and start a new shopping session. Say/type “I need a bag.” The stored soft preferences guide bag discovery without a repeated colour/style question.
7. Change the preference explicitly in the conversation and confirm the current statement wins. A fresh browser session without an import must have no borrowed context.
8. Pause/delete locally and Forget in the browser. Restart the native app: capture must remain paused.

## Remaining work

Automatic extraction (using the AI teammate's connection), app-specific browser/communication capture, reliable source deletion propagation, authenticated cross-device memory, encrypted storage and distribution/notarization. Do not label this version “records everything” or “ChatGPT history connected.”

## Integration verification

With that development server running, use `node scripts/context/smoke.mjs` from the repository root. Override the local origin with `ALONG_CONTEXT_BASE_URL` when needed. It checks session isolation, invalid/expired imports, correction precedence and reconnect behaviour against the actual HTTP API. See [team handoff](../../docs/mac-context/INTEGRATION.md) for scope and contracts.
