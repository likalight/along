# Catalog and attributable evidence

Implementation of [issue #6](https://github.com/likalight/along/issues/6), using the [issue #2 contract](https://github.com/likalight/along/issues/2).

The active catalog has **24 products: 12 audio configurations, six everyday bags, six bedsheet sets**. It supplies 48 complete, explicitly synthetic offers, 121 evidence records, three scenario fixtures, a bounded link map, and three original illustration fixtures. The full 50-row microphone research is retained separately.

## Run

Requires Node 22.18+.

```sh
cd catalog
npm ci
npm run verify
```

Verification type-checks the package, runs the acceptance/regression suite, validates the catalog, exercises every scenario revision, and regenerates:

- `data/catalog.json`: active products, seller offers, evidence, scenarios, links, and image metadata.
- `data/microphones-archive.json`: all 50 joined research records, the original three table rows per ID, variant notes, source URLs, and source hash.

`sources/microphone-demo-data.md` is the supplied research document, preserved without edits. Its facts are attributed to that research; they have not been independently rechecked in this implementation. The bag/bedding data uses the manufacturer's or retailer's linked pages inspected on 24 October 2026.

CI runs the same verification and checks that generated JSON is up to date.

## Backend / Next.js integration

The base branch contains only a README. This PR adds a standalone TypeScript data package and portable JSON; it does not claim that an application or session/approval backend has been implemented. The separate, unmerged legacy backend branch uses different shapes, SGD and lighting fixtures. Do not mix those fixtures with this contract-v1 catalog.

On the server, import `getCatalog`, `quoteOffer`, `eligibleOffers`, and `resolveKnownLink` from `catalog/src/index.ts`. It uses Node filesystem APIs for the archived source and must not be imported into a client component. Alternatively load the generated JSON and validate it with `validateCatalog` before use.

```ts
import { getCatalog, eligibleOffers, quoteOffer, resolveKnownLink } from "./catalog/src/index.ts";

const catalog = getCatalog(); // fresh copy for each session/reset
const candidates = eligibleOffers(catalog, {
  category: "everyday-bags", currency: "USD", budgetMinor: 15000,
  laptopInches: 14, separateShoeCompartment: true,
  deadline: "2026-10-25T18:00:00+08:00",
});
// BAG-001-B, 11900 cents, fictional next-day delivery.
const quote = quoteOffer(catalog, "BAG-001-B", {
  currency: "USD", budgetMinor: 15000,
});
const link = resolveKnownLink(
  "https://www.osprey.com/daylitetm-large-tote-pack", catalog.knownLinks,
);
```

Use the exact types in `src/types.ts`. `referencePrice`, `sourceAvailability`, buyer metrics, authored fit and media status extend the minimal product contract so provenance does not get lost. Offers add explicit tax, total, cutoff and setup hardware fields. `otherFeesMinor` contains setup hardware once, not in addition to another hardware subtotal.

Mount or copy `catalog/public/catalog/images/` to the application's `public/catalog/images/`. The SVGs are original illustrations labelled DEMO ILLUSTRATION, not product photographs. Serve their corresponding alt/source/classification fields.

For media display, `video.status === "missing"` means show “No curated product video available”; it does not mean a live video search was performed. No permission-verified playable anchor video is supplied. The issue explicitly allows missing media. If one is later curated, add product-associated media evidence with source URL, creator, published date (or explicit unknown), topic, classification and permission before changing status.

Resolve links only with `resolveKnownLink`; it performs no network request. Unknown/ambiguous links return unsupported. Photo fixtures are curated inspiration, not model recognition results: their mappings do not establish measurements or product identity.

The helpers calculate eligibility, not authorization. Session revision handling, fresh explicit text/voice approval, audio completion, receipt idempotency and shopper UI remain the consuming backend's responsibility. Voice stays a complete path; text, photos and supported links are optional inputs under the latest issue #2 contract.

## Provenance and money

- Currency is USD throughout. No automatic exchange or Singapore inventory assertion.
- Source item prices are never payable totals. Their `price_kind` is retained even for starting prices, range floors, historical values, and estimates.
- Offers are separately authored, complete proxy records for one product bundle at one fictional destination. Changing a source reference price cannot change an offer.
- Decimal source prices are parsed as strings into integer cents using integer arithmetic, not floating-point rounding.
- Tax is explicitly zero only in this fictional scenario. All totals include item, shipping, setup hardware/other fees and tax. Null or absent charges are invalid.
- All fulfillment is simulated. No checkout endpoint, payment credential, real address or personal shopper information is present.
- Unknown real stock remains unknown; proxy stock is separately labelled. The known negative audio cases MIC-025 and MIC-038 remain unavailable/out of stock. Discontinued rows remain in the 50-row archive.

## Reviews and compatibility

Buyer metrics have independent nullable `rating`, `ratingCount`, `writtenReviewCount`, `purchaseCount`, and `purchaseCountPeriod` fields. A source's ambiguous aggregate count is preserved as `referenceCustomerReviewCount` and in the raw source row rather than asserted as two counts. Explicit review-count labels populate writtenReviewCount; the source's rendered individually rated reviews also establish ratingCount. No purchase counts are fabricated. Family-level review scope survives import.

Feedback summaries are paraphrases in evidence `claim`, never `excerpt`. Authored café/office fit scores stay in `authoredFit` and proxy evidence; they are neither customer ratings nor measured transcription results. All six bag reviews remain unknown.

Audio host paths are explicit simulation assumptions in `compatibilityFixture`, distinct from the source connector specification. Where a host-side cable, microphone interface or desktop stand is required, the bundle includes an identified, priced proxy component. A headphone-only adapter is not treated as a microphone interface. Missing host connection blocks eligibility; unsupported host paths are incompatible rather than silently guessed. Existing-user hardware does not discount the fixed bundle.

Bag laptop fit is nominal manufacturer support, not a guarantee for every device of that diagonal. Unknown fit does not pass a required fit filter. For bedding, require exact width, length and depth. ULLVIDE uses the conservative 14.625-inch limit where source fields disagree. Brooklinen retail pack contents/care were not captured: those products stay in the catalog as incomplete-information examples, and quote eligibility blocks on those essential unknowns. Their proxy white/four-piece display assumptions do not fill real specification gaps.

## Frozen scenario clock and scenarios

Clock: **2026-10-24 10:00 +08:00**, Asia/Singapore. Cutoff: noon that day. “Tomorrow” is **2026-10-25**, with a 09:00–18:00 proxy delivery window. Economy arrives +4 days, express +1 day. Expired cutoff, unknown destination, incomplete totals and quantities other than one block eligibility. Advancing a rehearsal clock requires regenerating windows/cutoff together; `resolveDelivery` intentionally uses this frozen scenario date.

1. **Noisy café:** clarify connection, wearability, portability and hard budget before comparing solution types. The directional MIC-044 anchor includes USD 20 setup hardware; economy total USD 134 versus next-day USD 148. Requiring tomorrow under USD 140 produces no match. Rankings are contextual hypotheses, not proven café performance.
2. **Work/gym bag:** optional illustration or known link, then clarify shape versus color, space, compartments, weight and budget. BAG-001 has supported shoe separation and nominal laptop fit. USD 104 economy versus USD 119 next day. Retaining tomorrow and reducing budget to USD 100 produces no match.
3. **Warm-room bedding:** require US Queen 60 × 80 inches and 12-inch mattress depth under USD 70. Show BED-002-A and BED-003-A/B. A percale preference selects BED-003, next day selects B at USD 63.99; requiring pure cotton while retaining the constraints yields no match. No cooling or health guarantee.

Scenario changes are cumulative, and tests assert exact eligible offer IDs. Do not force three eligible matches when fewer satisfy hard constraints. Discovery candidates from an image are not all eligible purchases.

## Acceptance evidence

All nine issue #6 criteria are covered by the following implementation and checks:

| Criterion | Implementation and verification |
| --- | --- |
| 24 active products, full 50-row archive, competing offers | Exact issue #2 MIC IDs; 6 BAG + 6 BED; 2 offers for every active product. Count tests and validator enforce the boundary. |
| ID joins, source fields, exact money | Three independently shuffled source tables still join by ID; raw rows, scope, availability, links and notes retained. Decimal edge tests cover fractional cents, malformed and unsafe amounts. |
| Reference prices distinct from totals; USD | Separate reference/offer objects; price-mutation test confirms independence; currency conflict rejects SGD; generated archive is non-executable. |
| Authored fit distinct; negative cases | Proxy fit evidence with measuredPerformance=false; null reviews unchanged; MIC-025/MIC-038 blocked; discontinued MIC-018 retained in archive. |
| Complete bag/bedding specification fields, unknown compatibility | Dimensions with units, capacity/weight/compartments/material/laptop fit; exact bedding dimensions/depth/composition/pieces/care. Unknown fields explicitly null and block matching when required. |
| Complete proxy commerce and deadlines | Fictional destination, fees/tax, hardware, return policies, cutoff, absolute windows and fixed timezone. Exact totals and all three revision scenarios verified. |
| Independent nullable counts; scope; paraphrases | Separate metrics, preserved raw count and grouped scope; no excerpt field for paraphrases; no café performance evidence invented. |
| Playable permitted media or missing; links/images | Explicit missing-video records and rendering instructions; exact local URL allowlist; three owned SVG fixtures with correction examples. Link and asset tests pass. |
| IDs, associations, totals and negative cases | Mutation tests reject duplicate/orphan/cross-subject IDs, unrelated URLs, missing/invalid money, dates, hardware and stock changes; no-match, missing evidence and incompatible hardware are exercised. |

Verification record: `npm run verify` passes TypeScript checks, **41 tests**, validation of 24 products / 48 offers / 121 evidence records, and all three scenario sequences. This is catalog validation, not a claim that the full app or a live voice rehearsal has passed.
