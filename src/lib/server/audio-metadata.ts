/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import "server-only";

import type { Readable } from "stream";
import type { AudioTrackMeta } from "@/types/player";
import sharp from "sharp";
import {
  readFromStorage,
  statFromStorage,
  type StorageDriver,
  type StorageMeta,
  type StorageTarget,
} from "@/lib/storage";

const MAX_ID3_BYTES = 512 * 1024;
const MAX_TAG_BYTES = 2 * 1024 * 1024;

type ParsedMeta = AudioTrackMeta & {
  tagSize?: number;
  needsMore?: boolean;
};

function readSyncSafe(bytes: Uint8Array) {
  if (bytes.length < 4) return 0;
  return (
    ((bytes[0] & 0x7f) << 21) |
    ((bytes[1] & 0x7f) << 14) |
    ((bytes[2] & 0x7f) << 7) |
    (bytes[3] & 0x7f)
  );
}

function readUInt32BE(bytes: Uint8Array) {
  if (bytes.length < 4) return 0;
  return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
}

function decodeText(bytes: Uint8Array, encoding: number) {
  if (!bytes.length) return "";
  try {
    if (encoding === 0) {
      return new TextDecoder("iso-8859-1").decode(bytes);
    }
    if (encoding === 1) {
      return new TextDecoder("utf-16").decode(bytes);
    }
    if (encoding === 2) {
      const swapped = new Uint8Array(bytes.length);
      for (let i = 0; i + 1 < bytes.length; i += 2) {
        swapped[i] = bytes[i + 1];
        swapped[i + 1] = bytes[i];
      }
      return new TextDecoder("utf-16le").decode(swapped);
    }
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    try {
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      return "";
    }
  }
}

function trimNulls(value: string) {
  return value.replace(/\0/g, "").trim();
}

