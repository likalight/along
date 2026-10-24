# Internal HTTP API — legacy names / agent tools

For the latest agreed multimodal contract, use [INTEGRATION.md](./INTEGRATION.md) and `/v1/integration`. This document describes the internal `/v1` representation, still used by `createShoppingTools`.

Base `http://127.0.0.1:4318`. JSON UTF-8, request limit 32 KiB. All money is integer minor units with explicit currency (USD in the default profile; no conversion). Product evidence distinguishes team-supplied research snapshots from synthetic fixtures. Every checkout offer is synthetic. The shared TypeScript definitions are `src/contracts.ts`; `src/client.ts` works from a frontend or trusted server without any framework dependency.

## Roles and ownership

**Browser:** create session; keep returned `accessToken` in memory (or sessionStorage if refresh continuity is required); read snapshot/catalog; start/cancel turns; acknowledge rendered summary and real playback; reset through presenter control. The current agreement supports optional typed input; see INTEGRATION.md for the deliberate text confirmation path. Do not use a purchase button.

**AI/voice server:** receive the session capability from the frontend, keep `AGENT_API_TOKEN` server-side, interpret speech, propose structured state, request a summary, speak its exact `spokenText`, classify final shopper speech and forward approval observations. Never expose the agent token to browser JS, model context, product data or URL parameters.

**Backend:** validates IDs, constraints and complete prices; owns accepted state, summary and simulated order. An LLM tool call by itself is not approval. Keep `/approval` out of the model's freely callable tools: invoke it only in the trusted voice ingestion layer after the final-recognition checks.

All session routes need `Authorization: Bearer <accessToken>`. `/proposals`, `/summaries` and `/approval` additionally need `X-Agent-Token: <server secret>`. Creation returns the session token once. No secrets in query strings.

## Routes

