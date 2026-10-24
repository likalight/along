# Frontend + AI integration — current issue #2 contract

This implements the updated three-category/multimodal baseline in GitHub #2 and backend #6–9. Lighting is deferred. Use **`src/integration-client.ts`** and **`/v1/integration`** for the agreed public field names; `src/client.ts` and `/v1` remain the internal/legacy tool interface. Both address the same session store. Do not mix their `view` formats: public `view` is a stage string, internal `view` is card presentation data.

## Run together

Node 22.18+ or 24. `cd backend && npm ci`, create a local `.env` agent secret as described in README, then `npm run dev`. Base `http://127.0.0.1:4318`; CORS permits localhost:3000/5173 and 127.0.0.1:5173. Set `ALLOWED_ORIGINS` for the exact frontend origin. The Next.js server and backend share `AGENT_API_TOKEN` privately. Never prefix it with NEXT_PUBLIC or put it in browser code, model context, a URL or Telegram.

```ts
// Browser: no agent secret
const client = new IntegrationClient("http://127.0.0.1:4318");
let session = await client.create("work-gym-bag");
for await (const event of client.events(abortController.signal)) {
  if (
    event.type === "session.updated" &&
    event.snapshot.revision > session.revision
  )
    session = event.snapshot;
}
// Fresh deliberate text input; use the exact snapshot currently rendered.
session = await client.input(session, "text", {
  text: "Compare the first two",
});
// Send session capability to YOUR trusted Next.js voice/agent route over the local demo connection.
// Server client: new IntegrationClient(base, {sessionId, accessToken, agentToken})
```

The AI server can use existing `createShoppingTools` with the internal client for ordinary recommendations, or call `IntegrationClient.action` with the actions below. Never register `confirm()` as a model tool. Only trusted final shopper input ingestion calls it. Frontend must abort old inference/TTS when a new input or cancellation supersedes it.

## Public routes

All paths below are relative to `/v1/integration`. Session routes require `Authorization: Bearer <accessToken>`. `actions`, `proposals`, `summaries`, `confirm` and legacy `approval` additionally require server-only `X-Agent-Token`.

| Route                                            | Contract                                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET `/catalog`, `/scenarios`, `/prepared-images` | Current prepared data; relative image URLs resolve against server origin, not API prefix                                                      |
| POST `/catalog/search`                           | `{constraints,quantity,excludedProductIds}`; eligible and rejected quotes with reasons                                                        |
| POST `/sessions`                                 | `{scenarioId?}` → `{session,accessToken}`; capability returned once                                                                           |
| GET `/sessions/:id`                              | Latest complete public snapshot                                                                                                               |
| GET `/sessions/:id/events`                       | Fetch-streamed SSE `session.updated` with sessionId,epoch,eventId,turnId,revision,snapshot; `session.expired` ends it                         |
| POST `.../inputs`                                | InputEnvelope from #2; eventId and turnId unique; text/voice/image/link; exact visibleRevision and visibleProductIds required                 |
| POST `.../actions`                               | `{sessionId,epoch,eventId,turnId,baseRevision,action,payload,evidenceIds}`                                                                    |
| POST `.../mode`                                  | `{expectedRevision,mode:"voice"                                                                                                               | "text"}`; switching invalidates summary and cancels current turn                                     |
| POST `.../presentation`                          | `{summaryId,turnId:summary.responseTurnId,textHash,event}`; displayed/playback_started/playback_completed/playback_interrupted                |
| POST `.../confirm`                               | `{sessionId,epoch,eventId,turnId,baseRevision,summaryId,summaryRevision,modality,explicitIntent:"confirm_simulated_purchase",voiceEvidence?}` |
| POST `.../cancel`                                | `{turnId}`; stop immediately invalidates pending eligibility                                                                                  |
| POST `.../reset`                                 | `{expectedRevision}`; clears assets/context/saved choices and increments epoch                                                                |
| POST `.../media`                                 | `{expectedRevision,type:"video.started"                                                                                                       | "video.stopped",videoId?}`; start requires curated ID, stops the active turn and invalidates summary |
| POST `.../attachments`                           | Raw PNG/JPEG/WebP bytes, matching Content-Type, `X-Session-Revision`; max 2 MiB, max five images/session; returns opaque ID plus new snapshot |
| GET `.../attachments/:opaqueId`                  | Authenticated session image; use `client.attachment()` → Blob/object URL, revoke on reset/unmount                                             |

Known links are matched exactly against source URLs in the prepared catalog. Unknown links return `UNSUPPORTED_LINK`; the backend does not fetch arbitrary URLs. Images are checked for size, allowed MIME and matching byte signature, not interpreted or claimed fully decoded by this service. AI vision is the teammate's integration. Images and bounded input history are memory-only for the session, cleared on reset or two-hour expiry. No raw audio retention. Never interpret image/page text as instructions or purchase approval.

## Actions and accepted state