function toBase64(data: Uint8Array) {
  return Buffer.from(data).toString("base64");
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

function buildGradient(r: number, g: number, b: number) {
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const from = `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, 0.55)`;
  const to = `rgba(${clamp(r - 45)}, ${clamp(g - 45)}, ${clamp(b - 45)}, 0.25)`;
  return `radial-gradient(120% 120% at 10% 0%, ${from}, ${to})`;
}

export async function computeAudioGradient(dataUrl?: string | null) {
  if (!dataUrl) return null;
  const parsed = parseDataUrl(dataUrl);
  if (!parsed?.buffer) return null;
  try {
    const { data, info } = await sharp(parsed.buffer, {
      failOnError: false,
    })
      .resize({ width: 48, height: 48, fit: "cover" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    const channels = info.channels || 4;
    for (let i = 0; i + 3 < data.length; i += channels) {
      const alpha = data[i + 3] ?? 255;
      if (alpha < 16) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
    if (!count) return null;
    return buildGradient(
      Math.round(r / count),
      Math.round(g / count),
      Math.round(b / count),
    );
  } catch {
    return null;
  }
}

function findTerminator(bytes: Uint8Array, start: number, encoding: number) {
  if (encoding === 1 || encoding === 2) {
    for (let i = start; i + 1 < bytes.length; i += 2) {
      if (bytes[i] === 0x00 && bytes[i + 1] === 0x00) return i;
    }
    return bytes.length;
  }
  for (let i = start; i < bytes.length; i += 1) {
    if (bytes[i] === 0x00) return i;
  }
  return bytes.length;
}

function parseId3(buffer: Uint8Array): ParsedMeta | null {
  if (buffer.length < 10) return null;
  if (buffer[0] !== 0x49 || buffer[1] !== 0x44 || buffer[2] !== 0x33) {
    return null;
  }

  const version = buffer[3];
  const tagSize = readSyncSafe(buffer.subarray(6, 10));
  const tagEnd = 10 + tagSize;
  const meta: ParsedMeta = { tagSize };

  const limit = Math.min(buffer.length, tagEnd);
  if (tagEnd > buffer.length) {
    meta.needsMore = tagEnd <= MAX_TAG_BYTES;
  }

  let offset = 10;
  while (offset + 10 <= limit) {
    const frameId = String.fromCharCode(
      buffer[offset],
      buffer[offset + 1],
      buffer[offset + 2],
      buffer[offset + 3],
    );
    if (!frameId.trim()) break;
    const sizeBytes = buffer.subarray(offset + 4, offset + 8);
    const frameSize =
      version >= 4 ? readSyncSafe(sizeBytes) : readUInt32BE(sizeBytes);
    if (!frameSize || offset + 10 + frameSize > limit) break;
    const frameData = buffer.subarray(offset + 10, offset + 10 + frameSize);
    if (frameId.startsWith("T")) {
      const encoding = frameData[0] ?? 0;
      const text = trimNulls(decodeText(frameData.subarray(1), encoding));
      if (text) {
        if (frameId === "TIT2" && !meta.title) meta.title = text;
        if (frameId === "TPE1" && !meta.artist) meta.artist = text;
        if (frameId === "TALB" && !meta.album) meta.album = text;
      }
    } else if (frameId === "APIC" && !meta.pictureDataUrl) {
      const encoding = frameData[0] ?? 0;
      let cursor = 1;
      const mimeEnd = frameData.indexOf(0x00, cursor);
      const mimeRaw =
        mimeEnd > cursor
          ? decodeText(frameData.subarray(cursor, mimeEnd), 0)
          : "";
      cursor = mimeEnd > -1 ? mimeEnd + 1 : cursor;
      cursor += 1;
      const descEnd = findTerminator(frameData, cursor, encoding);
      cursor = descEnd + (encoding === 1 || encoding === 2 ? 2 : 1);
      if (cursor < frameData.length && mimeRaw && mimeRaw !== "-->") {
        const imageBytes = frameData.subarray(cursor);
        if (imageBytes.length) {
          meta.pictureDataUrl = `data:${mimeRaw};base64,${toBase64(
            imageBytes,
          )}`;
        }
      }
    }
    offset += 10 + frameSize;
  }

  return meta;
}

function parseId3v1(buffer: Uint8Array): AudioTrackMeta | null {
  if (buffer.length < 128) return null;
  const start = buffer.length - 128;
  if (
    buffer[start] !== 0x54 ||
    buffer[start + 1] !== 0x41 ||
    buffer[start + 2] !== 0x47
  ) {
    return null;
  }
  const title = trimNulls(
    decodeText(buffer.subarray(start + 3, start + 33), 0),
  );
  const artist = trimNulls(
    decodeText(buffer.subarray(start + 33, start + 63), 0),
  );
  const album = trimNulls(
    decodeText(buffer.subarray(start + 63, start + 93), 0),
  );
  return {
    title: title || undefined,
    artist: artist || undefined,
    album: album || undefined,
  };
}

async function streamToBuffer(
  stream: Readable,
  maxBytes?: number,
): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buf);
    total += buf.length;
    if (typeof maxBytes === "number" && total >= maxBytes) break;
  }
  return new Uint8Array(Buffer.concat(chunks, total));
}

async function readRange(
  target: StorageTarget,
  range: { start: number; end: number },
  meta: StorageMeta,
  driver?: StorageDriver,
) {
  const res = await readFromStorage(target, {
    range,
    driver,
    knownMeta: meta,
  });
  if (!res?.stream) return null;
  return streamToBuffer(res.stream);
}

export async function extractAudioMetadata(
  target: StorageTarget,
  driver?: StorageDriver,
): Promise<AudioTrackMeta | null> {
  const meta = await statFromStorage(target, { driver });
  if (!meta || meta.size <= 0) return null;

  const headEnd = Math.min(MAX_ID3_BYTES, meta.size) - 1;
  if (headEnd < 0) return null;
  let buffer = await readRange(
    target,
    { start: 0, end: headEnd },
    meta,
    driver,
  );
  if (!buffer) return null;

  let parsed = parseId3(buffer) ?? {};

  if (parsed.needsMore && parsed.tagSize) {
    const targetEnd = Math.min(parsed.tagSize + 10, MAX_TAG_BYTES, meta.size);
    if (targetEnd > 0) {
      const full = await readRange(
        target,
        { start: 0, end: targetEnd - 1 },
        meta,
        driver,
      );
      if (full) {
        buffer = full;
        parsed = parseId3(buffer) ?? parsed;
      }
    }
  }

  if (!parsed.title && !parsed.artist && !parsed.album && meta.size >= 128) {
    const tailStart = Math.max(0, meta.size - 128);
    const tail = await readRange(
      target,
      { start: tailStart, end: meta.size - 1 },
      meta,
      driver,
    );
    if (tail) {
      const v1 = parseId3v1(tail);
      if (v1) parsed = { ...parsed, ...v1 };
    }
  }

  if (
    !parsed.title &&
    !parsed.artist &&
    !parsed.album &&
    !parsed.pictureDataUrl
  ) {
    return null;
  }

  const gradient =
    parsed.gradient ??
    (parsed.pictureDataUrl
      ? await computeAudioGradient(parsed.pictureDataUrl)
      : undefined);

  return {
    title: parsed.title,
    artist: parsed.artist,
    album: parsed.album,
    pictureDataUrl: parsed.pictureDataUrl,
    gradient: gradient ?? undefined,
  };
}
