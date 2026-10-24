# Along integration contract v1

The implementation baseline is [issue #2](https://github.com/likalight/along/issues/2). Use `IntegrationClient` and `/v1/integration` for public field names. The internal `/v1` routes and `ConciergeClient` address the same store using legacy aliases.

## Connect

Run the backend as described in [README.md](./README.md). The browser holds only its session capability. The trusted application/voice server also holds `AGENT_API_TOKEN`.

```ts
import { IntegrationClient } from "./src/integration-client.ts";

const client = new IntegrationClient("http://127.0.0.1:4318");
let session = await client.create("work-gym");
session = await client.input(session, "text", { text: "Compare the first two" });

for await (const event of client.events(abortController.signal)) {
  if (event.type === "session.updated" && event.revision > session.revision)
    session = event.snapshot;
}
```

Send the session capability to your trusted application server through your local demo integration. Construct its client with `{ sessionId, accessToken, agentToken }`. Keep the token out of frontend bundles, model context, and URL parameters. Never register `confirm()` as a model tool.

## Routes and trust boundary

Paths below are relative to `/v1/integration`. Every session route requires `Authorization: Bearer <accessToken>`. Actions, proposals, summaries, confirmations, voice input, and audio playback attestations additionally require the trusted bridge's `X-Agent-Token`. A typed input or display acknowledgment alone cannot create a receipt.

| Route | Purpose |
| --- | --- |
| GET `/catalog`, `/scenarios`, `/prepared-images` | Canonical prepared records and illustrative assets. |
| POST `/catalog/search` | `{constraints, quantity?, excludedProductIds?}`; eligible and rejected quotes with conflicts. |
| POST `/sessions` | `{scenarioId?}`; returns the initial session and a capability once. |
| GET `/sessions/:id` | Latest complete snapshot. |
| GET `/sessions/:id/events` | Fetch-streamed accepted snapshots; no queued action replay. |
| POST `.../inputs` | Voice/text/image/link InputEnvelope with epoch, event, turn, base revision, and visible snapshot. |
| POST `.../actions` | Revision-bound AgentProposal. |
| POST `.../mode` | `{expectedRevision, mode}`; voice/text switch cancels the turn and requires a new summary. |
| POST `.../presentation` | Exact summary display/playback acknowledgments; the client supplies current identity guards. |
| POST `.../lifecycle` | Revision-bound audio/video/cancellation lifecycle with playback identity. |
| POST `.../confirm` | Explicit voice/text approval envelope, current summary identity/revision, and fresh shopper input. |
| POST `.../cancel` | `{epoch, eventId, expectedRevision, turnId}`; immediately invalidates eligibility. |
| POST `.../reset` | `{expectedRevision}`; new epoch, cleared context/assets. |
| POST `.../end` | `{expectedRevision}`; delete the session and its assets. |
| POST `.../media` | Video start/stop; only curated video IDs can start. |
| POST `.../attachments` | Raw image bytes with Content-Type and X-Session-Revision. |
| GET `.../attachments/:opaqueId` | Authenticated image from the same session and epoch. |

An accepted display event has `{sessionId, epoch, eventId, turnId, revision, type:"session.updated", snapshot}`. Reconnect starts with the latest snapshot. Ignore older revisions. Expiry/end closes the stream. Slow consumers reconnect instead of accumulating stale events.

## Actions and state

| Action | Payload |
| --- | --- |
| `clarify` | `{needs}` |
| `set_constraints` | `{constraints?, destination?}` |
| `set_priority` | `{priority}`, one of best-value, best-quality, lowest-cost-suitable |
| `shortlist` | `{productIds, cards?, stage?}` |
| `focus` | `{productId}`; preserves accepted order/rank |
| `compare` | `{productIds}`, up to four known products |
| `show_evidence` | `{evidenceIds}` |
| `select_offer` | `{offerId, quantity:1}` |
| `save` | `{productIds, rationale}` |
| `restore` | `{savedId}`; current hard constraints remain |
| `defer` / `cancel` | `{}` |
| `prepare_summary` | `{}` |

`propose_approval` is rejected. Models cannot create receipt/summary stages by setting presentation state. The backend owns those transitions.

Inputs carry the exact `visibleRevision` and `visibleProductIds` from the rendered `displayOrder`. Stale or ambiguous references require clarification. Focus and card presentation do not silently reorder accepted products or recommendation ranks. Saved choices contain IDs and rationale, remain session-scoped, and never imply approval.

Hard-constraint updates merge with accepted requirements. Changing priority does not remove a budget. To revise a requirement, submit the shopper-requested value explicitly. Duplicate event IDs with identical payloads return the same operation result; changed payloads under the same ID are rejected. Cancellation, reset, and newer revisions block stale work atomically.

## Compatibility and money

Use canonical categories `audio-accessories`, `everyday-bags`, and `bedsheet-sets`. Constraints support `budgetMinor`, absolute `deadline`, `productId`, `variantId`, `hostConnection`, `laptopInches`, `minimumCapacityL`, `separateShoeCompartment`, `bagMaxDimensionsCm`, `bedWidthIn`, `bedLengthIn`, `mattressDepthIn`, and `composition`. Relative `deliveryWithinDays` resolves to 18:00 on the corresponding calendar day from the explicit fixture clock. Nested legacy compatibility names are accepted; contradictory flat/nested values fail closed.

The shared catalog validates product/variant/evidence relationships, money, stock, timing, and required hardware. Unknown compatibility is not a match. Missing essential mattress dimensions, package/care details, or setup cost block checkout. No-match returns rejected quotes with explicit constraint conflicts; it does not fabricate a shortlist or relax a budget.

Summary line items separate items, shipping, other fees, required setup, and tax. Required hardware appears exactly once in the total and is listed in the order. The public catalog's `otherFeesMinor` already includes hardware; do not add hardware to that catalog field again. Research reference prices remain non-payable data.

## Display, playback, and approval

Voice flow: start a trusted shopper input turn; prepare the summary; render the complete summary; speak its exact `spokenText`; report playback start and actual completion with the same playback identity. Only a fresh subsequent shopper turn can approve. The trusted bridge supplies final recognition with confidence at least 0.9, `source:"shopper"`, and `echoDetected:false`. Do not invent confidence when a provider lacks it.

Text flow: explicit text mode; prepare and fully display a new summary; accept a fresh deliberate typed phrase such as `Confirm this simulated purchase.`; forward confirmation through the trusted bridge. The stored shopper text must match exactly. Text mode never fakes audio callbacks.

Confirmation binds session epoch, event/turn identity, current summary ID/revision, and presentation mode. Barge-in, typed interruption, mode switch, stopped/changed playback, and any material order change cancel eligibility. Vague assent, partial recognition, quoted phrases, background speech, assistant/video echo, images/links, save/pin, and stop/decline cannot approve.

The lifecycle envelope carries `sessionId, epoch, eventId, turnId, revision, playbackId, summaryId?, type`. Audio completion must match the started playback. Clients should use the provided helpers and stop obsolete TTS/inference immediately when an accepted input supersedes their turn.

A receipt contains the complete immutable accepted order and `simulated:true`. Concurrent valid confirmations return the same receipt. Reset cannot revive old approval. Display **SIMULATED — no payment or real order**. Presentation/recognition callbacks are trusted integration attestations; this service cannot prove what a person saw or heard.

## Attachments, links, and retention

Upload PNG/JPEG/WebP only: maximum 2 MiB each, five per session, dimensions at most 8192 per axis and 16,777,216 pixels. Structural validation rejects malformed data; it does not perform semantic vision. Assets receive opaque server IDs and are available only to that session/epoch. Failed uploads preserve prior valid state. Reset, explicit end, expiry, and process shutdown release session data. No raw audio is retained.

Links map locally to the shared catalog's bounded known-link fixtures. Unknown, local/internal, and unsupported URLs fail without network fetching. Source/media text is untrusted evidence. Images, links, quoted evidence, and media audio never enter the trusted approval path.

## Reproducible scenarios

| Scenario | Anchor and next-day total |
| --- | --- |
| `cafe-dictation` | MIC-044-B: USD 148 including required hardware |
| `work-gym` | BAG-001-B: USD 119 |
| `warm-room` | BED-003-B: USD 63.99 for a 60×80×12-inch mattress |

The clock is **2026-10-24 10:00 Asia/Singapore**. The fictional destination is `DEMO-DESTINATION-01 (fictional service zone; not Singapore stock)`. Tomorrow means 25 October in this fixture. All seller fulfillment and payable offers are synthetic. Missing videos and unknown evidence are explicit.

Run `npm run verify` for deterministic backend proof. Actual browser rendering, speech, vision, and audible barge-in remain separate live integration work under the frontend/voice issues.
