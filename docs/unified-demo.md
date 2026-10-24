# Along: one continuous demo

Chrome supplies inspiration, the Mac companion supplies remembered preferences, and the shopping app owns the conversation and purchase decision. Present these as one product. The app’s **Your context** drawer makes each source and its current use visible.

## Start the presentation machine

From the repository root:

```sh
npm install
npm run build
npm run demo
```

Keep this terminal running. Open `http://127.0.0.1:4339/setup` in desktop Chrome. The command configures the existing private Mac pairing, preserves the ignored API key and memories, and starts the one local server. It does not start recording or grant OS/browser permissions.

1. Open the existing **Along Context** Mac app. Use **Open Along** to pair Chrome; if macOS opens another browser, copy that local pairing address into Chrome. Do not show or share its pairing code.
2. For the demonstration, select only TextEdit in the companion. Use a clearly labelled synthetic note: “Demo shopper: I prefer lightweight bags.” Resume, foreground that note, and wait for the learned preference in `/context`. Pause after capture. Do not rely on a background edit triggering foreground capture.
3. Choose **Start shopping with these preferences**. This begins a new conversation using the latest saved memory. Mac preferences persist across conversations; the old order and chat do not.
4. Install the supplied unpacked Chrome extension from `apps/extension/dist/along`, or download its ZIP from `/setup` and extract it. Chrome’s Developer mode/Load unpacked step is manual. Set the companion’s app address to the same `http://127.0.0.1:4339`.
5. In the extension choose **Connect to Along**, then confirm **Connect extension** in the shopping tab. Enable only the chosen demonstration site. Optional visual recognition has a separate opt-in.
6. Choose **Start talking**, allow the microphone and rehearse an audible response. If audio cannot be verified, use **Type instead** and describe voice as unverified on this presentation machine.

Restarting the server invalidates in-memory shopping sessions. Use **New conversation** and reconnect Chrome afterward. Saved Mac preferences remain; automatic learning starts paused. A new Chrome tab may have a different conversation; the extension’s handoff returns to the tab that was explicitly paired.

## Seven-minute story

| Time | Show | Say / do |
| --- | --- | --- |
| 0:00–0:35 | Along’s main screen | “Shopping inspiration happens everywhere. Along carries that context into a decision.” |
| 0:35–1:20 | Your context | Show the lightweight preference learned from the labelled TextEdit note. Explain its source and that it can be corrected or removed. |
| 1:20–2:15 | Chrome inspiration | Open the rehearsed product page. For a reliable controlled demo, explicitly enable demo mode and use `/extension-demo`; call it a prepared example. Let the extension detect it. |
| 2:15–3:30 | Discuss with Along | Return to the same conversation. Say “I need a work and gym bag under USD 150.” Show browsing inspiration and saved preferences together. |
| 3:30–4:40 | Check my requirements | Ask what fits and what remains unknown. Change one constraint and show the decision respond. |
| 4:40–5:35 | Review and decide | For the prepared product, choose **Explore this demo product**, ask for offers, choose one, inspect the complete order and explicitly confirm. Point to the simulated receipt. No payment is taken. |
| 5:35–6:20 | Control | Show Mac pause, extension site consent and source provenance. External discoveries do not authorize orders. |
| 6:20–7:00 | Close / questions | “One conversation, context from your life, a decision you control.” |

Do the pairing and permissions before the seven-minute presentation. Keep only the shopping and inspiration tabs in front of the judges; setup is not the story.

## Verification boundaries

- The integrated installed-extension regression uses a temporary Chromium profile, an isolated synthetic Mac-memory store and deterministic shopping fixtures. It exercises real pairing, browser cookies, preference injection, discovery ingestion, draft preservation, session isolation, evaluation, reviewed simulated checkout, extension pause/reconnect and fresh-session behavior.
- This test does **not** prove live AI extraction, real microphone audio, live third-party website support or merchant purchases. Those need their own observed checks.
- Mac capture and automatic learning have a separate local verification record. The current demo must still check the native app’s permissions and foreground capture before presenting.
- The Mac companion learns supported bag preferences from readable content in selected apps, not every interaction or private account history. Chrome discovery is a separate, consented source.
- The local server is a single-user development/demo deployment. It is not a multi-user hosted memory service. Keep credentials, personal activity and pairing links out of presentation screenshots.

## Integration verification — 25 October 2026

- Production build and workspace TypeScript checks passed.
- Backend: 93 tests; agent: 126; shopper: 432; extension: 15; media fixtures: 5, all passed.
- Browser shopping/voice-adapter flows: 14 passed; product canvas: 13 passed; combined Mac-memory + installed-extension journey: 1 passed.
- The actual Chrome session reached “Listening · microphone on” and received microphone transcription after fixing the Live startup payload. Microphone was paused and a clean session opened afterward. A complete audible shopping conversation still needs the presenter’s rehearsal.
- The production app answered a live model-backed work/gym bag request with catalog-grounded options.
- The Chrome extension is verified in a temporary test profile, not yet installed in the presenter’s personal Chrome profile. The automation tool blocks the extension-manager URL; manual Load unpacked is required.
- Native companion observed running and paused; no new personal activity was collected for this integration check.

The voice startup fix preserves discovery context in separate initial messages. The [Live API reference](https://developers.openai.com/api/reference/resources/live/methods/create) permits one text part per initial message. The merged discovery payload violated that boundary and returned HTTP 400; the regression fixture now rejects the same invalid shape.
