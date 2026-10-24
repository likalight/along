# Seeded catalogue product imagery

The final catalogue uses product photographs from online manufacturer and retailer listings. Their source and image URLs are retained in `catalog/sources/*images.json` and in each product's image metadata. This replaced image generation at the user's request.

The final browser assets live in `catalog/public/catalog/images/products/`, and `asset-manifest.json` records their product associations, source URLs, dimensions, sizes and SHA-256 hashes. WebP encoding reduces transfer size without cropping or compositing the photographs. Earlier image-generation prompt manifests and original PNGs are retained as work-in-progress history; they are not the final catalogue source.

Use `node scripts/fetch-catalog-photos.mjs` with `--start`, `--end`, `--ids`, `--manifest` and optional `--overrides` for source-photo acquisition. Use `npm run seed:catalog`, `npm run verify:catalog-media`, then rebuild the contract/backend/agent to refresh the demo. Incomplete coverage fails the media check.

Prices, fulfillment and sample reviews are separately authored demo data. Source ratings stay separate from the four fictional review entries attached to each product.
