import { readFile, writeFile, mkdir, readdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'along');
if (path.dirname(unpacked) !== dist || path.dirname(dist) !== root) throw new Error('Invalid build output directory.');
await rm(unpacked, { recursive: true, force: true });
await mkdir(unpacked, { recursive: true });
const files = [];
async function copy(relative) {
  const source = path.join(root, relative);
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const file = `${relative}/${entry.name}`;
    if (entry.isDirectory()) await copy(file);
    else if (entry.isFile()) { await mkdir(path.dirname(path.join(unpacked, file)), { recursive: true }); await copyFile(path.join(root, file), path.join(unpacked, file)); files.push(file); }
  }
}
await copy('src'); await copy('ui');
await copyFile(path.join(root, 'manifest.json'), path.join(unpacked, 'manifest.json')); files.push('manifest.json');
const table = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
function crc32(buffer) { let c = 0xffffffff; for (const b of buffer) c = table[(c ^ b) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type); const length = Buffer.alloc(4); length.writeUInt32BE(data.length); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, crc]); }
function orbPng(size) {
  const pixels = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const nx = (x + 0.5) / size, ny = (y + 0.5) / size;
    const r = Math.hypot(nx - 0.5, ny - 0.5);
    const light = Math.max(0, 1 - Math.hypot(nx - 0.3, ny - 0.25) / 0.8);
    pixels[i] = 26 + Math.round(light * 110); pixels[i + 1] = 72 + Math.round(light * 117); pixels[i + 2] = 186 + Math.round(light * 69); pixels[i + 3] = Math.round(Math.max(0, Math.min(1, (0.47 - r) * size)) * 255);
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
await mkdir(path.join(unpacked, 'icons'), { recursive: true });
for (const size of [16, 32, 48, 128]) { const file = `icons/icon${size}.png`; await writeFile(path.join(unpacked, file), orbPng(size)); files.push(file); }
// A small standards-compliant ZIP writer keeps builds dependency-free and offline.
const bodies = [], central = []; let offset = 0;
for (const file of files.sort()) {
  const raw = await readFile(path.join(unpacked, file)); const name = Buffer.from(file); const checksum = crc32(raw);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(33, 12); local.writeUInt32LE(checksum, 14); local.writeUInt32LE(raw.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(name.length, 26);
  bodies.push(local, name, raw);
  const header = Buffer.alloc(46); header.writeUInt32LE(0x02014b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(20, 6); header.writeUInt16LE(0x800, 8); header.writeUInt16LE(33, 14); header.writeUInt32LE(checksum, 16); header.writeUInt32LE(raw.length, 20); header.writeUInt32LE(raw.length, 24); header.writeUInt16LE(name.length, 28); header.writeUInt32LE(offset, 42); central.push(header, name);
  offset += local.length + name.length + raw.length;
}
const directory = Buffer.concat(central); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await writeFile(path.join(dist, 'along-extension.zip'), Buffer.concat([...bodies, directory, end]));
console.log(`Built ${files.length} packaged files.\nUnpacked: ${unpacked}\nZIP: ${path.join(dist, 'along-extension.zip')}`);

const downloads = path.resolve(root, '../shopper/public/downloads');
await mkdir(downloads, {recursive:true});
await copyFile(path.join(dist, 'along-extension.zip'), path.join(downloads, 'along-extension.zip'));
