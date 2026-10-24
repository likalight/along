# Along: combined integration handoff

This branch combines backend #6–9 (including main’s acceptance hardening), the canonical catalog, the AI harness, and the frontend session shell + product canvas. The actual shopper UI completes a **production-build text journey**; live AI/provider voice remains pending.

## Run

Node 22.18+ (tested on Node 24).

```sh
npm ci
npm run build
npm run start -w @along/shopper -- --port 4322
# Open http://127.0.0.1:4322 for the integrated shopper UI.
# Optional diagnostic harness, in another terminal:
npm run start -w @coupang/web -- --hostname 127.0.0.1 --port 4321
# HTTP rehearsal against that harness:
node scripts/rehearse-integration.mjs
```

For edits: `npm run build` once, then `npm run dev -- --port 4320` (or pass flags directly to the web workspace). Backend/agent changes require rebuilding their workspace outputs. Do not run next dev and next build against the same `.next` directory concurrently.

## Ownership and source of truth

- `catalog/data/catalog.json` is the canonical 24-product/48-offer dataset. Run the catalog package's build after editing its source, then `npm run sync:catalog` to refresh generated TS modules and public SVGs. Generated modules are checked in for reproducibility; never edit them manually.
- `backend/src/along-catalog.ts` normalizes the canonical dataset without replacing facts or prices. Required audio hardware already included in `otherFeesMinor` is counted once. Quantity is bounded to one fixture bundle. Unknown facts remain unknown.
- `packages/agent/src/session/AuthoritativeSessionStore.ts` is the integration adapter. It uses the actual backend store; `FixtureSessionStore` remains only for the teammate's isolated harness tests.
- `apps/shopper/lib/integration/runtime.ts` and the diagnostic `apps/web/src/server/runtime.ts` own separate process-local sessions. Next.js endpoints call the adapter directly, so **no separate backend process or agent secret is needed for this Next.js integration**.
- Optional standalone backend on port 4318 also defaults to the canonical catalog. Its `/v1/integration` shape differs from the AI harness's Zod snapshot. Do not mix the two session transports. Original historical fixtures are explicit test profiles only.

## Shopper frontend transport

`apps/shopper` preserves the frontend controller interface: POST `/api/session` with actions `connect`, `input`, `cancel`, `mode`, `presented`, `lifecycle`. Its projection maps canonical IDs, exact quotes and accepted backend state into the product canvas. `/api/attachments` accepts only authenticated, structurally validated PNG/JPEG/WebP bytes up to 2 MiB, an owned prepared illustration, or an allowlisted catalog source URL. Arbitrary URLs are never fetched.

The summary acknowledgment occurs after the summary component mounts, not before its entrance transition. Ordinary draft edits do not cancel an already presented summary; actual interruption does. Browser Speech Recognition/Synthesis is available as a fallback but has not been audibly rehearsed here. Voice purchase confirmation remains disabled until a trusted live voice adapter provides final/confidence/echo/source evidence. Text mode requires a new summary and fresh typed confirmation.

`/canvas-preview`, `/presenter`, and `lib/session/store.ts` retain the original isolated frontend fixtures for development; they are not the integrated shopper state. Historical browser tests against those fixtures are not evidence for the production journey.

## Diagnostic harness endpoints

All responses are JSON. Use same-origin browser fetch with the HttpOnly session cookie set by session creation. Never put tokens in URLs or model prompts.