| Method/path                   | Body/result                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/health`                 | Service, contract version, purchase mode and storage mode                                                                             |
| GET `/v1/catalog`             | `products`, `offers`, `evidence`, currency, proxy notice                                                                              |
| GET `/v1/scenarios`           | Scenario fixtures for the configured catalog profile                                                                                  |
| GET `/v1/prepared-images`     | Labelled synthetic style-reference assets                                                                                             |
| POST `/v1/catalog/search`     | `{constraints, quantity?:1, excludedProductIds?:[]}` → eligible/ineligible quotes with explicit reasons                               |
| POST `/v1/sessions`           | `{scenarioId?:"cafe-dictation"}` → `{session, accessToken}`                                                                           |
| GET `/v1/sessions/:id`        | `{session}`; reconnect baseline                                                                                                       |
| GET `/v1/sessions/:id/events` | SSE `data: {type:"session.snapshot", session}`; immediate full snapshot, then updates. Expiration emits `session.expired` and closes. |
| POST `.../turns`              | `{expectedRevision}` → `{session}` with server-issued `turn.id`                                                                       |
| POST `.../cancel`             | `{turnId}` → `{session}`; stop/barge-in invalidates summary/approval                                                                  |
| POST `.../reset`              | `{expectedRevision}` → cleared `{session}` with incremented epoch and revision                                                        |
| POST `.../proposals`          | `Proposal` → `{session, offers}` (all checked quotes, including ineligible reasons)                                                   |
| POST `.../summaries`          | `{expectedRevision,turnId}` → `{session}` with exact summary text/hash                                                                |
| POST `.../presentation`       | `{summaryId,turnId,textHash,event}` → `{session}`; event: displayed, playback_started, playback_completed, playback_interrupted       |
| POST `.../approval`           | `VoiceObservation` → `{session,receipt}` only on valid explicit approval                                                              |

## Normal sequence

1. Browser makes `POST /v1/sessions`; subscribe to events with **fetch streaming**, not EventSource query-string tokens. `ConciergeClient.events()` handles this.
2. At actual shopper speech start, call `/turns` with current session revision. Stop previous TTS immediately on the client. A new turn supersedes old work; the AI server must abort old inference and TTS jobs too. Old proposals are rejected even if their HTTP calls arrive later.
3. AI receives the current snapshot and catalog, and proposes **IDs**, never replacement prices/reviews:

```json
{
  "expectedRevision": 1,
  "turnId": "<server-issued turn>",
  "needs": ["Microphone for cafe dictation"],
  "constraints": {
    "category": "audio-accessories",
    "currency": "USD",
    "budgetMinor": 12000,
    "deliveryWithinDays": 1
  },
  "shortlist": ["MIC-020"],
  "selection": { "offerId": "MIC-020-express", "quantity": 1 },
  "evidenceIds": ["ev-MIC-020-spec", "ev-demo-seller-express"]
}
```

Proposal fields are optional, but supplied arrays/constraints are **whole replacements**, except constraints which merge with existing hard requirements. Merge retained preferences and constraints from the accepted snapshot before proposing changes. Empty arrays clear a list; `selection:null` clears a choice. Null does not mean zero/unknown for other fields. Unknown request fields are rejected. No arbitrary model-supplied money, review or summary payload is accepted.

4. Frontend renders the returned snapshot. Preserve `view.cards` and `shortlist` order. When a proposal includes `view`, its ordered cards become the shortlist; contradictory arrays are rejected. AI resolves “second one” from this accepted array at that revision, then sends a concrete product/offer ID; never resolve against an older streamed draft.
5. AI requests `/summaries`. Backend computes total and creates `summary.id`, `summary.revision`, `spokenText`, and `textHash`. **Speak this exact text**; don't paraphrase or omit conditions. The frontend displays the same summary and quote.
6. Browser sends `displayed` after render, `playback_started` at audible playback start, `playback_completed` only after actual audio finishes. Include summary ID, its `responseTurnId`, and textHash in every event. These events are scoped to the immutable summary rather than a global revision so render/audio acknowledgments can arrive independently. Interruption sends `playback_interrupted` or `/cancel`; an interrupted summary must be regenerated and fully replayed.
7. Only after both display and complete playback does the backend produce `summary.approvalNonce`. At the **next shopper speech start**, `/turns` creates a fresh turn with `approvalWindow`. This prevents speech that started during the summary from approving it.
8. Trusted voice ingestion posts:

```json
{
  "expectedRevision": 8,
  "turnId": "<new shopper turn>",
  "summaryId": "<current summary>",
  "approvalNonce": "<turn.approvalWindow.nonce>",
  "transcript": "Confirm this simulated purchase.",
  "final": true,
  "confidence": 0.99,
  "source": "shopper",
  "echoDetected": false
}
```

Use actual final recognition confidence; if the provider doesn't supply a calibrated confidence, do not invent 0.99. The team must agree an alternative verified-speech protocol before relaxing this gate. Allowed normalized phrases: `confirm this simulated purchase`, `yes confirm this simulated purchase`, `confirm purchase`, `yes confirm purchase`, `yes buy it`. Plain `yes` and `looks good` are intentionally rejected. Localized approval phrases need explicit additions and rehearsal.

9. Show the stable `SIM-...` receipt and its **SIMULATED — no payment or real order** label. Concurrent/retried confirmation for this same summary+turn+nonce returns the same receipt. After a receipt, start another demo via reset. Stop/decline routes through `/cancel`, without any receipt.

## Revisions and failure handling

- Every accepted state or lifecycle update increments `session.revision`; summary keeps the revision at which its material purchase details were created.
- Apply snapshots only if their revision is newer for that session. Cancel and reset invalidate queued old work; no silent replay.
- On 409 `STALE_REVISION`, refetch the snapshot and reevaluate the current shopper request. **Never automatically replay a purchase or an old proposal.**
- A changed budget/deadline can make a previous selection invalid: new constraints are retained, selection and approval are cleared. An explicitly proposed invalid selection is rejected atomically without modifying accepted state.
- `requiredSpecifications` uses exact equality. Unknown specifications fail hard constraints. Category constraints are exact slugs in the selected profile (`bags`, `bedding`, `audio-accessories` in the current default).
- Shipping and other fees are per order; price is per item. All material fees must be known. Search results include rejected offers so AI can explain the cheapest-versus-eligible tradeoff, bounded to this catalog.
- Money, offer, variant, quantity, delivery/conditions and uncertainties come only from catalog-backed summaries. Product evidence and seller evidence retain separate associations and proxy labels.
- Raw audio/images/transcripts are not stored by this service. The upstream voice layer must follow the same retention rule.
- Error envelope: `{ "error": { "code": "SELECTION_CONFLICT", "message": "...", "details": [...] } }`. Common statuses: 401 invalid session token; 403 missing agent privilege/origin denied; 409 stale revision/turn/summary; 422 invalid or conflicting data; 410 expired session.
- On reconnect fetch a fresh snapshot and recap by voice. Never resume an interrupted summary as approved. On process restart create a new session and say that the previous demo session ended.

## Integration status

These are implemented contracts, but team stack/voice-provider agreement is pending. The backend does not claim that speech confidence, echo detection, physical playback or frontend rendering can be verified solely from HTTP. The live integration must wire those signals faithfully and rehearse barge-in and network recovery before the demo.

## Provider-neutral AI tool adapter

The voice/AI server may import `createShoppingTools` from `src/agent-tools.ts`. Pass a server-configured `ConciergeClient` and the accepted snapshot returned by `/turns`. Register `tools.definitions` in your provider's tool format and route calls to `tools.execute(name, parsedArguments)`. The adapter supplies the server-issued turn ID and revision, respects cancellation/reset, and excludes approval nonces from model-visible state.

```ts
const client = new ConciergeClient(backendUrl, {
  sessionId,
  accessToken,
  agentToken: process.env.AGENT_API_TOKEN,
});
const currentTurn = await client.snapshot(); // must already be the new active shopper turn
const tools = createShoppingTools(client, currentTurn);
const result = await tools.execute(toolCall.name, parsedArguments);
```

Available tools: `get_shopping_state`, `search_current_offers`, `propose_shopping_state`, `prepare_purchase_summary`. Schemas are ordinary provider-neutral JSON Schema; adapt to your SDK's schema subset. Do not blindly retry stale mutation tools; read current state and reconsider the shopper's request. Create a fresh adapter for every new shopper turn. Do not register `client.approve` as a tool. The trusted voice ingestion path alone receives the approval capability after display/playback completion.

## Guided narrowing and evidence UI

`Proposal.view` is a complete replacement `ShoppingView`: stage, focusProductId, ordered cards, evidenceIds and activeVideoId. Cards contain productId, role, optional rank expressed as null or 1–3, reason, compromise and evidence IDs belonging to that product. Stages are solution-types, priorities, shortlist, evidence and offers. Roles are best-value, best-quality, lowest-cost-suitable, close-match and discovery. These labels are contextual recommendations, never verified awards. Frontend keeps its own responsive grid layout, but preserves the accepted order so “second one” remains meaningful. The model must ask about ambiguous positional references rather than guess the physical layout.

`Product.buyerSignals` distinguishes ratingCount, writtenReviewCount and purchaseCount. Unknown values are null, never zero or fabricated. `videos` contains only curated IDs/URLs; the current catalog has none, so hide that affordance or state it is unavailable. Pause assistant audio and ignore video audio as shopper approval. Never invent a video ID.

`Proposal.destination` changes the session's displayed destination and invalidates any previous purchase summary. It is included in exact spoken summary and receipt. Current offers apply only to the fictional demo service area; changing this label does not verify real address serviceability. Do not collect a real home address for this simulation.

## Catalog profile

The active default is `teamProfile`: 12 audio configurations, six bags and six bedsheet sets in USD, per updated issue #2. See INTEGRATION.md for compatibility fields and frozen scenario clock. `voiceProfile` (lighting/audio) and `nonTechProfile` (SGD) are legacy regression fixtures only. They are not the deployed default.
