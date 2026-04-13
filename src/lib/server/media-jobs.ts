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

import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { files, mediaJobs } from "@/db/schemas";
import {
  getDefaultStorageDriver,
  readFromStorage,
  putFileToStorage,
  type StorageDriver,
} from "@/lib/storage";
import {
  optimizeImageBuffer,
  transcodeMediaBuffer,
} from "@/lib/server/media-optimization";
import { createNotification } from "@/lib/server/notifications";
import { runWithBackgroundCpuSlots } from "@/lib/server/background-workload";
import { buildRetryPlan, resolveJobMaxAttempts } from "@/lib/server/job-retry";
import { isJobExecutionEnabled } from "@/lib/server/job-runner-role";

export type MediaJobKind = "image" | "video" | "audio";

type MediaJobInput = {
  userId: string;
  fileId: string;
  kind: MediaJobKind;
  quality?: number;
};

function readPositiveInt(value?: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

const MEDIA_IMAGE_JOB_CPU_SLOTS =
  readPositiveInt(process.env.MEDIA_IMAGE_JOB_CPU_SLOTS) ?? 1;
const MEDIA_TRANSCODE_JOB_CPU_SLOTS =
  readPositiveInt(process.env.MEDIA_TRANSCODE_JOB_CPU_SLOTS) ?? 2;
const MEDIA_JOB_MAX_ATTEMPTS = resolveJobMaxAttempts(
  readPositiveInt(process.env.MEDIA_JOB_MAX_ATTEMPTS),
);

let mediaRunnerInFlight = 0;
let mediaWorkersInUse = 0;

function resolveMediaJobLimits(requestedLimit?: number) {
  const hardMax = 20;
  const defaultQueue = 10;
  const defaultConcurrency = 2;
  const requested =
    Number.isFinite(requestedLimit) && (requestedLimit as number) > 0
      ? Math.floor(requestedLimit as number)
      : 3;

  const envQueue = readPositiveInt(process.env.MEDIA_JOBS_QUEUE_LIMIT);
  const envConcurrency = readPositiveInt(process.env.MEDIA_JOBS_CONCURRENCY);
  const queueCap = Math.min(envQueue ?? defaultQueue, hardMax);
  const queueLimit = Math.min(requested, queueCap);
  const concurrency = Math.min(
    queueLimit,
    envConcurrency ?? defaultConcurrency,
  );

  return { queueLimit, concurrency };
}

function resolveMediaJobCpuSlots(kind: string) {
  if (kind === "image") return MEDIA_IMAGE_JOB_CPU_SLOTS;
  return MEDIA_TRANSCODE_JOB_CPU_SLOTS;
}

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readStorageBuffer(
  target: { userId: string; storedName: string },
  driver: StorageDriver,
) {
  const res = await readFromStorage(target, { driver });
  if (!res) return null;
  return streamToBuffer(res.stream);
}

export async function enqueueMediaJob(input: MediaJobInput) {
  await db.insert(mediaJobs).values({
    userId: input.userId,
    fileId: input.fileId,
    kind: input.kind,
    quality: input.quality ?? 80,
    status: "queued",
    attempts: 0,
    maxAttempts: MEDIA_JOB_MAX_ATTEMPTS,
    nextRunAt: new Date(),
    deadLetterAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

type MediaJobRow = typeof mediaJobs.$inferSelect;

async function markMediaDeadLetter(job: MediaJobRow, message: string) {
  const maxAttempts = resolveJobMaxAttempts(job.maxAttempts);
  await db
    .update(mediaJobs)
    .set({
      status: "dead-letter",
      attempts: Math.max(job.attempts ?? 0, maxAttempts),
      maxAttempts,
      deadLetterAt: new Date(),
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(mediaJobs.id, job.id));
}

async function scheduleMediaRetry(job: MediaJobRow, message: string) {
  const retry = buildRetryPlan({
    currentAttempts: job.attempts,
    maxAttempts: job.maxAttempts,
  });

  if (!retry.shouldRetry || !retry.nextRunAt) {
    await markMediaDeadLetter(job, message);
    return;
  }

  await db
    .update(mediaJobs)
    .set({
      status: "queued",
      attempts: retry.attempts,
      maxAttempts: retry.maxAttempts,
      nextRunAt: retry.nextRunAt,
      deadLetterAt: null,
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(mediaJobs.id, job.id));
}

async function processMediaJob(job: MediaJobRow) {
  await db
    .update(mediaJobs)
    .set({ status: "processing", updatedAt: new Date(), error: null })
    .where(eq(mediaJobs.id, job.id));

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, job.fileId), eq(files.userId, job.userId)))
    .limit(1);

  if (!file) {
    await markMediaDeadLetter(job, "File not found");
    return;
  }

  const driver = (file.storageDriver ||
    (await getDefaultStorageDriver())) as StorageDriver;
  try {
    const buffer = await readStorageBuffer(
      { userId: file.userId, storedName: file.storedName },
      driver,
    );
    if (!buffer) {
      throw new Error("Failed to load stored file");
    }

    const optimized =
      job.kind === "image"
        ? await optimizeImageBuffer(buffer, file.mimeType, job.quality)
        : await transcodeMediaBuffer(buffer, file.mimeType, job.quality);

    await putFileToStorage({
      target: { userId: file.userId, storedName: file.storedName },
      buffer: optimized.buffer,
      contentType: optimized.mimeType,
      driver,
    });

    await db
      .update(files)
      .set({ mimeType: optimized.mimeType, size: optimized.buffer.length })
      .where(eq(files.id, file.id));

    await db
      .update(mediaJobs)
      .set({
        status: "ready",
        attempts: 0,
        maxAttempts: resolveJobMaxAttempts(job.maxAttempts),
        nextRunAt: new Date(),
        deadLetterAt: null,
        outputMimeType: optimized.mimeType,
        outputSize: optimized.buffer.length,
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(mediaJobs.id, job.id));

    await createNotification({
      userId: file.userId,
      title: "Media optimized",
      message: `${file.originalName} is ready.`,
      type: "media",
      data: { fileId: file.id, slug: file.slug },
    });
  } catch (err) {
    const msg = String((err as Error)?.message || "Optimization failed").slice(
      0,
      1024,
    );
    await scheduleMediaRetry(job, msg);

    await createNotification({
      userId: file.userId,
      title: "Media optimization failed",
      message: `${file.originalName} could not be optimized.`,
      type: "media",
      data: { fileId: file.id, slug: file.slug },
    });
  }
}

export async function runMediaJobs(limit = 3) {
  if (!isJobExecutionEnabled()) return { processed: 0 };

  mediaRunnerInFlight += 1;

  try {
    const { queueLimit, concurrency } = resolveMediaJobLimits(limit);
    const jobs = await db
      .select()
      .from(mediaJobs)
      .where(
        and(
          eq(mediaJobs.status, "queued"),
          lte(mediaJobs.nextRunAt, new Date()),
          inArray(mediaJobs.kind, ["image", "video", "audio"]),
        ),
      )
      .orderBy(mediaJobs.createdAt)
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

          mediaWorkersInUse += 1;
          try {
            await runWithBackgroundCpuSlots(
              resolveMediaJobCpuSlots(job.kind),
              () => processMediaJob(job),
            );
          } finally {
            mediaWorkersInUse = Math.max(0, mediaWorkersInUse - 1);
          }
          processed += 1;
        }

        return processed;
      }),
    );

    return { processed: results.reduce((sum, count) => sum + count, 0) };
  } finally {
    mediaRunnerInFlight = Math.max(0, mediaRunnerInFlight - 1);
  }
}

export function getMediaRunnerState() {
  return {
    activeRuns: mediaRunnerInFlight,
    activeWorkers: mediaWorkersInUse,
  };
}
