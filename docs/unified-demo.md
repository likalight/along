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

## Seven-minute story — voice first

The microphone journey below is the current presentation. Mac context and browsing discovery are optional Q&A demonstrations, not onboarding steps for the judges.

| Time | Show | Say / do |
| --- | --- | --- |
| 0:00–0:40 | Fresh Along screen | Start talking: “I need a discreet clip-on microphone for dictating to AI agents in crowded places.” |
| 0:40–1:40 | Voice and product choices | Answer the actual follow-up, state a USD 400 budget and USB-C laptop, then explore RØDE Wireless PRO (`MIC-062`). |
| 1:40–2:20 | Product photo | Ask for photos. Explain that catalog facts and unknown performance claims stay distinct. |
| 2:20–3:20 | Chrome review | Ask for the video. The extension opens the curated Short with **Back to Along**. |
| 3:20–4:00 | Same conversation | Return, resume voice, and change the budget to USD 320. Check that the current constraint is reflected. |
| 4:00–5:15 | Spoken order summary | Ask to review the order. Hear the item and complete simulated total before approving. |
| 5:15–6:00 | Simulated receipt | Explicitly approve the current order; show one receipt. No payment is taken. |
| 6:00–7:00 | Questions | If asked, reveal Settings → Show context & connections and explain source provenance, recording controls and infrastructure. |

Pairing and permissions are preflight. Leave the microphone off until the presenter presses **Start talking**. Do not claim the model has verified crowded-room dictation quality or active noise cancellation from the seeded catalog.

### Reset for an independent rehearsal

Open `http://127.0.0.1:4339/?fresh=1` in the existing presentation tab. This creates a new conversation with no cart/order/history, while saved Mac preferences and installed companion permissions remain. Under Settings, show context & connections, choose **Reconnect extension**, verify Chrome connected, then hide the context panel again. Do not restart the server during the rehearsal. The latest fresh-session check showed an empty brief except USD, learning paused, Chrome connected, and the voice-first “What are you looking for?” screen.

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
- The Chrome extension is now installed in the presenter’s personal Chrome profile. Real YouTube playback and return to the original conversation were verified; see the personal Chrome rehearsal below.
- Native companion observed running and paused; no new personal activity was collected for this integration check.

