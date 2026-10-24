# Product canvas — issue #4

Implements the fixture-based product canvas from [issue #4](https://github.com/likalight/along/issues/4), against [contract v1](https://github.com/likalight/along/issues/2). The session shell from #3 supplies the Next.js application, dependency versions, microphone, composer, attachments, speech provider and transport. This work owns `components/canvas`, `lib/canvas`, `public/canvas`, the isolated `/canvas-preview` route, and `/api/canvas` rehearsal adapter. It adds no dependency or second gallery/WebGL system.

## Try it

Run `npm ci`, then `npm run dev`. Open `/canvas-preview`. Its optional typed composer and category switches are rehearsal controls; the production microphone and transport stay with #3. A pale canvas and compact blue orb anchor the stage.

- Audio: `explore options` → `choose headset` (or `clip-on`, `desktop`) → `choose value`, `choose quality`, or `choose cost-effective` → up to three products. A USD 100 hard budget still applies to quality-first. Clip-on has two eligible seeds and explains the missing third; the out-of-stock DJI kit is excluded.
- Bags: `explore options` → two close matches plus three discoveries → `I prefer the softer shape` → three closer alternatives. `Actually navy colour` narrows colour. Budget, reference and other preferences persist.
- Sheets: `mattress depth 40 cm` → `explore options` → one eligible set. `Dimensions 180 x 200` produces an explicit empty result rather than a made-up match.
- Any shortlist: `focus the second`, `compare the first two`, `reviews for the third`, `save the first`, `remove the first`, `restore shortlist`, `show saved choices`, `offers for the first`.
- Evidence: `play the first video` uses the focused product, with captions. `stop video` cancels playback. Native controls and Stop are also available. An original local placement explainer is playable for audio; missing bag media and failed requests remain explicit.
- Offers: `I need it tomorrow` flags USD 84 arriving 27 October versus USD 99 arriving 25 October for BAG-001, using the fixed scenario date of 24 October 2026 in Singapore. The third seller has unknown fees and shipping; its total remains incomplete. `choose faster offer` considers the offer without creating an order.

This bounded grammar is a deterministic rehearsal, not the live interpretation layer. The full application routes voice and text through the same backend acceptance path. These commands are not extracted from evidence or media content.

## Shell integration

`ProductCanvas` is a controlled client component. It receives `snapshot`, catalog/evidence/offer `data`, `onIntent`, `onMediaEvent`, `busy`, `interpretingSpatialReference`, optional `mediaRequest` and the current `turnId`. It never mutates session state, calculates approval eligibility, creates receipts or handles microphone capture.

`Snapshot` is a structural contract-v1 session projection plus a `canvas` presentation object containing accepted heading/message, recommendation annotations, chosen solution/priority, and optional reference. These presentation fields must be derived server-side from accepted state. The shell's generic `AUDIO-01` placeholders are deliberately not silently mapped onto researched `MIC-*` IDs. Catalog integration must supply actual accepted identities and their annotations.

```tsx
<ProductCanvas
  snapshot={acceptedCanvasSnapshot}
  data={acceptedCatalogProjection}
  busy={status === "thinking"}
  interpretingSpatialReference={resolvingReference}
  turnId={currentTurnId}
  onIntent={({ text }) => controller.send(text, currentModality)}
  onMediaEvent={handleTrustedMediaLifecycle}
  onPlaybackRequest={pauseAssistantBeforeVideo}
  mediaRequest={acceptedMediaRequest}
/>
```

Keep the shell's generation/current-turn cancellation guard. `acceptEvent(current, event, expectedTurnId)` additionally rejects non-advancing revisions, wrong sessions/epochs, inconsistent event/snapshot revisions and duplicate display IDs. A new epoch requires an explicit reconnect/reset snapshot. The rehearsal route atomically checks base revision and visible order, deduplicates event IDs, and returns the current snapshot on conflicts. It uses an expiring process-local session store, not production persistence.

Pass the accepted `displayOrder` and `visibleRevision` with shopper input. Number labels refer to that order, not DOM position, medal, pointer hover or animation. Cards use product IDs as React keys. Focus is a blue outline and “In focus” text; gold/silver/bronze retain textual rank labels. Initial bag discoveries do not receive contextual medal ranks. Saved rationale and IDs last for the current session only.

For voice-requested playback, supply `{requestId, evidenceId, action:'play'}` only after the backend accepts the evidence view. `onPlaybackRequest` fires synchronously with phase `preparing` before the player mounts: stop narration and suspend recognition/capture at this boundary, so media audio cannot become a shopper command or approval. `video.started` fires only when the current player actually starts playing. A failed preparation reports phase `failed` without inventing playback. `video.stopped` carries playback/session/epoch/turn/revision identity, reason and an authored takeaway for normal completion/stop. Validate identity, then narrate the takeaway and resume capture under shell control. Navigation, new busy turns and unmount cancel the previous playback. Failures carry no fabricated takeaway. The component displays the takeaway; the parent owns speech. For an accepted typed/voice Stop after cancellation advances revision, pass a takeaway only for the same evidence that actually played; failed or unplayed media has none. Never call these lifecycle handlers with transcripts from the video.

In summary/receipt views, all positional motion remains off. Their order, approval and receipt UI belongs to #5/#7; this canvas does not implement checkout. Offer totals are display projections only: complete numeric fields are summed in minor units, unknown fields never become zero, and extra required hardware remains explicitly unpriced.

## Visual specification preserved from Along / Still / Gather / Balance

Along contributes the pale neutral background, persistent blue voice anchor, generous spacing, soft shadows and image-first tiles. Still contributes the stable conversational anchor; Gather contributes the adaptive object stage; Balance contributes explicit reasons and compromises. This is the design reference rather than a dependency on a localhost prototype.

During discovery only, new keyed tiles translate upward with staggered entry and a restrained Y-axis turn, then settle. There is no perpetual orbit or timed stage advancement. Interpreting a reference, waiting for acceptance, comparing, reading evidence, viewing offers, summary or receipt forces stable transforms and opacity immediately, including interrupting an entry in progress. Hover and keyboard focus have no incidental movement to pause. Desktop discovery has airy offsets; mobile uses a horizontally scrollable, readable card strip and a full-width focus sheet. Evidence pairs a fixed product with sources and video on desktop and stacks on mobile. Reduced motion removes transforms and transition duration while keeping number, focus, rank and meaning.

## Fixture provenance and limits

24 active products: the 12 agreed `MIC-*` configurations, six authored bags and six authored sheet sets. Audio identity/specifications/reference prices and nullable review aggregates come from the provided 24 October microphone research seed. These are captured snapshots, not fresh retailer queries. Product family/variant scope is stated beside metrics; absent stars, rating counts, written-review counts, purchase counts and periods remain unavailable. MIC-047's 43 written reviews are separate from its unknown rating count and stars. Authored recommendation order is a relevance hypothesis, independent of customer stars. No synthetic fit score is shown as a customer metric.

Bag/textile specifications, illustrations, seller records, fulfillment, destination and video are proxy fixtures. Images are original schematic SVGs rather than exact product photography; the audio clip is an original captioned placement explainer, not an external review or measured product test. `public/canvas/README.md` records media provenance. Bedsheet claims make no cooling/health guarantee. Seller conditions/evidence are rendered separately from product reviews.

Live catalog/constraint/offer acceptance (#6/#7), review/video retrieval (#11/#12), speech-provider routing and real-device echo rehearsal remain integration work. This fixture route cannot authorize or perform purchases. Do not treat its client intent handling or authored ranking as authoritative production policy.

The merged shared catalog (`catalog/`, PR #16) uses category values `audio-accessories` / `everyday-bags` / `bedsheet-sets`, structured JSON specs, `referencePrice.amountMinor`, separate buyer metrics, timestamped delivery windows, explicit tax and setup hardware. Its synthetic bags, variants, prices and destination differ from this isolated canvas rehearsal, even where IDs coincide. Replace the entire fixture projection when connecting it; never join these two fixture sets by ID and silently mix identities. Render accepted tax, hardware and total breakdowns without double-counting hardware already included in `otherFeesMinor`.

The merged backend (`backend/`, PR #15) publishes `backend/INTEGRATION.md` and `src/integration-client.ts`. Use `/v1/integration` and its public string-valued stage, rather than the legacy `/v1` presentation view. It supplies accepted SSE snapshots and curated-ID media lifecycle endpoints. Catalog image paths resolve against the backend origin. Its server agent token stays server-side; session capabilities must not enter page URLs, model context or this fixture data. These observed interfaces inform the handoff; this PR does not claim they are connected.

## Verification

`npm run typecheck`; `npm test -- tests/canvas/engine.test.ts`; `npm run test:canvas`; `npm run build`.

Browser checks cover distinct audio stages, preserved hard budgets/reference, bag narrowing, stable comparison coordinates, identity after remove/restore, session saves, nullable metrics, captioned playback and Stop, missing/failed media, deadline-conflicting same-variant offers, incomplete totals, keyboard use, mobile width and reduced motion. The unit suite also checks stale-session/epoch/turn/revision rejection and idempotency. These checks establish deterministic fixture behavior, not live speech quality or seller availability.
