# Along Chrome companion

The development extension notices product context on enabled public desktop pages and shows a small discovery nudge without requiring a copied link or manual capture. Open its side panel to inspect similar candidates, then choose **Discuss with Along** to bring one into the same Along conversation. This is an unpacked Manifest V3 build for Chrome 116 or later, not a published or approved Chrome Web Store release.

## Run the fixture demo

From the repository root with Node.js 22.18 or later:

```sh
npm ci
npm run build
npm run start -w @along/shopper -- --port 4324
```

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension/dist/along`. The build also writes `apps/extension/dist/along-extension.zip` with its manifest at the archive root.
2. Open [the Along app](http://127.0.0.1:4324), start a text conversation, and describe a need such as `a work and gym bag`.
3. Open the extension's settings. Its default app address is `http://127.0.0.1:4324`; use the exact same origin as your existing app tab. Accept the discovery disclosure, explicitly enable **Demo mode**, and choose **Connect with Along**. Approve **Connect extension** in the existing Along conversation.
4. Choose **Enable local demo page**, grant access when Chrome asks, and keep that page focused for at least five seconds. Its product fixture should produce a labelled demo nudge; unrelated content stays quiet.
5. Open the side panel and choose **Discuss with Along** on a candidate. Along continues the paired session with the source and candidate as reference context. Try a fit question or return with `Back to my catalog`.

Demo mode is off by default. It uses the curated bag, bedding and audio catalog with authored USD prices, labelled illustrations and **Coupang search links**, not verified Coupang offers. Demo mode does not call Coupang or OpenAI and does not interpret video crops. The local `/extension-demo` page is a controlled fixture, not evidence of reliable extraction from every supported website.

## Automatic discovery and permissions

Enable each site explicitly after accepting the disclosure. The current selectors support these desktop origins:

| Site | Context used |
| --- | --- |
| `www.amazon.com`, `www.amazon.sg` | Product pages: visible product title, structured product data and feature text. |
| `www.tiktok.com` | Supported public post captions and a visible video. |
| `www.instagram.com` | Supported feed, post and reel captions and a visible video. |
| `www.youtube.com` | Watch/Shorts titles and a visible video. |

Detection requires a focused, active tab and stable context for five seconds. Text requests have a 45-second cooldown; optional visual attempts are spaced at least 15 seconds apart. Duplicate discoveries do not repeatedly nudge. Selector changes, login gates, ambiguous feeds, fast scrolling and unsupported layouts can prevent detection. Native mobile apps and arbitrary websites are not supported. This is a heuristic reader of selected public page context, not an exhaustive product scanner.

The manifest includes `storage`, `scripting`, `sidePanel` and `activeTab`. Site and app host access is optional and requested during setup; scripts are registered only for enabled sites and the configured Along origin. The backend address must be HTTPS, or HTTP on `localhost`/`127.0.0.1` for development. Private-message, account, login, cart and checkout routes are excluded, and the extractor does not read input values.

**Visual discovery is a separate opt-in.** Automatic screenshots need Chrome's broader `<all_urls>` host permission because a fresh `activeTab` gesture is not available for each automatic sample. Along still restricts its own capture to enabled supported sites in the active, focused tab. It checks the source, visible video and intersecting form/dialog geometry before and after capture, crops the visible video locally, and sends a JPEG at most 640 pixels on its longest edge. It does not upload or retain the original viewport screenshot or capture audio. Chrome's granted access is broader than this internal allowlist. See Chrome's [captureVisibleTab API](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-captureVisibleTab) and [side panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).

The visual adapter suggests a search keyword from one sampled video crop; it does not identify every object, guarantee an exact model, track objects across a video, or implement a general crop tool for arbitrary page images. Protected video, overlays, multiple visible videos and uncertain model output are skipped. Live candidates are labelled **similar**, and fit, variant, authenticity, stock, delivery and complete checkout totals remain unverified.

Pause stops observations. Disable a site to stop detection there, or revoke its permission in Chrome. Clear discoveries removes extension results. Disconnect removes the extension's token and results; it does not end the Along conversation. Browser session storage, restricted to trusted extension contexts, holds the token and recent results; closing the browser clears it. Preferences remain in local storage. See the packaged [privacy disclosure](../apps/extension/ui/privacy.html).

## Live provider configuration

Without a configured provider, the API returns **unavailable** and no candidates. It never silently substitutes demo results. A `live` status means the adapter is configured; it is not a successful connection test or proof of approved use.

Provide server variables through the process environment or `apps/shopper/.env.local`; never place these keys in the extension or `NEXT_PUBLIC_*` variables. The root [`.env.example`](../.env.example) lists the settings. Container deployments must explicitly forward them to the shopper process.

| Variable | Default / purpose |
| --- | --- |
| `ALONG_DISCOVERY_PROVIDER` | Empty. Set to `coupang` to select the adapter. |
| `COUPANG_PARTNERS_APPROVED` | `false`. Operator assertion that API access and this extension placement/use have been approved; setting it does not obtain approval. |
| `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY` | Empty. Server-only Coupang Partners credentials. |
| `COUPANG_SEARCH_PATH` | `/v2/providers/affiliate_open_api/apis/openapi/v1/products/search`. The legacy path without `/v1` is the only other allowed path. Confirm the account's documented endpoint before live testing. |
| `ALONG_DISCOVERY_VISION` | `false`. Set to `true` only when optional crop processing is intended. |
| `OPENAI_API_KEY` | Required for optional vision as well as the app's separate voice-secret mint feature. |
| `ALONG_DISCOVERY_VISION_MODEL` | `gpt-4.1-mini`. A compatible image-input Responses model supporting strict structured output. |

