import { inflateSync } from "node:zlib";
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "./limits";

export class AttachmentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Enforce the limit while reading, including chunked requests without Content-Length. */
export async function readBoundedBody(
  request: Request,
  max: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("content-length") ?? 0) > max)
    throw new AttachmentError(
      "Choose an image of 5 MB or less; attachment requests must stay within the size limit.",
      413,
    );
  if (!request.body)
    throw new AttachmentError("An attachment request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new AttachmentError(
          "Choose an image of 5 MB or less; attachment requests must stay within the size limit.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

const dimensions = (width: number, height: number) =>
  width > 0 &&
  height > 0 &&
  width <= 8192 &&
  height <= 8192 &&
  width * height <= 16_777_216;
const crcTable = Array.from({ length: 256 }, (_, initial) => {
  let crc = initial;
  for (let bit = 0; bit < 8; bit++)
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

/** Check complete container structure and dimensions, not just a spoofable magic prefix. */
export function validateImage(data: Buffer, contentType: string) {
  if (!data.length || data.length > MAX_IMAGE_BYTES)
    throw new AttachmentError("Choose a non-empty image of 5 MB or less.");
  if (!(IMAGE_TYPES as readonly string[]).includes(contentType))
    throw new AttachmentError("Use a JPG, PNG or WebP image.");
  try {
    if (validImage(data, contentType)) return;
  } catch {
    /* Malformed or truncated containers are rejected below. */
  }
  throw new AttachmentError(
    "The file contents do not match a complete supported image. Use an image up to 8192 pixels per side and 16 megapixels.",
  );
}

function validImage(data: Buffer, contentType: string): boolean {
  if (contentType === "image/png") {
    if (
      !data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      return false;
    let offset = 8,
      width = 0,
      height = 0,
      depth = 0,
      channels = 0,
      interlace = 0,
      ended = false;
    const compressed: Buffer[] = [];
    while (offset + 12 <= data.length) {
      const size = data.readUInt32BE(offset),
        kind = data.toString("ascii", offset + 4, offset + 8);
      if (size > data.length - offset - 12) return false;
      const bytes = data.subarray(offset + 8, offset + 8 + size);
      let crc = 0xffffffff;
      for (const byte of data.subarray(offset + 4, offset + 8 + size))
        crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
      if ((crc ^ 0xffffffff) >>> 0 !== data.readUInt32BE(offset + 8 + size))
        return false;
      if (offset === 8) {
        if (kind !== "IHDR" || size !== 13) return false;
        width = bytes.readUInt32BE(0);
        height = bytes.readUInt32BE(4);
        depth = bytes[8];
        interlace = bytes[12];
        const color = bytes[9],
          depths: Record<number, number[]> = {
            0: [1, 2, 4, 8, 16],
            2: [8, 16],
            3: [1, 2, 4, 8],
            4: [8, 16],
            6: [8, 16],
          };
        channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[
          color
        ];
        if (
          !dimensions(width, height) ||
          !depths[color]?.includes(depth) ||
          bytes[10] !== 0 ||
          bytes[11] !== 0 ||
          ![0, 1].includes(interlace)
        )
          return false;
      } else if (kind === "IHDR") return false;
      if (kind === "IDAT") compressed.push(bytes);
      offset += size + 12;
      if (kind === "IEND") {
        ended = size === 0;
        break;
      }
    }
    if (!ended || offset !== data.length || !compressed.length) return false;
    const passes = interlace
      ? [
          [0, 0, 8, 8],
          [4, 0, 8, 8],
          [0, 4, 4, 8],
          [2, 0, 4, 4],
          [0, 2, 2, 4],
          [1, 0, 2, 2],
          [0, 1, 1, 2],
        ]
      : [[0, 0, 1, 1]];
    const rows = passes.map(([x, y, dx, dy]) => {
      const w = Math.max(0, Math.ceil((width - x) / dx)),
        h = Math.max(0, Math.ceil((height - y) / dy));
      return {
        count: w ? h : 0,
        bytes: Math.ceil((w * depth * channels) / 8) + 1,
      };
    });
    const expected = rows.reduce((sum, row) => sum + row.count * row.bytes, 0);
    const pixels = inflateSync(Buffer.concat(compressed), {
      maxOutputLength: expected,
    });
    let position = 0;
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        if (pixels[position] > 4) return false;
        position += row.bytes;
      }
    }
    return position === pixels.length;
  }
  if (contentType === "image/jpeg") {
    if (
      data[0] !== 255 ||
      data[1] !== 216 ||
      data[data.length - 2] !== 255 ||
      data[data.length - 1] !== 217
    )
      return false;
    let offset = 2,
      frame = false;
    while (offset + 4 <= data.length) {
      if (data[offset++] !== 255) return false;
      while (data[offset] === 255) offset++;
      const marker = data[offset++],
        size = data.readUInt16BE(offset);
      if (size < 2 || offset + size > data.length) return false;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (
          size < 8 ||
          !dimensions(
            data.readUInt16BE(offset + 5),
            data.readUInt16BE(offset + 3),
          ) ||
          size !== 8 + 3 * data[offset + 7]
        )
          return false;
        frame = true;
      }
      if (marker === 0xda)
        return frame && size >= 6 && offset + size < data.length - 2;
      offset += size;
    }
    return false;
  }
  if (
    data.toString("ascii", 0, 4) !== "RIFF" ||
    data.toString("ascii", 8, 12) !== "WEBP" ||
    data.readUInt32LE(4) !== data.length - 8
  )
    return false;
  let offset = 12,
    frame = false;
  while (offset + 8 <= data.length) {
    const kind = data.toString("ascii", offset, offset + 4),
      size = data.readUInt32LE(offset + 4);
    if (size > data.length - offset - 8) return false;
    const bytes = data.subarray(offset + 8, offset + 8 + size);
    if (kind === "VP8 ") {
      if (
        size <= 10 ||
        (bytes[0] & 1) !== 0 ||
        !bytes.subarray(3, 6).equals(Buffer.from([157, 1, 42])) ||
        !dimensions(
          bytes.readUInt16LE(6) & 16383,
          bytes.readUInt16LE(8) & 16383,
        )
      )
        return false;
      frame = true;
    }
    if (kind === "VP8L") {
      if (size <= 5 || bytes[0] !== 47) return false;
      const bits = bytes.readUInt32LE(1);
      if (
        bits >>> 29 ||
        !dimensions((bits & 16383) + 1, ((bits >>> 14) & 16383) + 1)
      )
        return false;
      frame = true;
    }
    offset += 8 + size + (size % 2);
  }
  return frame && offset === data.length;
}
