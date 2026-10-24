# Conversational Shopping Concierge — Agent Harness

Custom multimodal agent harness for GitHub issues **#10–#13**, aligned to **contract v1** ([#2](https://github.com/likalight/coupangchallenge/issues/2)).

## Architecture

- **`packages/contract`** — Zod schemas for Session, Input, Agent proposals, approval, lifecycle
- **`packages/agent`** — Custom harness (not Deep Agents): `TurnMachine`, `agentLoop`, scenario routers (audio / bags / bedding), fixture catalog + session store, GPT-Live duplex voice adapter (client delegation) with AFK substitute
- **`apps/web`** — Next.js App Router UI + API (`/api/session`, `/api/turn`, `/api/lifecycle`, `/api/voice/mint`)

Voice is full duplex. Typed / image / link turns use the same state machine and still get **spoken** replies.

## Quick start

```bash
npm install
npm run build -w @coupang/contract
npm test -w @coupang/agent
npm run dev -w @coupang/web
```

Optional: set `OPENAI_API_KEY` for live GPT-Live mint intents (WebRTC SDP wiring remains behind the adapter until credentials are confirmed).

## Proposal actions (contract v1)

`clarify` · `set_constraints` · `set_priority` · `shortlist` · `focus` · `compare` · `show_evidence` · `save` · `restore` · `select_offer` · `prepare_summary` · `propose_approval` · `defer` · `cancel`

No `place_order` / receipt tools — backend (#9) owns approval.
