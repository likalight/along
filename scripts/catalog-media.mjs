import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(readFileSync(new URL("catalog/data/catalog.json", root), "utf8"));
const mediaRoot = new URL("catalog/public/catalog/images/products/", root);
const outputRoot = new URL("output/catalogue-images/", root);
const originals = new URL("originals/", outputRoot);
mkdirSync(mediaRoot, { recursive: true });
mkdirSync(outputRoot, { recursive: true });
const prepare = process.argv.includes("--prepare");
if (prepare) {
  mkdirSync(originals, { recursive: true });
  for (const product of catalog.products) {
    if (product.image.originalUrl) continue; // Never replace a sourced photo with an earlier generated draft.
    const incoming = new URL(`${product.id}.png`, mediaRoot);
    const archived = new URL(`${product.id}.png`, originals);
    const source = existsSync(incoming) ? incoming : archived;
    const target = new URL(`${product.id}.webp`, mediaRoot);
    if (!existsSync(source) || (existsSync(target) && statSync(target).mtimeMs >= statSync(source).mtimeMs)) continue;
    // Format encoding for web delivery; preserve the generated artwork and aspect ratio.
    await sharp(fileURLToPath(source)).webp({ quality: 88, effort: 6 }).toFile(fileURLToPath(target));
    if (existsSync(incoming)) renameSync(incoming, archived);
  }
}

const failures = [], assets = [], hashes = new Map(), reusedPhotos = [];
for (const product of catalog.products) {
  const expected = `/catalog/images/products/${product.id}.webp`;
  const path = new URL(`${product.id}.webp`, mediaRoot);
  if (product.image.url !== expected && !prepare) failures.push(`${product.id}: canonical image URL is not ${expected}`);
  if (!existsSync(path)) { failures.push(`${product.id}: product photograph missing`); continue; }
  const bytes = readFileSync(path);
  const metadata = await sharp(bytes).metadata();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (metadata.format !== "webp" || metadata.width < 160 || metadata.height < 160) failures.push(`${product.id}: invalid image format or dimensions`);
  if (hashes.has(sha256)) reusedPhotos.push({ id: product.id, sharesImageWith: hashes.get(sha256) });
  if (!product.image.originalUrl || !product.image.sourceUrl) failures.push(`${product.id}: missing online-photo provenance`);
  hashes.set(sha256, product.id);
  assets.push({ id: product.id, title: product.title, category: product.category, url: expected, width: metadata.width, height: metadata.height, bytes: bytes.length, sha256, classification: product.image.classification, sourceUrl: product.image.sourceUrl, originalUrl: product.image.originalUrl, disclosure: product.image.source });
}
const manifests = readdirSync(outputRoot).filter(name => /manifest\.json$/.test(name) && name !== "asset-manifest.json");
const report = { productCount: catalog.products.length, productImageCount: assets.length, sourcedPhotoCount: assets.filter(a => a.originalUrl).length, totalBytes: assets.reduce((sum, a) => sum + a.bytes, 0), reusedPhotos, earlierGenerationManifests: manifests, failures, assets };
writeFileSync(new URL("asset-manifest.json", outputRoot), JSON.stringify(report, null, 2) + "\n");
console.log(`${report.sourcedPhotoCount}/${catalog.products.length} sourced product photos; ${(report.totalBytes / 1024 / 1024).toFixed(1)} MiB. ${failures.length ? `${failures.length} issue(s).` : "All media checks pass."}`);
if (failures.length && !prepare) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
