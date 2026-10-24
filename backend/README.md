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

- [API.md](./API.md): routes, call sequence, examples, trust boundaries and errors.
- [src/contracts.ts](./src/contracts.ts): frontend/AI shared types.
- [src/client.ts](./src/client.ts): framework-neutral fetch client and streaming snapshots.
- [src/voice-catalog.ts](./src/voice-catalog.ts): current lighting/audio profile; 18 products, 36 synthetic offers, source-linked microphone evidence and unknown-fee cases.
- [data/microphones-reference.json](./data/microphones-reference.json): 50 non-purchasable source research records with provenance.
- [src/catalog.ts](./src/catalog.ts): pure quote/eligibility functions and isolated legacy SGD regression profile.
- [src/store.ts](./src/store.ts): authoritative state, revisions, turn cancellation, exact summaries and approval.

The current default follows the 22:23 voice build brief (lighting + audio). The later combined data file proposes bags + bedding + microphones, so category agreement remains pending. Profiles isolate this choice from the HTTP contract. Microphone identities/specs/reviews preserve team-supplied source snapshots; the backend has not independently reverified them. All seller prices, stock, taxes and delivery promises are synthetic, labelled demo offers. No reference price is represented as a verified payable price. Synthetic SVGs are style/category illustrations, not product photographs. Resolve relative media URLs against the backend URL.

To regenerate the 50-record reference data from the supplied attachment:

```sh
node --experimental-strip-types scripts/import-microphones.ts /absolute/path/microphone-demo-data.md
```


## Verified locally

The HTTP checks exercise complete purchase + concurrent retry; budget changes; stale, cancelled and reset turns; ambiguous/uncertain/echo/background approval; interrupted summary; unknown prices and invalid identifiers; role separation and CORS; and live snapshot streaming/reconnect. Amounts are integer cents with explicit USD/SGD currency, shipping/other fees charged once per order, item subtotal multiplied by quantity. `null` mandatory fees block approval.

Ordered product cards, honest missing reviews/videos, destination changes and USD totals are also checked. Frontend/voice integration is still required. In particular, the voice team must attest final shopper recognition and echo status, while the UI must report actual rendered summary and audio **playback end**, not audio generation completion. The backend cannot independently prove a human heard audio or that an upstream speech classification is truthful. Provider credentials stay in the voice server.

## Scope limits

- One product/variant and seller offer per simulated order, quantity 1–99.
- Exact-match specification constraints; numeric ranges must be added explicitly, not guessed by the model.
- Catalog is process-static; updating fixtures requires restart, which expires sessions.
- The conservative English approval phrases are documented in API.md. Unrecognized or uncertain speech must reprompt, never force approval.
- Shared-host production auth, persisted receipts, real fulfillment and production voice verification are outside this closed hackathon demo.
