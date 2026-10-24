# Along seeded catalogue

The demo contains **148 products**: all **100 audio products** from the supplied expanded index, **24 everyday bags**, and **24 bedsheet sets**. Every product has two complete simulated seller offers and four clearly labelled fictional reviews: **296 offers and 592 demo reviews**. Product photographs use `/catalog/images/products/<ID>.webp` with the original image and listing URLs retained in the image metadata.

Run `npm ci && npm run verify` with Node 22.18 or newer. `verify` checks types, runs 51 tests, exercises the three rehearsal sequences and regenerates `data/catalog.json` and `data/microphones-archive.json`. Import `getCatalog`, `quoteOffer`, `eligibleOffers` and their types from `src/index.ts`. The generated JSON is reproducible; the source files are the editable authority.

## Data and provenance

- `sources/microphone-demo-data-100.md` retains the user-supplied 100-product index verbatim, with its SHA-256 recorded in the audio archive.
- `sources/microphone-demo-data.md` retains the original 50-product technical/review archive verbatim. Those facts are joined by stable ID and retain their **24 October 2026** snapshots. The importer rejects a changed old price, rating, count, source URL, model or stock status instead of silently refreshing it.
- New audio rows **MIC-051–MIC-100** retain the **25 October 2026** index snapshots. The standalone reference files linked by the index were not present in the supplied files, workspace or Downloads. Detailed technical specifications, original fit scores and individual review text therefore remain explicitly unknown. The linked local path is retained as provenance, not advertised as an accessible source file.
- The four audio navigation groups have 25 records each. `specs.solutionType`, `family` and `representationGroup` make grouping explicit for consumers.
- The original six bag and six bedding source snapshots remain intact. **BAG-007–BAG-024** add 18 real Osprey bag models; **BED-007–BED-024** add 18 real IKEA sheet-set configurations. Their manufacturer identities, reference prices and captured specifications are retained in `sources/real-bags-2026-10-25.json` and `sources/real-bedding-2026-10-25.json`. Uncaptured details remain unknown, including exact destination stock. IKEA family review aggregates retain their broader size/color scope.

All products carry `provenance.kind` and a notice. Product/reference amounts are USD item or kit references, never a payable quote. Old source dates and stock are not replaced by the catalogue build date.

## Reviews and evidence

`buyerMetrics` stores only the supplied real-source aggregate fields. Missing values stay null; rating votes, written reviews and purchases remain separate. The original source scope and raw row survive import. MIC-099 explicitly retains **2 stars, one rating, zero written reviews**. Zero is preserved where supplied; it is never used to fill a missing value.

`product.demoReviews` is a separate proxy object with a disclosure, four `entries`, and an aggregate computed from those four entries. Each entry has a stable product-bound ID, a `Demo shopper` name, rating, title, body, use case, date and `verifiedPurchase: false`. The demo review aggregate is not copied into `buyerMetrics` or evidence metrics. One proxy `DEMO-REVIEWS-<ID>` evidence record per product describes this separation. Do not present this field as real buyer evidence, real purchases or tested performance.

Source feedback summaries remain paraphrases in evidence `claim`, never quoted `excerpt`. Original authored café/office scores remain in `authoredFit` with `measuredPerformance: false`; new missing scores are null. No actual dictation benchmark, cooling guarantee or delivery experience is asserted.

## Purchases and compatibility

Every product has two fictional sellers, complete integer-cent item/shipping/setup/tax totals, delivery windows, an order cutoff, return terms and a destination. Required setup hardware is itemized and included in `otherFeesMinor`. Existing-user hardware does not discount a fixed bundle. Quote validation rejects incomplete totals, expired cutoffs, unsupported currency/destination/quantity, and incompatible hard constraints.

All audio products have an explicit proxy host path in `compatibilityFixture` and `demoConfiguration`. For newly indexed products whose detailed files were absent, those paths and bundled interface/cable/stand assumptions are authored solely for simulated checkout. Original source connector and power fields stay unknown. USB/XLR interfaces include microphone input and necessary cable; a headphone-only adapter is not substituted for a microphone interface. This is not evidence of real retail compatibility or included accessories.

Source out-of-stock, unavailable, discontinued, backordered, special-order and available-soon cases remain unpurchasable. Unknown positive stock is an explicit proxy assumption in the fictional service zone; no Singapore stock claim is made. A later [manufacturer recall notice](https://ca.ankerwork.com/pages/a3302-recall) for some PowerConf S3 units supplements MIC-095 without changing its original source snapshot; its offers are withheld because the demo cannot verify a unit serial number.

Bags include backpacks, totes, slings, waist packs, duffels and wheeled bags with varied capacity and laptop support. Bedding includes Twin, Full/Double, Queen and King configurations with multiple materials and weaves. Match actual width, length and depth rather than size names. Raw source measurements and any conservative normalization are retained. Missing essential care/package fields remain unknown and block quote eligibility, including the original Brooklinen examples and BED-024.

## Scenario clock and regressions

The rehearsal clock remains frozen at **24 October 2026, 10:00 +08:00**, with a noon cutoff. Economy arrives after four days; express arrives the next day. Source snapshot date and simulated fulfillment clock are independent.

The original café, work/gym and warm-room sequences preserve their exact offers and no-match outcomes. Bag/bedding scenarios explicitly scope `candidateProductIds` to their original six products; normal discovery and quoting have no such restriction and use the full catalogue. The café scenario retains its single product anchor and priced setup hardware.

## Images, links and verification

Catalogue product photographs come from public manufacturer or retailer listings. Source-photo manifests in `sources/*images.json` retain the listing URL, original image URL, capture date and local image hash. A photograph is not evidence that every pictured accessory is included in the selected offer; captions retain configuration caveats. Original SVG inspiration fixtures remain available for the three rehearsal examples and as reliable fallbacks. Playable video remains explicitly missing where no permission-verified video was supplied.

From the repository root, `npm run seed:catalog` regenerates and synchronizes the catalogue to the backend, contract and app assets. `scripts/fetch-catalog-photos.mjs` downloads listing photos into browser-friendly WebP files and records attribution. `npm run verify:catalog-media` checks a decodable photo for every product, dimensions, canonical paths and online-source provenance. Run `npm run sync:catalog` after changing media. `output/catalogue-images/asset-manifest.json` records final asset hashes and any shared listing photographs. Earlier generated drafts remain archived but are superseded by sourced photos; no further generation is needed.

Known-link resolution accepts only exact, safe, unambiguous first-source identities. Shared family URLs used by multiple variants are omitted; they cannot silently select the wrong product. Tracking parameters can be ignored, but variant parameters remain significant. Synthetic products have no invented external source URL.

Tests cover all 148 product IDs, four balanced audio groups, original snapshot preservation, unknown/new review counts, demo review separation, two offers per product, every audio host path, all source-negative stock states, varied new bag/bedding constraints, shared-link ambiguity, malformed imports/totals, and the three legacy scenario sequences. Photo assets and application integration are validated by their own consumers; catalogue checks alone do not establish live UI or deployment behavior.
