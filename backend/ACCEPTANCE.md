# PR #15 acceptance review

Reviewed against the accepted [contract v1](https://github.com/likalight/along/issues/2) and the current acceptance criteria of issues #6–9 on **24 October 2026**. The catalog work from PR #16 is incorporated into this branch and is the authoritative default data source.

All **29 acceptance criteria** below are covered by deterministic checks: **41 catalog tests**, **50 backend tests**, TypeScript checks, fixture generation, and three real HTTP rehearsals. Presentation and recognition callbacks are emulated in these checks. Live frontend/voice/vision integration is a separate boundary, not claimed by this review.

## Issues resolved

| Issue | Scope | Criteria covered |
| --- | --- | --- |
| [#6](https://github.com/likalight/along/issues/6) | Catalog and attributable evidence | 9/9 |
| [#7](https://github.com/likalight/along/issues/7) | Multimodal session state and cancellation | 8/8 |
| [#8](https://github.com/likalight/along/issues/8) | Compatibility, offers, and complete summaries | 6/6 |
| [#9](https://github.com/likalight/along/issues/9) | Explicit approval and idempotent simulated orders | 6/6 |

The parent PRD (#1), frontend work, live voice work, and end-to-end release rehearsal are not resolved by this backend PR. Issue #2 is already closed by user direction.

## #6 — Catalog and evidence

Primary evidence: [catalog tests](../catalog/test/catalog.test.ts), [independent catalog checks](../catalog/test/acceptance-review.test.ts), [media/link tests](../catalog/test/media.test.ts), and [backend catalog regression tests](./test/catalog-review.test.ts).

| AC | Requirement | Verified behavior |
| --- | --- | --- |
| 1 | 24 active products, exact 12 audio seeds, six bags, six sheets, archive, competing offers | Exact IDs and counts; 48 offers; 50-record microphone archive remains separate. |
| 2 | Join three microphone tables; retain date, USD, price kind, availability, scope, sources, nulls; exact cents | Reordered-source-table test, original-file hash, provenance assertions, exact decimal parsing and invalid-money rejection. Public API preserves canonical fields. |
| 3 | Separate reference prices from payable totals; no FX or Singapore availability claim | Reference-price mutation cannot alter offer eligibility. Payable fixtures are authored independently; USD and fictional service zone are explicit. |
| 4 | Separate authored fit from ratings/measured performance; retain stock negatives | Authored fit has measuredPerformance:false; unavailable/out-of-stock active cases and discontinued archive cases remain. |
| 5 | Bag/bedding dimensions, capacity, weight, materials, compartments, fit, pieces, care; explicit unknowns | Source specifications and dimensional caveats retained. Unknown laptop fit and essential bedding details cannot pass required compatibility. |
| 6 | Synthetic totals, destination, delivery, returns; same-variant cheap/late vs fast/dearer; explicit clock | Complete integer fee/tax/hardware totals; fixed Asia/Singapore clock; delivery windows, cutoff, return terms, and scenario tradeoffs checked. |
| 7 | Independent nullable review/purchase counts and period; family scope; no invented quotes/café evidence | Lossless metrics/scope assertions, unknown-value tests, source paraphrases kept as claims rather than verbatim excerpts. |
| 8 | Permitted videos or explicit missing media; bounded links/images | No unverified videos are invented; missing status is explicit. Three labelled original illustrations load via HTTP. Known links are bounded and never fetched. |
| 9 | Validate relationships/totals and negative scenarios | Mutation tests cover IDs, evidence/source ownership, totals, stock, invalid windows, hardware, no-match, missing evidence, and fresh independent snapshots. |

## #7 — Session state and cancellation

Primary evidence: [store regression tests](./test/approval-review.test.ts), [HTTP contract tests](./test/http-contract-regression.test.ts), [public integration tests](./test/integration.test.ts), and [journey tests](./test/journey.test.ts).

| AC | Requirement | Verified behavior |
| --- | --- | --- |
| 1 | Preserve needs/constraints/preferences/exclusions, stable order, view/focus/comparison, saved rationale/history, selection/summary; reset epoch/assets | Authoritative Session and public snapshot contain all fields. Independent displayOrder is preserved. Reset clears context and assets and increments epoch. |
| 2 | Four modalities; unique event/base revision; atomic stale/cancelled rejection; dedupe | Voice/text/image/link envelopes validate identity and current state. Duplicate events mutate once; conflicting reuse and stale turns/epochs fail with the latest snapshot. |
| 3 | Ordinal references use visible revision/product IDs; stale/ambiguous clarification | Input must match the accepted displayOrder/revision exactly; reordered or stale visible IDs are rejected without mutation. |
| 4 | One accepted snapshot for visuals/narration; presentation cannot change order/rank/approval | JSON/SSE share the accepted state. Focus/card presentation preserves rank/order. Model tools cannot directly set summary/receipt stages. |
| 5 | Barge-in, text interruption, media ownership, reconnect, mode switch; reject media-as-shopper | Lifecycle binds playback ID, revision, epoch and turn. New input, stop, mode changes, and curated video revoke eligibility. Voice/audio require trusted bridge credentials. |
| 6 | Validate image type/size, opaque IDs, scoped cleanup, limits, failure preservation | PNG/JPEG/WebP structural validation; 2 MiB/five-image limits, dimension bounds, opaque IDs, cross-session rejection, reset/end/expiry cleanup, and unchanged state after invalid uploads. |
| 7 | Bounded links, no arbitrary/internal fetching, no evidence instructions | Only own curated mappings resolve; local/unknown/prototype-property URLs are rejected. Links/images cannot inherit purchase eligibility. |
| 8 | Server credentials, session-only retention, reconnect latest without approval replay | Browser clients reject embedded bridge credentials. Bearer-only requests cannot forge voice/audio/approval. SSE reconnect returns a snapshot, end closes streams, and no raw audio is retained. |

## #8 — Compatibility and summaries

Primary evidence: [catalog review tests](./test/catalog-review.test.ts), [approval tests](./test/approval-review.test.ts), and the [three-scenario HTTP rehearsal](./scripts/demo.ts).

| AC | Requirement | Verified behavior |
| --- | --- | --- |
| 1 | Reject bad IDs/variants/stock/quantity/constraints; quality preference keeps budget | Canonical validator rejects each case. Constraint updates preserve hard budget, nested compatibility, and every previously accepted bag-dimension axis. |
| 2 | Reference/payable separation; integer USD lines, quantity and all fees/hardware; block unknown essentials | Items, shipping, hardware, other fees and tax sum exactly once. Shared fixtures support one bundle; invalid/unsupported quantities return conflicts and no payable total. Missing or inconsistent amounts block approval. |
| 3 | Evidence-based bag/bedding/audio compatibility; ask for unresolved essentials | Exterior dimensions use supported units/caveats; laptop diagonal, exact mattress dimensions/depth, composition/package/care, host connector, interface/cable requirements checked. Unknown essentials return explicit conflicts. |
| 4 | Explain no-match, never fabricate or silently relax | Same-variant next-day/budget revisions yield expected eligible IDs or none; rejected quotes retain codes, fields and explanations. |
| 5 | Complete exact summary and immutable accepted order | Item/variant, seller, quantity, destination, delivery, setup, returns, conditions and uncertainties appear in summary/receipt. Receipt projection uses its stored quote, not mutable current state. |
| 6 | Material changes revoke eligibility; recalculate tradeoffs | Destination/constraint/selection changes invalidate summary. Current catalog/quote is revalidated at commit, including changed fees, hardware, delivery, and uncertainty. In-flight summaries cannot regain eligibility. |

## #9 — Approval and receipts

Primary evidence: [approval regression tests](./test/approval-review.test.ts), [HTTP contract tests](./test/http-contract-regression.test.ts), [integration tests](./test/integration.test.ts), and [HTTP rehearsal](./scripts/demo.ts).

| AC | Requirement | Verified behavior |
| --- | --- | --- |
| 1 | Complete uninterrupted voice+display, then fresh clear confirmation; explicit text+display then fresh typed confirmation | Both valid paths pass. Display-only voice, incomplete/interrupted playback, wrong text or wrong modality fail. |
| 2 | Summary/revision, epoch, turn/event, mode at commit; mode switches require fresh presentation | Guarded confirm/presentation/lifecycle checks enforce identities. Canonical legacy /approval is disabled on both API prefixes, and input-less turns cannot approve. |
| 3 | Reject ambiguous/partial/background/echo/quoted/image/link/stale/interrupted/save/decline/stop | Negative matrix covers these cases; voice transcript must match the accepted trusted shopper turn. Quoted confirmation cannot normalize into authorization. |
| 4 | Material invalidation; concurrent/duplicate receipt uniqueness; reset cannot revive | Atomic synchronous commit and event dedupe return one receipt. Material changes, stop, mode switch, reset, and old-session callbacks cannot revive eligibility. |
| 5 | Stable simulated receipt with complete order; no external purchase or messaging calls | Receipt ID is stable, simulated:true, with a complete immutable acceptedOrder. Implementation has no payment/merchant/messaging integration. |
| 6 | Valid modalities plus stop/text race, audio-flight change, old-session events, video echo | Tests cover both commit orderings of stop/confirm, in-flight material changes, wrong epoch/turn/playback, curated video interruption, and media impersonation. |

## Code review corrections

The review found and fixed evidence-field loss in the public projection, missing canonical catalog validation, insufficient playback identity checks, quoted-confirmation acceptance, signature-only image validation, a legacy approval bypass, partial bag-dimension updates dropping prior constraints, and delayed cancellation crossing a reset epoch when a provider reused a turn ID. Regression tests cover each correction. Public documentation and the PR description now follow the current contract rather than the superseded lighting/voice-only brief.

## Reproduce and interpret the result

```sh
cd catalog
npm ci
npm run verify
cd ../backend
npm ci
npm run verify
```

Catalog CI also requires regenerated fixtures to match committed JSON. Backend CI runs the same verification on Node 22 and Node 24. All local HTTP checks need loopback network access.

Supported media fallback, quantity-one fixtures, fictional fulfillment, ephemeral sessions, and emulated presentation callbacks are intentional documented demo boundaries. Live provider confidence/echo behavior, audible playback, frontend rendering, and the seven-minute release rehearsal still require the relevant frontend/voice workstreams (#5/#10 and release integration). This review does not claim those live checks occurred.
