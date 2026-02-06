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

import { and, desc, eq, or, sql } from "drizzle-orm";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import { createWriteStream } from "fs";
import { mkdir, mkdtemp, readdir, readFile, rm, stat } from "fs/promises";
import { pipeline } from "stream/promises";
import os from "os";
import path from "path";
import { db } from "@/db/client";
import { files, streamJobs } from "@/db/schemas";
import {
  putFileToStorage,
  readFromStorage,
  statFromStorage,
  type StorageDriver,
} from "@/lib/storage";
import { isMedia } from "@/lib/mime-types";
import { createNotification } from "@/lib/server/notifications";
import {
  streamAssetStoredName,
  streamPlaylistName,
} from "@/lib/server/stream-paths";

export type StreamJobStatus = "queued" | "processing" | "ready" | "failed";

type StreamJobInput = {
  userId: string;
  fileId: string;
  quality?: number | null;
};

function isStreamSupported(mimeType?: string | null) {
  if (!mimeType) return false;
  return mimeType.startsWith("video/") || mimeType.startsWith("audio/");
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
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

function getHlsContentType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.endsWith(".ts")) return "video/mp2t";
  if (lower.endsWith(".m4s")) return "video/iso.segment";
  if (lower.endsWith(".aac")) return "audio/aac";
  return "application/octet-stream";
}

function readPositiveInt(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function resolveStreamJobLimits(requestedLimit?: number) {
  const hardMax = 50;
  const defaultQueue = 15;
  const defaultConcurrency = 5;
  const requested =
    Number.isFinite(requestedLimit) && (requestedLimit as number) > 0
      ? Math.floor(requestedLimit as number)
      : 1;

  const envQueue = readPositiveInt(process.env.STREAM_JOBS_QUEUE_LIMIT);
  const envConcurrency = readPositiveInt(process.env.STREAM_JOBS_CONCURRENCY);
  const queueCap = Math.min(envQueue ?? defaultQueue, hardMax);
  const queueLimit = Math.min(requested, queueCap);
  const concurrency = Math.min(queueLimit, envConcurrency ?? defaultConcurrency);

  return { queueLimit, concurrency };
}

async function streamStorageToFile(
  target: { userId: string; storedName: string },
  driver: StorageDriver,
  outputPath: string,
) {
  const res = await readFromStorage(target, { driver });
  if (!res) return null;
  await pipeline(res.stream, createWriteStream(outputPath));
  return outputPath;
}

async function runFfmpegHls(params: {
  inputPath: string;
  outputDir: string;
  mimeType: string;
  quality: number;
  copy: boolean;
}) {
  const ffmpegCmd =
    process.env.FFMPEG_PATH?.trim() || (ffmpegPath as string) || "ffmpeg";

  const segmentSeconds = Number(process.env.HLS_SEGMENT_SECONDS || 2);
  const segTime =
    Number.isFinite(segmentSeconds) && segmentSeconds > 1
      ? Math.floor(segmentSeconds)
      : 2;

  const segmentPattern = path.join(params.outputDir, "segment-%05d.ts");
  const playlistPath = path.join(params.outputDir, streamPlaylistName());

  const args: string[] = ["-y", "-i", params.inputPath];

  if (isMedia("audio", params.mimeType)) {
    args.push("-vn");
    if (params.copy) {
      args.push("-c:a", "copy");
    } else {
      const bitrate = qualityToAudioBitrate(params.quality);
      args.push("-c:a", "aac", "-b:a", `${bitrate}k`);
    }
  } else {
    if (params.copy) {
      args.push("-c", "copy");
    } else {
      const crf = qualityToCrf(params.quality);
      const keyint = Math.max(1, Math.round(segTime * 30));
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        String(crf),
        "-g",
        String(keyint),
        "-keyint_min",
        String(keyint),
        "-sc_threshold",
        "0",
        "-force_key_frames",
        `expr:gte(t,n_forced*${segTime})`,
        "-c:a",
        "aac",
        "-b:a",
        "128k",
      );
    }
  }

  args.push(
    "-hls_time",
    String(segTime),
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-hls_segment_filename",
    segmentPattern,
    playlistPath,
  );

  const ffmpeg = spawn(ffmpegCmd, args);
  const stderrChunks: Buffer[] = [];

  ffmpeg.stderr.on("data", (chunk) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  await new Promise<void>((resolve, reject) => {
    ffmpeg.on("close", (code) => {
      if (code === 0) return resolve();
      const stderrStr = Buffer.concat(stderrChunks).toString("utf8").trim();
      reject(
        new Error(
          `ffmpeg failed with code ${code}${stderrStr ? `: ${stderrStr}` : ""}`,
        ),
      );
    });
    ffmpeg.on("error", (err) => {
      const stderrStr = Buffer.concat(stderrChunks).toString("utf8").trim();
      reject(
        new Error(
          `${(err as Error)?.message || "ffmpeg error"}${
            stderrStr ? `: ${stderrStr}` : ""
          }`,
        ),
      );
    });
  });

  return playlistPath;
}

async function uploadHlsOutput(params: {
  userId: string;
  fileId: string;
  driver: StorageDriver;
  outputDir: string;
}) {
  const entries = await readdir(params.outputDir, { withFileTypes: true });
  let totalSize = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(params.outputDir, entry.name);
    const [stats, buffer] = await Promise.all([
      stat(filePath),
      readFile(filePath),
    ]);
    totalSize += stats.size;

    await putFileToStorage({
      target: {
        userId: params.userId,
        storedName: streamAssetStoredName(params.fileId, entry.name),
      },
      buffer,
      contentType: getHlsContentType(entry.name),
      driver: params.driver,
    });
  }

  return totalSize;
}