The voice startup fix preserves discovery context in separate initial messages. The [Live API reference](https://developers.openai.com/api/reference/resources/live/methods/create) permits one text part per initial message. The merged discovery payload violated that boundary and returned HTTP 400; the regression fixture now rejects the same invalid shape.

## Voice-first microphone presentation (25 October)

Start at `/` with **Start talking**. Context is hidden until Settings → Show context & connections. Do not claim Mac recording is running because learning is enabled: native recording is separately controlled by Along Context. The context panel has a learning toggle, provenance, and an expandable explanation of capture → authenticated local server → AI extraction → local memory → shopping session. Supported automatic memory currently covers bag colour/style/weight/capacity, not every possible preference.

Suggested shopper journey:

1. “I want a microphone to dictate prompts to AI agents in crowded places. I move around, so a clip-on would be useful.”
2. Answer the actual follow-up. For the planned product: “Show me the RØDE Wireless PRO. My budget is 400 US dollars.” Do not confuse it with Wireless ME, GO II or Micro.
3. “Show me photos of that one.” The catalog already has a product photo for `MIC-062`.
4. “Show me a video of it.” The model calls `show_product_video` for the exact visible product. The app pauses capture and narration, then opens the curated YouTube Short in an in-app review window. No extension is needed for this step.
5. Click **Continue conversation**. Along removes the video player before restarting voice in the same conversation. Closing with X or Escape stops the video but leaves voice paused. Choices and unfinished text remain.
6. “I'd like that one. My computer has USB-C.” Review the complete simulated offer, then give explicit approval. No real payment occurs.

Optional Chrome fallback preflight in the extension settings: connect the same local Along address and enable **YouTube return button**. This is separate from discovery consent, requires only YouTube host permission, and does not enable browsing observation or screenshots. The review tab is excluded from automatic discovery so it cannot replace the product with a new external reference. Opening requires a current paired session; the page cannot provide an arbitrary destination URL.

Curated link: https://www.youtube.com/shorts/WCsWHqMdPJI — “Rode Wireless Pro - Review & Audio Test”, DansTubeTV. The page title and product match were checked. This is an external creator review, not measured proof of dictation quality in crowded areas. Playback depends on YouTube, connectivity and its own user controls; no copied video is distributed.

Fallback: the review window has **Open in Chrome**, which invokes the existing paired-extension path. **Back to Along** returns to the same conversation, then **Continue conversation** resumes voice. Without the extension, **Open in new tab** opens a separate tab and says so; this is not represented as a successful extension handoff. If a presenter closes the video manually, switch to the existing Along tab and resume there.

Verification for this presentation flow:

- Live AI (typed input through the production shopping harness) displayed the Wireless PRO photo, requested the exact curated video, prepared a USD 298.06 simulated order and produced a receipt after explicit approval. No real payment was taken. The existing GPT-Live transport remains integrated; this pass does not claim a full spoken rehearsal.
- Installed-extension browser checks passed for both Mac-memory/discovery checkout and the new video round trip. The video test intercepts YouTube with a local test surface to verify real extension navigation, the return control, preserved session/draft, and paused microphone. It does not verify YouTube playback.
- Video return permission does not enable discovery observation, screenshots, or microphone access. The test verifies those settings remain off.

Personal Chrome rehearsal, 25 October:

- The presenter loaded the unpacked extension and enabled its YouTube return permission. Pairing from Along's web app showed “Your Chrome companion is connected.”
- “Watch review in Chrome” opened the real supplied YouTube Short. Playback advanced while muted, with the Along orb and Back to Along visible.
- Back closed only the review tab and returned to the original app tab. The Wireless PRO, brief, conversation history and unfinished draft were unchanged; the microphone stayed paused.
- Talk to Along resumed to “Listening · microphone on”; capture was then paused. Typed checkout continued in that same conversation and produced simulated receipt 38D0A9C5 for USD 298.06 after explicit approval. No real payment occurred.
- This verifies personal-profile navigation, real video playback, return/session continuity, live voice resumption and simulated checkout. It does not claim an entire purchase spoken aloud by the presenter.

## Remaining acceptance check

The current production rehearsal verified cancellation before a pending typed request completed: the app reported “Stopped. No purchase was made.” A subsequent microphone session transcribed room speech, but did not establish a spoken shopping journey. It was paused, and a fresh independent demo session was prepared at the presenter’s request.

Still required before claiming the full voice journey complete: an observed revised constraint applied in the live conversation; the presenter hearing the complete spoken purchase summary; explicit spoken approval bound to that current summary; and exactly one simulated receipt from that approval. Existing typed checkout evidence and provider fixtures do not substitute for this human rehearsal.

## Voice and presentation refinement — 25 October

The conversation now has a separate Sound on / Muted control. It mutes assistant output, not the microphone; the Live adapter preserves this state through audio sampling and reconnect/resume. Browser fallback suppresses spoken output without asserting that a summary was heard.

Product presentation follows unambiguous spoken model names and explicit navigation. It preserves focus through unrelated backend revisions and reconciles names that arrive before the first shortlist. Short names omit comma-separated catalog configuration only when unique among visible products. Direct Chrome/YouTube navigation captions request only the current curated review; they do not select an offer or authorize checkout. The server also recognizes these phrases as video requests.

The review action now follows the presented product and sits below it. The global demo strip and returned-video banner are removed. Simulation disclosure remains in Settings, order review and receipts. In the Chrome fallback, Back to Along returns to the same conversation, then Continue conversation enables voice. The YouTube tab does not listen for spoken return commands.

Validation: targeted voice focus/playback/lifecycle checks, installed-extension review/return check, accepted-carousel navigation check, production build and TypeScript passed. In personal Chrome, the typed natural-language request “Take me to the Chrome tab” opened the real YouTube review and its Back control returned to the same session. Live human speech timing and the final spoken checkout still require presenter rehearsal; these checks do not claim otherwise.


### In-app review verification — 25 October

- The supplied YouTube Short actually played in the embedded player in personal Chrome, with elapsed time advancing and captions visible. Muted it during verification.
- Continue conversation removed the player, preserved the Wireless PRO result and prior conversation, and reached Listening · microphone on with the real GPT-Live adapter. Reopening the player paused voice; X left the microphone off.
- Browser lifecycle check passed: no new tab, stopped capture, removed iframe before resume, preserved session and unfinished draft, subsequent shopping input in the same session. Uses a deterministic video surface and mocked speech; it does not independently establish media quality.
- Installed-extension fallback round-trip check passed with a deterministic YouTube surface. The final build also opened the real Short via Open in Chrome in the personal profile; Back to Along closed that tab and restored the original conversation. Build and TypeScript passed.
- One live embed initially remained blank; closing and reopening loaded it successfully. YouTube can block embedding, autoplay or availability; native player controls and Open in Chrome remain available. No video file is copied or hosted.
