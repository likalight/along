# Along — conversational shopping integration

This integration branch combines the backend (#6–9), catalog package (#6) and custom agent harness (#10–13). Work is in progress; live voice/provider wiring and the final frontend still require rehearsal.

- `backend/`: authoritative sessions, compatibility/totals, explicit voice/text approval, HTTP/SSE and typed client. Start with `backend/INTEGRATION.md`.
- `catalog/`: teammate's 24-product source-linked catalog and complete synthetic seller fixtures; `catalog/README.md` documents provenance.
- `packages/contract`: shared Zod shapes.
- `packages/agent`: turn orchestration, guided scenario logic and voice adapter. The original fixture store is retained for isolated agent checks; integration will use authoritative backend state.
- `apps/web`: Next.js harness console and API routes, not the final shopper frontend.

All purchases are simulated. No payment/merchant calls. Microphone permissions, real model credentials and audible playback are not proven by fixture checks.

Run package checks using each package README. Combined build/run instructions will be updated after integration verification.
