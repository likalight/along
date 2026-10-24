# Along — conversational shopping session

The integrated demo uses **GPT-Live** for continuous conversation and **GPT-6 Luna / GPT-6.1 Sol** for routed open-ended shopping reasoning with server-validated tools. See the [open-ended harness](docs/open-ended-harness.md), root [integration guide](../../INTEGRATION.md), and [live voice guide](docs/live-voice.md). A server-side `OPENAI_API_KEY` is required for live conversation. The fixture-specific behavior documented below is historical and does not describe the integrated server.

Next.js App Router + TypeScript implementation of [issue #3](https://github.com/likalight/coupangchallenge/issues/3), using the [contract v1 baseline](https://github.com/likalight/coupangchallenge/issues/2). A light canvas, persistent blue ElevenLabs UI Orb, one adaptive content stage, optional composer, and photo/link reference tray.

## Run locally

Requires Node 22.13+ and npm. `npm ci`, then `npm run dev`. Open http://127.0.0.1:3000. Nothing is deployed by these commands. No credentials are required.

- `npm run typecheck` — TypeScript checks.
- `npm test` — session, cancellation and approval invariants.
- `npm run test:e2e` — browser journeys. Run `npx playwright install chromium` first, or set `CHROME_PATH` to a local Chrome executable. On macOS the config uses the installed Chrome when available.
- `npm run build` — production compilation.
- `npm run format:check` — formatting for authored source (vendored Orb excluded).

## Try a complete journey

Choose **Start talking** for GPT-Live, or **Type instead** for explicit text mode. Say/type:

1. “cafe dictation” → “choose headset” → “best value” (alternatives: “a work and gym bag” → “shape, budget USD 150”; or “bedsheets for a warm room” → “budget USD 150”).
2. “compare” → “show option 1” → “show evidence” → “show offers”.
3. “choose faster offer” → listen to the complete summary (voice) or read it (text).
4. “confirm simulated purchase” → a simulated receipt. “Looks good” cannot approve an order.

“Show options”, “save for later”, and “review summary” also work. The fixture understands these bounded commands; it is not a live conversational agent. Photo interpretation is not implemented: it asks the shopper what to retain from the reference. No external page is fetched for links. Supported link: `https://demo.example/bags/navy`. Prepared image use requires no file upload and remains deterministic.

`/presenter` is a separate presenter-only entrance preview, with rehearsal instructions, Replay, and visibly disconnected Gmail/Outlook placeholders. These controls do not appear on `/`; no OAuth or mailbox access is requested.

## Voice behavior and accessibility

The browser adapter uses Web Speech recognition and speech synthesis behind `SpeechAdapter`. Availability, recognition processing and privacy depend on the browser; recognition may use the browser vendor’s online speech service. Microphone access starts only after an explicit voice action. Ready, listening, thinking, speaking, paused, reconnecting and error labels follow actual adapter/request events. An inactive microphone has no listening halo or idle pulse.

The bundled fallback is **half duplex**: it releases microphone tracks and stops recognition before narration so assistant audio cannot become shopper instructions or approval. Use **Interrupt response** or Escape, then **Speak / interrupt** to speak a correction. A full-duplex provider can call the same `bargeIn` callback; acoustic echo cancellation and reliable automatic barge-in require the live adapter integration. Playback errors never grant approval. Denied/unavailable microphones leave explicit text mode available.

Reduced motion uses a static CSS orb and immediate stage changes. Unsupported/lost WebGL and rendering failures also fall back to the CSS orb. Controls use native keyboard interactions, visible focus, readable transcripts and live status. Mobile layouts stack cards with stable numbering. Animations never reorder accepted IDs or ranks.

## Integration boundary and limits

See [docs/integration.md](docs/integration.md) for adapter and cancellation details. `lib/session/contract.ts` is the typed contract; `SessionTransport` and `SpeechAdapter` are replacement seams for #7 and #10. The visual shell consumes accepted snapshots only. It does not run an agent or invent accepted actions locally.

`app/api/session` is an **in-memory server fixture**, with event idempotency, revision/epoch conflicts, summary presentation eligibility and immutable simulated receipts. It is deliberately local/demo infrastructure: sessions expire after an hour, are capped at 100, are not authenticated, are lost on restart, and do not support multiple server instances. Do not use it as a production backend. Catalog validation, actual constraints, offer eligibility, verified evidence and agent interpretation belong to the backend/agent issues. Three plainly labeled synthetic shell cards per category demonstrate adaptive views; they are not the 24-product catalog or a claim that constraint validation has been delivered.

Summary fixtures have itemized USD totals, exact demo variant/seller, synthetic destination, dates fixed relative to 24 October 2026 in Asia/Singapore, conditions and uncertainties. All purchases are simulated. No checkout provider, OAuth, external mailbox, real payment or live seller API is connected.

Uploaded JPG/PNG/WebP files are checked for type, signature and 5 MB size and remain in memory as previews; no persistent storage or vision service is connected. Removing a shared reference sends a new accepted turn. At most 12 assets can be uploaded per session. Unknown links return unavailable.

## Third-party component

The MIT-licensed [ElevenLabs UI Orb](https://github.com/elevenlabs/ui) is vendored at `components/ui/orb.tsx` from commit `3a28ebab197f8cfa599934f52db12ad1396e54f4`, with its license alongside it. The only functional source change is a local URL for its official noise texture, vendored in `public/fixtures/perlin-noise.png` to avoid a runtime CDN dependency. Motion handles stage entrance/exit transitions. The Orb is a visual component; no ElevenLabs speech service or account is configured.
