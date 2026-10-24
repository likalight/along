# Shopping concierge backend

Implements backend work for issues #6–9. Local demo service with **simulated purchases only**. No payment, merchant, model or speech-provider calls. Node 22.18+ (Node 24 recommended), TypeScript, no runtime dependencies.

## Run

```sh
cd backend
npm ci
# Create a local agent secret; keep it in the AI server, NEVER frontend environment variables.
node -e "require('node:fs').writeFileSync('.env','AGENT_API_TOKEN='+require('node:crypto').randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'})"
npm run dev
```

Default `http://127.0.0.1:4318`. Configure `PORT`, `HOST`, and comma-separated `ALLOWED_ORIGINS` if needed. Default CORS allows localhost:5173, 127.0.0.1:5173, localhost:3000. Binding to loopback is intentional for the closed demo. This is a single-process ephemeral store, not a production multi-instance backend. Sessions expire after two hours and disappear on process restart. Restart is never represented as reconnect recovery.

```sh
npm run check
npm test
npm run demo
```

`demo` starts a disposable real HTTP server, compares competing offers, submits a valid selection, obtains an exact summary, **emulates** the UI/audio callbacks, and confirms a simulated purchase twice to demonstrate idempotency. It does not claim actual microphone/audio integration. Set `BACKEND_URL` and `AGENT_API_TOKEN` to rehearse an existing service.

## Integration contract

- [INTEGRATION.md](./INTEGRATION.md): current issue #2 public contract, routes, scenarios and live wiring.
- [src/integration-client.ts](./src/integration-client.ts): frontend/server client for the agreed field names.
- [API.md](./API.md): internal API for the provider-neutral agent tools.
- [src/contracts.ts](./src/contracts.ts): frontend/AI shared types.
- [src/client.ts](./src/client.ts): framework-neutral fetch client and streaming snapshots.
- [src/team-catalog.ts](./src/team-catalog.ts): active 24-product audio/bags/bedding profile with 48 labelled synthetic offers.
- [data/microphones-reference.json](./data/microphones-reference.json): 50 non-purchasable source research records with provenance.
- [src/catalog.ts](./src/catalog.ts): pure quote/eligibility functions and isolated legacy SGD regression profile.
- [src/store.ts](./src/store.ts): authoritative state, revisions, turn cancellation, exact summaries and approval.

The default follows the updated agreed issue #2: 12 audio, six bag and six bedsheet configurations. Lighting is deferred. Source specifications/reviews retain team-supplied URLs and unknown values; they were not independently reverified by this backend. Seller totals, stock, taxes and delivery are synthetic. The scenario clock is frozen at 24 October 2026, 10:00 Asia/Singapore, to fictional DEMO-DESTINATION. Reference prices are not executable offers. Relative SVGs are labelled illustrations, not product photographs.

To regenerate the 50-record reference data from the supplied attachment:

```sh
node --experimental-strip-types scripts/import-microphones.ts /absolute/path/microphone-demo-data.md
```

## Verified locally

The HTTP checks exercise complete purchase + concurrent retry; budget changes; stale, cancelled and reset turns; ambiguous/uncertain/echo/background approval; interrupted summary; unknown prices and invalid identifiers; role separation and CORS; and live snapshot streaming/reconnect. Amounts are integer cents with explicit USD/SGD currency, shipping/other fees charged once per order, item subtotal multiplied by quantity. `null` mandatory fees block approval.

Ordered product cards, honest missing reviews/videos, destination changes and USD totals are also checked. Frontend/voice integration is still required. In particular, the voice team must attest final shopper recognition and echo status, while the UI must report actual rendered summary and audio **playback end**, not audio generation completion. The backend cannot independently prove a human heard audio or that an upstream speech classification is truthful. Provider credentials stay in the voice server.

## Scope limits

- One product/variant and seller offer per simulated order, quantity 1–99.
- Exact-match specifications plus explicit laptop diagonal, mattress dimensions/depth and host connector compatibility checks. Unknown essential setup, package or fit blocks checkout.
- Catalog is process-static; updating fixtures requires restart, which expires sessions.
- The conservative English voice/text approval phrases are documented in INTEGRATION.md. Unrecognized or uncertain speech must reprompt, never force approval.
- Shared-host production auth, persisted receipts, real fulfillment and production voice verification are outside this closed hackathon demo.
