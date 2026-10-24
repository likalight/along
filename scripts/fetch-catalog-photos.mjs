import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const start = Number(option("--start", "1")), end = Number(option("--end", "100"));
const ids = option("--ids", "").split(",").filter(Boolean);
const manifestName = option("--manifest", "online-product-images.json");
if (!/^[a-zA-Z0-9_-]+\.json$/.test(manifestName)) throw new Error("Invalid manifest name");
const manifestPath = new URL(`catalog/sources/${manifestName}`, root);
const errorPath = new URL(`output/catalogue-images/errors-${manifestName}`, root);
const overrideFile = option("--overrides", "");
const overrides = overrideFile ? JSON.parse(readFileSync(overrideFile, "utf8")) : {};
const data = JSON.parse(readFileSync(new URL("catalog/data/catalog.json", root), "utf8"));
const products = data.products.filter(p => ids.length ? ids.includes(p.id) : p.id.startsWith("MIC-") && Number(p.id.slice(4)) >= start && Number(p.id.slice(4)) <= end);
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
const errors = {};
mkdirSync(new URL("output/catalogue-images/", root), { recursive: true });
mkdirSync(new URL("catalog/public/catalog/images/products/", root), { recursive: true });
const decode = s => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
function publicUrl(value, base) {
  const u = new URL(decode(value), base);
  if (u.protocol !== "https:" || u.username || u.password || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname)) throw new Error("Not a public HTTPS image/source");
  return u.href;
}
async function fetchBytes(url, image = false) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(25000), headers: { "User-Agent": "Mozilla/5.0 (compatible; AlongDemoCatalog/1.0)", Accept: image ? "image/avif,image/webp,image/*,*/*;q=0.5" : "text/html,application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  publicUrl(response.url);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > (image ? 18 : 8) * 1024 * 1024) throw new Error("Response too large");
  return { bytes, finalUrl: response.url, contentType: response.headers.get("content-type") ?? "" };
}
function imageCandidates(html, base) {
  const images = [];
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...tag[0].matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)].map(m => [m[1].toLowerCase(), decode(m[3])]));
    if (/^(og:image(?::secure_url)?|twitter:image(?::src)?)$/.test(attrs.property ?? attrs.name ?? "") && attrs.content) images.push(attrs.content);
  }
  function visit(value) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (value["@type"] === "Product" || value["@type"]?.includes?.("Product")) {
      for (const img of [value.image].flat().filter(Boolean)) {
        const url = typeof img === "string" ? img : img.url ?? img.contentUrl;
        if (url) images.push(url);
      }
    }
    if (value["@graph"]) visit(value["@graph"]);
  }
  for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { visit(JSON.parse(script[1])); } catch {} }
  return [...new Set(images)].filter(u => !/logo|placeholder|favicon|sprite|default[_-]og|global[-_]og|homepage/i.test(u)).flatMap(u => {
    try { return [publicUrl(u.replace(/^http:\/\//i, "https://"), base)]; } catch { return []; }
  });
}
async function acquire(product) {
  const override = overrides[product.id] ?? {};
  if (manifest[product.id] && !args.includes("--refresh")) return;
  try {
    const sourceUrl = publicUrl(override.sourceUrl ?? product.sourceUrls[0]);
    let candidates, sourceTitle = null;
    if (override.imageUrl) candidates = [publicUrl(override.imageUrl, sourceUrl)];
    else {
      const page = await fetchBytes(sourceUrl);
      const html = page.bytes.toString("utf8");
      sourceTitle = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "");
      candidates = imageCandidates(html, page.finalUrl);
    }
    if (!candidates.length) throw new Error("No product photo in page metadata");
    let lastError;
    for (const candidate of candidates.slice(0, 4)) {
      try {
        const image = await fetchBytes(candidate, true);
        const meta = await sharp(image.bytes).metadata();
        if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < 160 || meta.format === "svg") throw new Error("Not a usable product photograph");
        const webp = await sharp(image.bytes).resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
        writeFileSync(new URL(`catalog/public/catalog/images/products/${product.id}.webp`, root), webp);
        manifest[product.id] = { sourceUrl, imageUrl: image.finalUrl, sourceTitle, alt: override.alt ?? `${product.brand} ${product.model}, product photograph from the linked source; pictured configuration may vary`, source: override.source ?? "Product photograph from linked manufacturer or retailer; pictured configuration may vary", classification: "snapshot", checkedOn: "2026-10-25", width: meta.width, height: meta.height, sha256: createHash("sha256").update(webp).digest("hex") };
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
        console.log(`${product.id}: saved source photo`);
        return;
      } catch (error) { lastError = error.message; }
    }
    throw new Error(lastError ?? "No image candidate downloaded");
  } catch (error) {
    errors[product.id] = { sourceUrl: override.sourceUrl ?? product.sourceUrls[0] ?? null, error: error.message };
    writeFileSync(errorPath, JSON.stringify(errors, null, 2) + "\n");
    console.log(`${product.id}: ${error.message}`);
  }
}
let next = 0;
await Promise.all(Array.from({ length: Math.min(10, products.length) }, async () => { while (next < products.length) await acquire(products[next++]); }));
console.log(JSON.stringify({ requested: products.length, saved: products.filter(p => manifest[p.id]).length, unresolved: Object.keys(errors) }));
