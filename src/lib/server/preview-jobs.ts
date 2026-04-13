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

import { and, desc, eq, lte, or, sql } from "drizzle-orm";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { createWriteStream } from "fs";
import { mkdtemp, readFile, rm } from "fs/promises";
import { pipeline } from "stream/promises";
import os from "os";
import path from "path";
import { db } from "@/db/client";
import { files, previewJobs } from "@/db/schemas";
import {
  getDefaultStorageDriver,
  putFileToStorage,
  readFromStorage,
  statFromStorage,
  type StorageDriver,
} from "@/lib/storage";
import { createNotification } from "@/lib/server/notifications";
import { runWithBackgroundCpuSlots } from "@/lib/server/background-workload";
import { applyBackgroundProcessPriority } from "@/lib/server/process-priority";
import { buildRetryPlan, resolveJobMaxAttempts } from "@/lib/server/job-retry";
import { isJobExecutionEnabled } from "@/lib/server/job-runner-role";
import { releaseRedisLock, tryAcquireRedisLock } from "@/lib/server/redis";
import { resolveWithin } from "@/lib/security/path";

const PREVIEW_JOB_LOCK_TTL_MS = (() => {
  const parsed = Number(process.env.REDIS_PREVIEW_JOB_LOCK_TTL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20 * 60 * 1000;
  return Math.floor(parsed);
})();

function safeFileExt(name: string) {
  const ext = path.extname(name).toLowerCase();
  if (/^\.[a-z0-9]{1,16}$/i.test(ext)) return ext;
  return ".bin";
}

function resolveFfmpegThreads() {
  const parsed = Number(process.env.FFMPEG_THREADS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.floor(parsed));
}

function readPositiveInt(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

const PREVIEW_JOB_CPU_SLOTS =
  readPositiveInt(process.env.PREVIEW_JOB_CPU_SLOTS) ?? 1;
const PREVIEW_JOB_MAX_ATTEMPTS = resolveJobMaxAttempts(
  readPositiveInt(process.env.PREVIEW_JOB_MAX_ATTEMPTS),
);

function resolvePreviewJobLimits(requestedLimit?: number) {
  const hardMax = 50;
  const defaultQueue = 10;
  const defaultConcurrency = 2;
  const requested =
    Number.isFinite(requestedLimit) && (requestedLimit as number) > 0
      ? Math.floor(requestedLimit as number)
      : 3;

  const envQueue = readPositiveInt(process.env.PREVIEW_JOBS_QUEUE_LIMIT);
  const envConcurrency = readPositiveInt(process.env.PREVIEW_JOBS_CONCURRENCY);
  const queueCap = Math.min(envQueue ?? defaultQueue, hardMax);
  const queueLimit = Math.min(requested, queueCap);
  const concurrency = Math.min(
    queueLimit,
    envConcurrency ?? defaultConcurrency,
  );

  return { queueLimit, concurrency };
}

export type PreviewJobStatus =
  | "queued"
  | "processing"
  | "ready"
  | "failed"
  | "dead-letter";

type PreviewJobInput = {
  userId: string;
  fileId: string;
};

function previewStoredName(storedName: string) {
  if (storedName.includes(".")) {
    return storedName.replace(/\.[^.]+$/, ".png");
  }
  return `${storedName}.png`;
}

function isPreviewSupported(mimeType?: string | null) {
  if (!mimeType) return false;
  if (mimeType.startsWith("video/")) return true;
  if (mimeType === "image/gif") return true;
  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml")
    return true;
  return false;
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

async function runFfmpegSnapshot(params: {
  inputPath: string;
  outputPath: string;
  offset: string;
}) {
  const ffmpegCmd =
    process.env.FFMPEG_PATH?.trim() || (ffmpegPath as string) || "ffmpeg";
  const args = [
    "-y",
    "-threads",
    String(resolveFfmpegThreads()),
    "-ss",
    params.offset,
    "-i",
    params.inputPath,
    "-vf",
    "thumbnail,scale=480:-1",
    "-frames:v",
    "1",
    "-f",
    "image2",
    params.outputPath,
  ];

  const ffmpeg = spawn(ffmpegCmd, args);
  applyBackgroundProcessPriority(ffmpeg);
  const stderrChunks: Buffer[] = [];

  ffmpeg.stderr.on("data", (chunk) =>
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
  );

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
}

async function generatePreview(params: {
  userId: string;
  storedName: string;
  driver: StorageDriver;
  mimeType?: string | null;
}) {
  const tmpDir = await mkdtemp(
    `${path.resolve(os.tmpdir())}${path.sep}swush-preview-`,
  );
  const inputExt = safeFileExt(params.storedName);
  const inputPath = resolveWithin(tmpDir, `in-${Date.now()}${inputExt}`);
  const outputPath = resolveWithin(tmpDir, `out-${Date.now()}.png`);

  try {
    const written = await streamStorageToFile(
      { userId: params.userId, storedName: params.storedName },
      params.driver,
      inputPath,
    );
    if (!written) throw new Error("Failed to load stored file");

    if (
      params.mimeType?.startsWith("image/") &&
      params.mimeType !== "image/gif" &&
      params.mimeType !== "image/svg+xml"
    ) {
      return await sharp(inputPath)
        .rotate()
        .resize({ width: 480, withoutEnlargement: true })
        .png({ quality: 80 })
        .toBuffer();
    }

    const offsets = ["00:00:01", "00:00:00"];
    let lastErr: Error | null = null;

    for (const offset of offsets) {
      try {
        await runFfmpegSnapshot({ inputPath, outputPath, offset });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err as Error;
      }
    }

    if (lastErr) throw lastErr;

    const previewBuffer = await readFile(outputPath);
    return previewBuffer;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function enqueuePreviewJob(input: PreviewJobInput) {
  const existing = await db
    .select({ id: previewJobs.id, status: previewJobs.status })
    .from(previewJobs)
    .where(
      and(
        eq(previewJobs.userId, input.userId),
        eq(previewJobs.fileId, input.fileId),
      ),
    )
    .orderBy(desc(previewJobs.createdAt))
    .limit(1);

  const row = existing[0];
  if (row?.status === "queued" || row?.status === "processing") return row.id;
  if (row?.status === "ready") return null;

  if (row?.status === "failed" || row?.status === "dead-letter") {
    await db
      .update(previewJobs)
      .set({
        status: "queued",
        attempts: 0,
        maxAttempts: PREVIEW_JOB_MAX_ATTEMPTS,
        nextRunAt: new Date(),
        deadLetterAt: null,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(previewJobs.id, row.id));
    return row.id;
  }

  const [inserted] = await db
    .insert(previewJobs)
    .values({
      userId: input.userId,
      fileId: input.fileId,
      status: "queued",
      attempts: 0,
      maxAttempts: PREVIEW_JOB_MAX_ATTEMPTS,
      nextRunAt: new Date(),
      deadLetterAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: previewJobs.id });

  return inserted?.id ?? null;
}

type PreviewJobRow = typeof previewJobs.$inferSelect;

async function markPreviewDeadLetter(job: PreviewJobRow, message: string) {
  const maxAttempts = resolveJobMaxAttempts(job.maxAttempts);
  await db
    .update(previewJobs)
    .set({
      status: "dead-letter",
      attempts: Math.max(job.attempts ?? 0, maxAttempts),
      maxAttempts,
      deadLetterAt: new Date(),
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(previewJobs.id, job.id));
}

async function schedulePreviewRetry(job: PreviewJobRow, message: string) {
  const retry = buildRetryPlan({
    currentAttempts: job.attempts,
    maxAttempts: job.maxAttempts,
  });

  if (!retry.shouldRetry || !retry.nextRunAt) {
    await markPreviewDeadLetter(job, message);
    return;
  }

  await db
    .update(previewJobs)
    .set({
      status: "queued",
      attempts: retry.attempts,
      maxAttempts: retry.maxAttempts,
      nextRunAt: retry.nextRunAt,
      deadLetterAt: null,
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(previewJobs.id, job.id));
}

async function processPreviewJob(job: PreviewJobRow) {
  await db
    .update(previewJobs)
    .set({ status: "processing", updatedAt: new Date(), error: null })
    .where(eq(previewJobs.id, job.id));

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, job.fileId), eq(files.userId, job.userId)))
    .limit(1);

  if (!file) {
    await markPreviewDeadLetter(job, "File not found");
    return;
  }

  if (!isPreviewSupported(file.mimeType)) {
    await markPreviewDeadLetter(
      job,
      "Preview not supported for this file type",
    );
    return;
  }

  const driver = (file.storageDriver ||
    (await getDefaultStorageDriver())) as StorageDriver;
  const previewName = previewStoredName(file.storedName);

  try {
    const existing = await statFromStorage(
      { userId: file.userId, storedName: previewName },
      { driver },
    );
    if (existing) {
      await db
        .update(previewJobs)
        .set({
          status: "ready",
          attempts: 0,
          maxAttempts: resolveJobMaxAttempts(job.maxAttempts),
          nextRunAt: new Date(),
          deadLetterAt: null,
          outputMimeType: existing.contentType ?? "image/png",
          outputSize: existing.size,
          updatedAt: new Date(),
          error: null,
        })
        .where(eq(previewJobs.id, job.id));
      return;
    }

    const previewBuffer = await generatePreview({
      userId: file.userId,
      storedName: file.storedName,
      driver,
      mimeType: file.mimeType,
    });

    await putFileToStorage({
      target: { userId: file.userId, storedName: previewName },
      buffer: previewBuffer,
      contentType: "image/png",
      driver,
    });

    await db
      .update(previewJobs)
      .set({
        status: "ready",
        attempts: 0,
        maxAttempts: resolveJobMaxAttempts(job.maxAttempts),
        nextRunAt: new Date(),
        deadLetterAt: null,
        outputMimeType: "image/png",
        outputSize: previewBuffer.length,
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(previewJobs.id, job.id));

    await createNotification({
      userId: file.userId,
      title: "Preview generated",
      message: `${file.originalName} preview is ready.`,
      type: "media",
      data: { fileId: file.id, slug: file.slug },
    });
  } catch (err) {
    const msg = String((err as Error)?.message || "Preview failed").slice(
      0,
      1024,
    );
    await schedulePreviewRetry(job, msg);
  }
}

export async function runPreviewJobById(jobId: string) {
  if (!isJobExecutionEnabled()) return { processed: 0 };

  const { lock, available } = await tryAcquireRedisLock(
    `preview-job:${jobId}`,
    PREVIEW_JOB_LOCK_TTL_MS,
  );
  if (available && !lock) return { processed: 0 };

  try {
    const [job] = await db
      .select()
      .from(previewJobs)
      .where(eq(previewJobs.id, jobId))
      .limit(1);
    if (!job || job.status !== "queued") return { processed: 0 };
    if (job.nextRunAt && job.nextRunAt > new Date()) return { processed: 0 };
    await runWithBackgroundCpuSlots(PREVIEW_JOB_CPU_SLOTS, () =>
      processPreviewJob(job),
    );
    return { processed: 1 };
  } finally {
    await releaseRedisLock(lock);
  }
}

export async function runPreviewJobs(limit = 3) {
  if (!isJobExecutionEnabled()) return { processed: 0 };

  const { queueLimit, concurrency } = resolvePreviewJobLimits(limit);
  const jobs = await db
    .select()
    .from(previewJobs)
    .where(
      and(
        eq(previewJobs.status, "queued"),
        lte(previewJobs.nextRunAt, new Date()),
      ),
    )
    .orderBy(previewJobs.createdAt)
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

        const { lock, available } = await tryAcquireRedisLock(
          `preview-job:${job.id}`,
          PREVIEW_JOB_LOCK_TTL_MS,
        );
        if (available && !lock) continue;

        try {
          await runWithBackgroundCpuSlots(PREVIEW_JOB_CPU_SLOTS, () =>
            processPreviewJob(job),
          );
          processed += 1;
        } finally {
          await releaseRedisLock(lock);
        }
      }

      return processed;
    }),
  );

  return { processed: results.reduce((sum, count) => sum + count, 0) };
}

let previewRunnerActive = false;
const pendingJobIds = new Set<string>();
let pendingBatchRun = false;

export async function kickPreviewRunner(params?: {
  limit?: number;
  jobId?: string | null;
}) {
  if (!isJobExecutionEnabled()) return { processed: 0 };

  if (params?.jobId) {
    pendingJobIds.add(params.jobId);
  } else {
    pendingBatchRun = true;
  }

  if (previewRunnerActive) return { processed: 0 };
  previewRunnerActive = true;

  const run = async () => {
    let processed = 0;
    if (pendingJobIds.size > 0) {
      const jobIds = Array.from(pendingJobIds);
      pendingJobIds.clear();
      const { concurrency } = resolvePreviewJobLimits(jobIds.length);
      const queue = [...jobIds];
      const workerCount = Math.min(concurrency, queue.length);
      const results = await Promise.all(
        Array.from({ length: workerCount }, async () => {
          let localProcessed = 0;
          while (queue.length > 0) {
            const jobId = queue.shift();
            if (!jobId) break;
            const res = await runPreviewJobById(jobId);
            localProcessed += res.processed;
          }
          return localProcessed;
        }),
      );

      processed += results.reduce((sum, count) => sum + count, 0);
    }

    if (pendingBatchRun) {
      pendingBatchRun = false;
      const limit = typeof params?.limit === "number" ? params.limit : 3;
      const res = await runPreviewJobs(limit);
      processed += res.processed;
    }

    return { processed };
  };

  try {
    return await run();
  } finally {
    previewRunnerActive = false;
    if (pendingJobIds.size > 0 || pendingBatchRun) {
      setImmediate(() => {
        void kickPreviewRunner().catch(() => {});
      });
    }
  }
}

export async function enqueueMissingPreviews(limit = 10) {
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
        sql`${files.mimeType} LIKE 'image/%'`,
      ),
    )
    .orderBy(desc(files.createdAt))
    .limit(count);

  let enqueued = 0;
  for (const f of candidates) {
    if (!isPreviewSupported(f.mimeType)) continue;
    await enqueuePreviewJob({ userId: f.userId, fileId: f.id });
    enqueued += 1;
  }

  return { enqueued };
}

export function getPreviewRunnerState() {
  return {
    active: previewRunnerActive,
    pendingById: pendingJobIds.size,
    pendingBatchRun,
  };
}
