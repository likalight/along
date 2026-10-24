# Along Chrome companion

A Manifest V3 extension for quiet, proactive discovery on explicitly enabled desktop websites. It uses the existing Along app and conversation; it does not introduce another chatbot or place orders.

## Build and load

From the repository root:

```sh
npm run test -w @along/extension
npm run check -w @along/extension
npm run build -w @along/extension
```

The build is dependency-free. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `apps/extension/dist/along`. The same build writes `apps/extension/dist/along-extension.zip` with its manifest at the archive root. Chrome 116 or newer is required. This is a local development build, not a published Chrome Web Store extension.

## Connect and try

1. Run the Along app at `http://127.0.0.1:4324`, or set its HTTPS origin in the extension settings.
2. Select **Connect with Along**. The extension opens or reuses the existing app. Confirm the connection in Along; a short-lived pairing code is exchanged for an extension-bound session token.
3. Accept the data disclosure and enable supported sites individually. A visible product/post must remain in focus for about five seconds before discovery runs. New results appear as a small dismissible chip. Click it to open the side panel.
4. Select **Discuss with Along** to reuse the current conversation. The extension never submits an order.

Demo mode is off by default. Enable it explicitly, then enable the local demo page. Only `/extension-demo` is observable on the Along origin. Demo results are prominently labelled and are not live Coupang price or availability claims.

## Automatic discovery boundaries

- Amazon structured products and product details; TikTok captions; Instagram post/reel captions and recognized visible feed articles; YouTube video titles; supported page markup only. No body-text dumps, comments, direct-message or input-field reads. Social-site markup can change, so unrecognized caption layouts remain quiet; enabled visual mode can observe the visible player instead.
- Site opt-in registers content scripts for those hosts. Exact origins, page routes, foreground focus, dwell, pause, duplication and cooldown are checked again in the service worker.
- Optional visual mode requires a separate, explicit `<all_urls>` permission because Chrome's screenshot API cannot provide automatic screenshots from narrow site grants alone. Along still limits use to enabled public sites and active focused tabs. It crops the visible video or main post-photo region locally to a maximum 640px JPEG, never uploads the whole viewport, never records audio, and only runs when the connected server reports `visionAvailable`.
- Captions/posters do not guarantee identification of an object in a video. Protected media and unsupported layouts may fail. Sparse sampling can miss brief appearances. Unknown matches remain quiet.
- Permissions can be revoked in Chrome. Pause and per-site switches stop observation. Disconnection clears extension credentials and recent results.

## Pairing and API contract

The bridge accepts only a same-window, same-origin `ALONG_PAIR_CODE` message addressed to this extension ID. The worker independently verifies the configured Along origin before claiming the code using `POST /api/discovery/pair`. It replies with `ALONG_PAIR_RESULT` without exposing the bearer token. The token lives only in trusted-context `chrome.storage.session`.

Authenticated `POST /api/discovery` actions are `status`, `discover`, and `handoff`. Discover includes `demo: true` only when explicitly enabled. Observations contain a source URL, title, bounded text, kind, and optionally a cropped JPEG. Candidate results distinguish demo/live/unavailable, exact/similar, and listing/search links. Session and epoch changes require reconnection and old results cannot be handed off into another conversation.

All JavaScript ships in the extension package. There are no remotely loaded scripts, analytics SDKs, cookies, affiliate-code injection or external browser automation dependencies. Service-worker state is persisted in session storage so suspension does not reset rate limits or expose tokens.

## Production release requirements

The packaged data-details page describes extension behavior. Before distribution, publish a privacy policy naming the operator, contacts, actual AI/search providers, and server retention/deletion practices; complete Chrome Web Store disclosures; validate host permission justification and any affiliate program separately. Store approval is not implied by this development build.