async function generateHls(params: {
  userId: string;
  storedName: string;
  driver: StorageDriver;
  mimeType: string;
  quality: number;
}) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "swush-hls-"));
  const inputExt = path.extname(params.storedName) || ".bin";
  const inputPath = path.join(tmpDir, `in-${Date.now()}${inputExt}`);
  const outputDir = path.join(tmpDir, "out");
  await mkdir(outputDir, { recursive: true });

  try {
    const written = await streamStorageToFile(
      { userId: params.userId, storedName: params.storedName },
      params.driver,
      inputPath,
    );
    if (!written) throw new Error("Failed to load stored file");

    try {
      await runFfmpegHls({
        inputPath,
        outputDir,
        mimeType: params.mimeType,
        quality: params.quality,
        copy: params.quality >= 95,
      });
    } catch (err) {
      if (params.quality >= 95) {
        await runFfmpegHls({
          inputPath,
          outputDir,
          mimeType: params.mimeType,
          quality: params.quality,
          copy: false,
        });
      } else {
        throw err;
      }
    }

    return { tmpDir, outputDir };
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

export async function enqueueStreamJob(input: StreamJobInput) {
  const existing = await db
    .select({ id: streamJobs.id, status: streamJobs.status })
    .from(streamJobs)
    .where(
      and(eq(streamJobs.userId, input.userId), eq(streamJobs.fileId, input.fileId)),
    )
    .orderBy(desc(streamJobs.createdAt))
    .limit(1);

  const row = existing[0];
  if (row?.status === "queued" || row?.status === "processing") return row.id;
  if (row?.status === "ready") return null;

  if (row?.status === "failed") {
    await db
      .update(streamJobs)
      .set({
        status: "queued",
        error: null,
        updatedAt: new Date(),
        quality: input.quality ?? null,
      })
      .where(eq(streamJobs.id, row.id));
    return row.id;
  }

  const [inserted] = await db
    .insert(streamJobs)
    .values({
      userId: input.userId,
      fileId: input.fileId,
      status: "queued",
      quality: input.quality ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: streamJobs.id });

  return inserted?.id ?? null;
}

type StreamJobRow = typeof streamJobs.$inferSelect;

async function processStreamJob(job: StreamJobRow) {
  await db
    .update(streamJobs)
    .set({ status: "processing", updatedAt: new Date(), error: null })
    .where(eq(streamJobs.id, job.id));

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, job.fileId), eq(files.userId, job.userId)))
    .limit(1);

  if (!file) {
    await db
      .update(streamJobs)
      .set({
        status: "failed",
        error: "File not found",
        updatedAt: new Date(),
      })
      .where(eq(streamJobs.id, job.id));
    return;
  }

  if (!isStreamSupported(file.mimeType)) {
    await db
      .update(streamJobs)
      .set({
        status: "failed",
        error: "Stream not supported for this file type",
        updatedAt: new Date(),
      })
      .where(eq(streamJobs.id, job.id));
    return;
  }

  const driver = (file.storageDriver || "local") as StorageDriver;
  const playlistName = streamAssetStoredName(file.id, streamPlaylistName());

  try {
    const existing = await statFromStorage(
      { userId: file.userId, storedName: playlistName },
      { driver },
    );
    if (existing) {
      await db
        .update(streamJobs)
        .set({
          status: "ready",
          outputMimeType: "application/vnd.apple.mpegurl",
          outputSize: existing.size,
          updatedAt: new Date(),
          error: null,
        })
        .where(eq(streamJobs.id, job.id));
      return;
    }

    const quality = Number.isFinite(job.quality ?? NaN)
      ? Math.min(100, Math.max(1, Number(job.quality)))
      : 85;

    const output = await generateHls({
      userId: file.userId,
      storedName: file.storedName,
      driver,
      mimeType: file.mimeType,
      quality,
    });

    let totalSize = 0;
    try {
      totalSize = await uploadHlsOutput({
        userId: file.userId,
        fileId: file.id,
        driver,
        outputDir: output.outputDir,
      });
    } finally {
      await rm(output.tmpDir, { recursive: true, force: true });
    }

    await db
      .update(streamJobs)
      .set({
        status: "ready",
        outputMimeType: "application/vnd.apple.mpegurl",
        outputSize: totalSize,
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(streamJobs.id, job.id));

    await createNotification({
      userId: file.userId,
      title: "Stream ready",
      message: `${file.originalName} is ready for streaming.`,
      type: "media",
      data: { fileId: file.id, slug: file.slug },
    });
  } catch (err) {
    const msg = String((err as Error)?.message || "Stream failed").slice(
      0,
      1024,
    );
    await db
      .update(streamJobs)
      .set({
        status: "failed",
        error: msg,
        updatedAt: new Date(),
      })
      .where(eq(streamJobs.id, job.id));
  }
}