| Endpoint | Request / behavior |
|---|---|
| POST `/api/session` | `{scenarioId: "cafe_dictation" | "bag_inspiration" | "warm_bedding" | null, preparedAttachmentId?}`. Returns snapshot, summary, receipt, quoted offers; sets session cookie. Scenario selects a narrative, **not assumed consent to a budget/host/bed size**. |
| GET `/api/session?sessionId=…` | Latest authorized snapshot, exact summary, receipt, quoted offers. |
| POST `/api/turn` | `{sessionId,epoch,visibleRevision,visibleProductIds,modality,text,attachmentId?}`. Visible revision/order must be the exact accepted screen. Returns snapshot + speakable narration data; it does **not** currently play audio. |
| POST `/api/action` | Same identity/visible fields + `{action,payload}`. Allowed deliberate UI actions: focus, compare, save, restore, select_offer, prepare_summary, cancel. Selection payload `{offerId}`; quantity one. Save/restore use `{productId}`; save optionally `{rationale}`. |
| POST `/api/presentation` | `{sessionId,summaryId,turnId:summary.responseTurnId,textHash:summary.textHash,event:"displayed"}` **after rendering the full exact summary**. Returns a new snapshot/revision. Do not optimistically enable confirmation. |
| POST `/api/lifecycle` | Session/epoch/revision/turn identity plus `turn.cancelled` or `audio.interrupted`. Live audio/video transport remains pending. |
| POST `/api/voice/mint` | Authenticated explicit `not_connected` response. No fabricated live session. |

Summary response includes exact `spokenText`, `textHash`, `responseTurnId`, mode, line items, destination, conditions, uncertainties and status. Render all of it in text mode. Then the shopper must type a **new** `Confirm this simulated purchase` turn. `prepare_summary`, model `propose_approval`, save, a display acknowledgment, and a fixture `summaryFullyPresented` flag cannot purchase.

A changed budget/deadline/compatibility/selection invalidates the summary. Rebuild and re-present it. `receipt.label` explicitly says no payment or real order. Retries after completion cannot create another receipt.

Errors after an accepted input may return the latest snapshot alongside the error. Apply that snapshot before allowing the next turn, so the UI does not remain stuck on an old revision.

## Human rehearsal

1. Open the shopper UI on port 4322 and choose “I’d rather type”.
2. Enter: `I need a backpack for a 14-inch laptop and separate shoes under 150 dollars tomorrow`.
3. Confirm BAG-001-A is USD 104 but disabled as late. BAG-001-B is USD 119 and arrives in one scenario day.
4. Click the eligible offer’s review button to prepare the purchase summary. Wait until presentation is eligible.
5. Enter: `Keep tomorrow but change the budget to 100 dollars`. Summary/selection must disappear; no matching option or receipt.
6. Restore budget to USD 150, still tomorrow. Prepare a fresh summary.
7. Type `Confirm this simulated purchase`. One labelled simulated receipt should appear.
8. In another session, use `I want queen sheets for a 60 by 80 inches bed with a 12 inch mattress under 70 dollars`. BED-003 fits; shallow BED-001 does not. Select BED-003-A, prepare summary, cancel. No receipt.

## Verified versus pending

Verified: optimized Next 16 builds for both apps; 50 backend acceptance checks and all three HTTP purchase rehearsals; 29 frontend checks; 16 agent-harness checks; combined HTTP rehearsal (`scripts/rehearse-integration.mjs`); actual built-in browser bag journey including changed constraints and receipt. The CLI backend demo emulates audio callbacks and explicitly labels that limitation.

Pending integration: actual live model/voice transport, audible summary completion and interruption callbacks, trusted final shopper speech events, uploaded-image vision processing, deployed persistence and multi-instance session routing. Current storage is in-process and expires after two hours; restarting loses sessions. Deterministic parsing is bounded rehearsal logic, not a general-purpose AI. Prepared images are labelled illustrations, never claimed as model recognition. No playable catalog video is available.

Both apps use Next 16.4.3 and React 19.2.6. Dependency audit now reports one high-severity advisory in Zod 3; the suggested fix is a Zod 4 major upgrade. Coordinate the shared contract migration before public deployment.

## Voice-team boundary

Use the authoritative store's `input`/`propose`/`summarize` boundary (or this adapter) for accepted mutations. Use the exact summary identity/hash for display and actual playback_started/completed/interrupted events. Only a later trusted, final, non-echo shopper utterance may enter voice approval. Do not report successful playback when merely queued, and do not accept a model tool call as shopper approval. The standalone backend supports these checks; the Next voice bridge still needs the provider's actual callbacks.
