# Along — conversational shopping integration

This integration branch combines the backend (#6–9), catalog package (#6) and custom agent harness (#10–13). Work is in progress; live voice/provider wiring and the final frontend still require rehearsal.

- `backend/`: authoritative sessions, compatibility/totals, explicit voice/text approval, HTTP/SSE and typed client. Start with [INTEGRATION.md](INTEGRATION.md).
- `catalog/`: teammate's 24-product source-linked catalog and complete synthetic seller fixtures; `catalog/README.md` documents provenance.
- `packages/contract`: shared Zod shapes.
- `packages/agent`: turn orchestration, guided scenario logic and voice adapter. The original fixture store is retained for isolated agent checks; the Next.js runtime now uses authoritative backend state.
- `apps/web`: Next.js harness console and API routes, not the final shopper frontend.

All purchases are simulated. No payment/merchant calls. Microphone permissions, real model credentials and audible playback are not proven by fixture checks.

Run `npm ci && npm run build`, then `npm run start -w @coupang/web -- --port 4321`. See [INTEGRATION.md](INTEGRATION.md) for the verified journey, API boundary, and remaining voice/frontend handoffs.