Coupang's [seller OpenAPI](https://developers.coupang.com/en/api) manages seller operations; this adapter targets the separate [Coupang Partners Open API](https://partners.coupang.com/#help/open-api) keyword search. Its guide describes API-key eligibility after final approval, HMAC authentication, product-search fields and limits. It does not document an image-search endpoint or grant blanket permission for a proactive browser extension. Review the [operating policy](https://partners.coupang.com/#help/operating-policy) and [terms](https://partners.coupang.com/#help/terms), and confirm software/placement, transient retention, link handling and quotas with Coupang before enabling production use. The approval flag does not replace that confirmation.

The adapter calls only `api-gateway.coupang.com`, limits each response to ten candidates, uses an eight-second timeout and bounds requests and response sizes. Its process-wide ceiling is 50 searches per minute; an account may have stricter limits. Returned IDs, URLs and KRW prices are validated. Result links are ordinary `www.coupang.com/vp/products/{id}` URLs with only validated item/variant IDs retained. Automatic nudges and results do not insert affiliate tags or rewrite the source page's links. This implementation does not monetize affiliate clicks. Any future affiliate behavior must also satisfy Chrome's [affiliate ads policy](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads).

Optional vision sends the bounded crop and page context to the fixed OpenAI Responses endpoint with `store: false`, a strict output schema, a 12-second timeout and a process-wide ceiling of 15 requests per minute. Low confidence, refusals and malformed responses produce no visual match. See the official [image-input guide](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses) and [structured-output guide](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). Provider calls may incur charges and have their own retention terms; `store: false` is not a claim of zero provider retention.

No real Coupang search or paid vision call has been exercised in the automated tests. The implemented endpoint, account eligibility, current response behavior and extension permission from Coupang still require a separate approved live rehearsal. Provider failures remain unavailable rather than fabricating listings.

## Same-conversation handoff

Pairing starts from the authenticated Along page. A five-minute single-use code binds the extension ID to that session and epoch. Claiming it from the matching `chrome-extension://` origin yields a two-hour bearer token; the server retains only its hash. Cross-origin website requests cannot use the extension API, and reset/end invalidates the pairing.

Discoveries retain their source and candidate separately from the shopper's words. **Discuss with Along** selects a server-retained candidate, then routes to the tab with the matching session or resumes that exact authorized session. Text/voice mode, constraints, saved choices and history remain in the same conversation. If the shopper is paused, drafting, capturing speech or otherwise busy, the pending reference waits for an explicit safe import rather than interrupting their input. It does not turn on a microphone.

An imported reference invalidates an old purchase summary and is never an approval. Page text, captions, model output and extension clicks cannot confirm a purchase. External candidates are discussion context, not complete catalog offers: a captured price is not a delivered total, and selecting one cannot create a real order or payment. Returning to the curated catalog preserves its existing explicit simulated-confirmation boundary.

## Server boundaries and retention

The additive routes are `POST /api/discovery/pair`, `POST /api/discovery` for status/discover/handoff, and authenticated `GET`/`POST /api/discovery/inbox` for pending context and acknowledgment. Requests have bounded bodies, image validation, timeouts and per-pair rate limits. Image data and raw page text are not retained in the discovery store. The server never fetches an arbitrary page URL; source URLs are context only.

Pairings, rate counters, results and pending handoffs are in memory. Each pair retains at most 12 results for ten minutes; a newer discovery does not invalidate a still-retained earlier card. Selection is idempotent, including after acknowledgment. Epoch checks reject stale reset sessions and outdated asynchronous provider results.

Run the shopper and its discovery/session state in **one long-lived process** for this prototype. Restarting loses pairings, sessions and pending references. Multiple replicas or ephemeral serverless instances need shared storage and consistent authorization before deployment; the current maps provide neither durability nor cross-instance coordination. A public release also needs an identified operator, privacy/contact details and accurate store/provider disclosures.

## Checks

```sh
npm run build:extension
npm run test:extension
npm test -w @along/shopper -- tests/discovery.test.ts
npx playwright install chromium
npm run test:extension:e2e
```

Root `npm run build` also packages the extension. CI runs the unit/syntax checks and the extension browser suite after installing Chromium. The browser suite loads the extension's real scripts in a persistent Chromium profile against `/extension-demo`. A temporary test copy grants localhost in its manifest because headless Chromium cannot accept the native optional-permission dialog; the shipped manifest has no required host permissions. This verifies automatic detection, consent and pause controls, preserved drafts, correct conversation/tab selection, follow-ups and reconnect. Its managed app server disables live provider and vision credentials. The native Chrome permission dialog, real Amazon/social-site layouts, Chrome Web Store review, live inventory and paid provider behavior are outside that fixture test's coverage.