export async function runStreamJobById(jobId: string) {
  const [job] = await db
    .select()
    .from(streamJobs)
    .where(eq(streamJobs.id, jobId))
    .limit(1);
  if (!job || job.status !== "queued") return { processed: 0 };
  await processStreamJob(job);
  return { processed: 1 };
}

export async function runStreamJobs(limit = 1) {
  const { queueLimit, concurrency } = resolveStreamJobLimits(limit);
  const jobs = await db
    .select()
    .from(streamJobs)
    .where(eq(streamJobs.status, "queued"))
    .orderBy(streamJobs.createdAt)
    .limit(queueLimit);

  if (!jobs.length) return { processed: 0 };

  const queue = [...jobs];
  const workerCount = Math.min(concurrency, queue.length);
  const results = await Promise.all(
    Array.from({ length: workerCount }, async () => {
      let processed = 0;
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) break;
        await processStreamJob(job);
        processed += 1;
      }
      return processed;
    }),
  );

  return {
    processed: results.reduce((sum, count) => sum + count, 0),
  };
}

let streamRunnerActive = false;
const pendingJobIds = new Set<string>();
let pendingBatchRun = false;

export async function kickStreamRunner(params?: {
  limit?: number;
  jobId?: string | null;
}) {
  if (params?.jobId) {
    pendingJobIds.add(params.jobId);
  } else {
    pendingBatchRun = true;
  }

  if (streamRunnerActive) return { processed: 0 };
  streamRunnerActive = true;

  const run = async () => {
    let processed = 0;
    while (pendingJobIds.size > 0) {
      const [jobId] = pendingJobIds;
      if (!jobId) break;
      pendingJobIds.delete(jobId);
      const res = await runStreamJobById(jobId);
      processed += res.processed;
    }

    if (pendingBatchRun) {
      pendingBatchRun = false;
      const limit = typeof params?.limit === "number" ? params.limit : 1;
      const res = await runStreamJobs(limit);
      processed += res.processed;
    }

    return { processed };
  };

  try {
    return await run();
  } finally {
    streamRunnerActive = false;
    if (pendingJobIds.size > 0 || pendingBatchRun) {
      setImmediate(() => {
        void kickStreamRunner().catch(() => {});
      });
    }
  }
}

export async function enqueueMissingStreams(limit = 10) {
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10;
  const candidates = await db
    .select({
      id: files.id,
      userId: files.userId,
      mimeType: files.mimeType,
    })
    .from(files)
    .where(
      or(
        sql`${files.mimeType} LIKE 'video/%'`,
        sql`${files.mimeType} LIKE 'audio/%'`,
      ),
    )
    .orderBy(desc(files.createdAt))
    .limit(count);

  let enqueued = 0;
  for (const f of candidates) {
    if (!isStreamSupported(f.mimeType)) continue;
    await enqueueStreamJob({ userId: f.userId, fileId: f.id });
    enqueued += 1;
  }

  return { enqueued };
}
