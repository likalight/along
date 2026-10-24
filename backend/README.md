# Along backend

Authoritative shopping sessions, catalog validation, and explicit approval for **simulated purchases**. Implements issues [#6](https://github.com/likalight/along/issues/6), [#7](https://github.com/likalight/along/issues/7), [#8](https://github.com/likalight/along/issues/8), and [#9](https://github.com/likalight/along/issues/9) against the accepted [contract v1](https://github.com/likalight/along/issues/2).

Node.js **22.18+**, TypeScript, and no runtime package dependencies. The default profile imports the shared `catalog/` package: 24 products, 48 synthetic USD offers, and attributed evidence.

## Run the checks and rehearsal

```sh
cd backend
npm ci
npm run verify
```

Verification runs TypeScript checks, deterministic session/HTTP regression tests, and all three HTTP purchase journeys. The rehearsal covers café audio (voice, USD 148), work/gym bag (text, USD 119), and bedsheets (text, USD 63.99), including late-offer rejection and receipt idempotency. It **emulates** display/playback callbacks; it is not a live microphone, vision, or frontend rehearsal.

CI runs the backend on Node 22 and 24 and validates the shared catalog separately. See [ACCEPTANCE.md](./ACCEPTANCE.md) for the criterion-by-criterion review.

## Start the local service

```sh
# Create the private bridge token once. This fails if .env already exists.
node -e "require('node:fs').writeFileSync('.env','AGENT_API_TOKEN='+require('node:crypto').randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'})"
npm run dev
```

The default URL is `http://127.0.0.1:4318`. Configure `HOST`, `PORT`, and comma-separated `ALLOWED_ORIGINS` when needed. Default origins are localhost:3000, localhost:5173, and 127.0.0.1:5173. Keep `AGENT_API_TOKEN` in the trusted application/voice server; never put it in browser environment variables or model context.

Sessions are held in one process, expire after two hours, and disappear on restart. Reset changes the epoch and clears shopper context and assets. Explicit end deletes the session. Reconnection receives the latest snapshot, never an action replay.

## Integration

- [INTEGRATION.md](./INTEGRATION.md): public contract, modalities, lifecycle, and approval.
- [src/integration-client.ts](./src/integration-client.ts): client for `/v1/integration`.
- [API.md](./API.md): legacy/internal `/v1` routes used by provider-neutral agent tools.
- [src/along-catalog.ts](./src/along-catalog.ts): lossless shared-catalog adapter and compatibility validation.
- [src/store.ts](./src/store.ts): atomic state transitions, display order, cancellation, summaries, and receipts.
- [../catalog/README.md](../catalog/README.md): data provenance, sources, known links, media limits, and fixture generation.

The canonical public product, offer, and evidence records preserve the shared catalog's fields without flattening review metrics or confusing research reference prices with payable totals. Legacy profiles in `catalog.ts`, `voice-catalog.ts`, and `team-catalog.ts` remain only for isolated historical regression tests; the HTTP server and default store use Along's shared profile.

## Scope and assumptions

- Three scenarios: `cafe-dictation`, `work-gym`, and `warm-room`.
- One product/variant, one seller, and **one bundle per order**. Shared shipping and hardware fixtures support quantity one; other quantities are explicitly rejected.
- Frozen clock: **24 October 2026, 10:00, Asia/Singapore**. Delivery is synthetic to `DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)`.
- USD integer cents only in the prepared catalog. Shipping, hardware, and explicit fixture tax are included exactly once. Unknown essentials block approval.
- Photos and bounded input history are memory-only. Raw audio is not stored. Maximum five PNG/JPEG/WebP images per session, 2 MiB each, with format/structure and dimension limits.
- Links resolve through a local curated allowlist; no arbitrary URL is fetched. External content is evidence, never an instruction or approval.
- Missing videos remain explicit. No paid provider, retailer checkout, real order, payment, or messaging service is called.

The trusted bridge must report actual final shopper recognition and real playback completion. The backend checks those attestations but cannot independently establish that a human heard audio. Live provider/UI proof remains with the frontend and voice integration workstreams.
