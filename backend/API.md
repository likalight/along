# Internal HTTP API and agent tools

Use [INTEGRATION.md](./INTEGRATION.md) and `/v1/integration` for the accepted public contract. This document covers the internal `/v1` aliases used by `ConciergeClient` and provider-neutral agent tools. Both interfaces share the same state and validation.

Base URL: `http://127.0.0.1:4318`. JSON bodies are limited to 32 KiB. Session routes require `Authorization: Bearer <accessToken>`. Mutation proposals, summaries, approvals, voice inputs, and audio playback attestations require the server-only `X-Agent-Token`.

## Internal routes

| Route | Request/result |
| --- | --- |
| GET `/health` | Service, contract, purchase, and storage status. |
| GET `/v1/catalog` | Internal aliases plus canonical source records. |
| GET `/v1/scenarios`, `/v1/prepared-images` | Current shared profile and bounded illustrations. |
| POST `/v1/catalog/search` | `{constraints, quantity?, excludedProductIds?}`; eligible/ineligible quotes with conflicts. |
| POST `/v1/sessions` | `{scenarioId?}`; returns session and access token. |
| GET `/v1/sessions/:id` | Latest complete session. |
| GET `.../events` | SSE `session.snapshot`; immediate latest state, then accepted updates. |
| POST `.../turns` | `{expectedRevision}`; legacy server-issued fresh turn. Prefer public input envelopes for new integrations. |
| POST `.../proposals` | `Proposal`; accepted session and checked offers. |
| POST `.../summaries` | `{expectedRevision, turnId}`; exact computed summary. |
| POST `.../presentation` | Exact summary display/playback acknowledgment. Use the client helper. |
| POST `.../approval` | Disabled for the canonical profile; use the public `confirm` envelope. Historical test profiles alone retain this route. |
| POST `.../cancel` | Canonical profile requires `{epoch,eventId,expectedRevision,turnId}`; stop and invalidate eligibility. |
| POST `.../reset` | `{expectedRevision}`; increment epoch and clear shopper data. |
| POST `.../end` | `{expectedRevision}`; delete session/assets. |

The public input/actions/confirm/lifecycle/mode/attachment routes are also available under the internal prefix, with the internal response representation. Do not mix public stage-string `view` with internal card-presentation `view`.

## Proposals and quotes

```json
{
  "expectedRevision": 1,
  "turnId": "<active turn>",
  "needs": ["Microphone for cafe dictation"],
  "constraints": {
    "category": "audio-accessories",
    "currency": "USD",
    "budgetMinor": 16000,
    "deliveryWithinDays": 1,
    "hostConnection": "usb-c"
  },
  "shortlist": ["MIC-044"],
  "selection": { "offerId": "MIC-044-B", "quantity": 1 }
}
```

Supplied arrays replace their corresponding lists. Hard constraints merge with existing requirements, including nested compatibility/specifications. A priority update cannot remove a budget. Invalid explicit selections fail atomically; a later constraint change may clear an existing selection while retaining the new requirement.

The backend validates canonical records and their legacy aliases before checkout. `quote.subtotal`, `shipping`, `otherFees`, `setupCost`, and `tax` are integer minor units. The canonical offer already includes hardware in `otherFeesMinor`; the internal quote separates it into `setupCost` without double counting. Unknown totals remain null. Shared fixtures support **quantity one** only and reject unsupported quantities explicitly.

Canonical categories are `audio-accessories`, `everyday-bags`, and `bedsheet-sets`. The default is `alongProfile`, backed by `catalog/`. Explicit historical profiles used in regression tests are not served by default.

## Agent tools

```ts
const client = new ConciergeClient(backendUrl, {
  sessionId,
  accessToken,
  agentToken: process.env.AGENT_API_TOKEN,
});
const currentTurn = await client.snapshot();
const tools = createShoppingTools(client, currentTurn);
const result = await tools.execute(toolCall.name, parsedArguments);
```

Available model tools:

- `get_shopping_state`
- `search_current_offers`
- `propose_shopping_state`
- `prepare_purchase_summary`

The adapter binds work to the active session epoch and turn. Old reads/mutations fail after cancellation, reset, or a newer turn. Model-visible snapshots omit approval nonces/windows. Catalog, review, image, and page content are untrusted evidence, never authorization. No model tool approves orders.

## Presentation and confirmation

Render the complete exact summary and speak `summary.spokenText` verbatim in voice mode. Report actual display and playback through the trusted integration, including playback identity and current revision guards. Audio generation completion is not playback completion.

Only a fresh shopper turn after complete presentation can approve. Voice observations must be final, confident shopper speech without echo. Typed approval must match the fresh stored text in explicit text mode. Quoted phrases, vague assent, assistant/background/video audio, images, links, stale turns, and interrupted summaries are rejected.

Valid retry/concurrent confirmations return one stable simulated receipt with the complete immutable order. Material changes invalidate eligibility. The approved order is never sent to a payment provider or merchant.

## Failures, retention, and reconnect

Common errors: 401 session authorization; 403 bridge/origin authorization; 409 stale revision/turn/epoch/summary; 422 invalid/conflicting input; 410 expired session. Conflict responses include current state where needed. Re-fetch and re-evaluate stale actions; never automatically replay an approval.

The service retains bounded input history and images only in the current session, for at most two hours. Raw audio is not stored. Reset/end/expiry clear assets. SSE reconnect supplies the latest snapshot without replaying pending actions. Process restart ends sessions.

Live frontend rendering, voice recognition, audible playback, vision, and barge-in still require integration rehearsal. Backend HTTP checks emulate those callbacks; their passing does not establish live provider behavior.
