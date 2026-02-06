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

import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { spawn } from "child_process";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { isMedia } from "../mime-types";

export type OptimizedMedia = {
  buffer: Buffer;
  mimeType: string;
};

function clampPercent(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
}

export async function optimizeImageBuffer(
  buffer: Buffer,
  mimeType: string,
  quality: number,
): Promise<OptimizedMedia> {
  const q = clampPercent(quality);
  if (!isMedia("image", mimeType)) {
    return { buffer, mimeType };
  }

  if (mimeType === "image/gif" || mimeType.includes("gif")) {
    return { buffer, mimeType };
  }

  const image = sharp(buffer, { failOn: "none", animated: true });

  const keepSmaller = (out: Buffer, outMimeType: string) => {
    if (!out?.length || out.length >= buffer.length) {
      return { buffer, mimeType };
    }
    return { buffer: out, mimeType: outMimeType };
  };

  if (mimeType.includes("png")) {
    const compressionLevel = Math.min(
      9,
      Math.max(0, Math.round(((100 - q) / 100) * 9)),
    );

    const out = await image
      .png({
        compressionLevel,
      })
      .toBuffer();
    return keepSmaller(out, "image/png");
  }

  if (mimeType.includes("webp")) {
    const out = await image.webp({ quality: q }).toBuffer();
    return keepSmaller(out, "image/webp");
  }

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    const out = await image
      .jpeg({ quality: q, mozjpeg: true, progressive: true })
      .toBuffer();
    return keepSmaller(out, "image/jpeg");
  }

  if (mimeType.includes("avif")) {
    const out = await image.avif({ quality: q }).toBuffer();
    return keepSmaller(out, "image/avif");
  }

  const out = await image.toBuffer();
  return keepSmaller(out, mimeType);
}

function qualityToCrf(quality: number) {
  const q = clampPercent(quality);
  const crf = 18 + (100 - q) * 0.33;
  return Math.min(51, Math.max(18, Math.round(crf)));
}

function qualityToAudioBitrate(quality: number) {
  const q = clampPercent(quality);
  const bitrate = 32 + Math.round((q / 100) * 288);
  return Math.min(320, Math.max(32, bitrate));
}

export async function transcodeMediaBuffer(
  buffer: Buffer,
  mimeType: string,
  quality: number,
): Promise<OptimizedMedia> {
  if (!isMedia("video", mimeType) && !isMedia("audio", mimeType)) {
    return { buffer, mimeType };
  }
  const ffmpegCmd =
    process.env.FFMPEG_PATH?.trim() || (ffmpegPath as string) || "ffmpeg";

  const id = randomUUID();
  const dir = path.join(tmpdir(), "swush-media");
  const inputPath = path.join(dir, `${id}.input`);
  const outputPath = path.join(
    dir,
    isMedia("video", mimeType) ? `${id}.mp4` : `${id}.mp3`,
  );

  await mkdir(dir, { recursive: true });
  await writeFile(inputPath, buffer);

  const args: string[] = ["-y", "-i", inputPath];
  if (isMedia("video", mimeType)) {
    const crf = qualityToCrf(quality);
    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      String(crf),
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      outputPath,
    );
  } else {
    const bitrate = qualityToAudioBitrate(quality);
    args.push("-vn", "-c:a", "libmp3lame", "-b:a", `${bitrate}k`, outputPath);
  }

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegCmd, args, { stdio: "ignore" });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed with code ${code}`));
    });
  });

  const outBuf = await readFile(outputPath);
  await Promise.all([
    rm(inputPath, { force: true }),
    rm(outputPath, { force: true }),
  ]);

  if (!outBuf?.length || outBuf.length >= buffer.length) {
    return { buffer, mimeType };
  }

  return {
    buffer: outBuf,
    mimeType: isMedia("video", mimeType) ? "video/mp4" : "audio/mpeg",
  };
}