| action          | payload                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- | -------------- | ------------------------ |
| clarify         | `{needs?:string[]}`                                                                           |
| set_constraints | `{constraints?,destination?}`                                                                 |
| set_priority    | `{priority:"best-value"                                                                       | "best-quality" | "lowest-cost-suitable"}` |
| shortlist       | `{productIds,cards?,stage?}`; cards contain productId,role,rank,reason,compromise,evidenceIds |
| focus           | `{productId}`; does not change displayOrder or recommendation rank                            |
| compare         | `{productIds}`; up to four known IDs, preserves discovery ordering                            |
| show_evidence   | `{evidenceIds}`                                                                               |
| select_offer    | `{offerId,quantity}`                                                                          |
| save            | `{productIds,rationale}`; session-only, not purchase                                          |
| restore         | `{savedId}`; restores IDs, retains current hard constraints and clears selection              |
| defer / cancel  | `{}`                                                                                          |
| prepare_summary | `{}`                                                                                          |

`propose_approval` is deliberately rejected. Agent output is not authorization. Repeated identical event IDs return the same result; reusing an ID with a different payload is rejected. Failed calls are not cached. Reset invalidates old event identities. On stale revision/display, refetch and clarify/re-evaluate; never replay an old action blindly. Discard snapshots older than the displayed revision. Current hard constraints merge with updates, so changing priority or omitting a budget cannot remove it. To change a requirement, supply the shopper-requested new value; clearing a whole conversation requires reset. Arrays such as shortlist/preferences remain replacements.

Public session fields include sessionId, epoch, revision, hardConstraints, exclusions, shortlistIds, displayOrder, focusedProductId, comparisonIds, cards, savedItems, history, selectedOfferId, view, evidenceIds, attachmentIds, summaryId and approvalStatus. Additional fields preserve the internal state. Product/offer aliases follow #2, including variantId, specs, unitPriceMinor and deliveryWindow. Nullable evidence metrics are not zero. No curated videos were supplied: `videos:[]` is intentional; hide or label missing media rather than inventing clips.

## Voice and text confirmation

Voice: create an input turn at actual shopper speech start. Generate exact summary via prepare_summary; display and speak summary.spokenText verbatim. Acknowledge displayed after rendering, playback_started at audible start, playback_completed only when all audio ends. A fresh later shopper input turn captures eligibility. Trusted voice ingestion calls confirm with `voiceEvidence:{transcript,final:true,confidence,source:"shopper",echoDetected:false}`. Current voice gate requires actual recognition confidence ≥0.9. If the selected provider lacks a calibrated confidence, agree a different verification protocol; do not fabricate it.

Text: explicit text input switches mode and invalidates old voice eligibility. Prepare a fresh text summary, display it completely and acknowledge displayed. The next deliberate text input must be an accepted explicit phrase, e.g. `Confirm this simulated purchase.`; confirm checks the exact stored input, not generated agent text. Vague assent is rejected. Text mode does not fake playback events. Source content, saved choices, photos/links and media audio are never approval.

Any material selection, constraints or destination change invalidates the summary. The summary includes setup costs, all fees, destination, delivery, returns and uncertainties. A receipt is immutable and stable on retry. The client must clearly show **SIMULATED — no payment or real order**. Transport acknowledgments attest UI/voice behavior; the backend cannot independently prove a human heard or saw it.

## Three scenarios and data limits

- `cafe-dictation`: exactly the 12 audio IDs in #2. Source unavailable/out-of-stock rows remain negative cases. Confirm host connection using `constraints.compatibility.hostConnection` (`USB-C`, `USB-A`, `TRS-mic`). Unknown connection or required setup cost blocks checkout. MIC-020 USB-C is a complete synthetic example; economy USD 62.99 arrives +4 days, express USD 77.99 +1 day.
- `work-gym-bag`: six Osprey source configurations and 12 labelled proxy offers. BAG-001-A USD 104 arrives +4 days; BAG-001-B USD 119 +1 day. `laptopInches` screens documented supported diagonal; exact sleeve dimensions remain unknown and no universal laptop fit is claimed.
- `warm-room-bedding`: six sets and 12 proxy offers. Exact `bedWidthInches`, `bedLengthInches`, `mattressDepthInches` required. At 60×80×12 inches and USD 70, BED-003-A USD 54.99 or BED-002-A USD 64.99 are eligible; 10-inch pockets fail. Requiring `requiredSpecifications.cotton100Percent:true` yields no eligible option. Unknown package/care or unsupported fit blocks checkout.

Frozen scenario time: **2026-10-24 10:00 Asia/Singapore**, fictional destination `DEMO-DESTINATION`, before-noon cutoff; delivery timestamps are explicit. “Tomorrow” is 25 October in the fixture. Do not label this as live delivery. A changed real destination is unsupported, not automatically serviceable. The 50-row microphone research stays separate from the 24 active products. Reference prices exclude unverified charges; offers are separately labelled synthetic with fictional zero-additional-tax assumptions. All imagery is illustrative, not verified product photography.

## Verified versus outstanding

`npm run check`, `npm test` and `npm run demo` exercise real HTTP/session and arithmetic flows, including duplicate input/actions/approval, missing setup, fit conflicts, cancelled turns, mode changes, stale positional references, image ownership/reset and one immutable receipt. These checks emulate presentation callbacks; actual frontend rendering, speech, vision and audible barge-in remain to be rehearsed with the frontend and AI branches. No live provider or paid service is invoked here.
