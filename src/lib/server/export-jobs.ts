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

import archiver from "archiver";
import { PassThrough } from "stream";
import { createReadStream, createWriteStream } from "fs";
import { mkdtemp, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { exportJobs } from "@/db/schemas";
import { appendExportData, type ExportOptions } from "@/lib/server/export";
import { getDefaultStorageDriver, putStreamToStorage } from "@/lib/storage";
import { createNotification } from "@/lib/server/notifications";
import { resolveWithin } from "@/lib/security/path";
import { isJobExecutionEnabled } from "@/lib/server/job-runner-role";

function sanitizeFileSegment(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
  if (!safe) throw new Error("Invalid path segment");
  return safe;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function resolveExportJobLimits(requestedLimit?: number) {
  const hardMax = 10;
  const defaultQueue = 2;
  const requested =
    Number.isFinite(requestedLimit) && (requestedLimit as number) > 0
      ? Math.floor(requestedLimit as number)
      : 1;
  const envQueue = readPositiveInt(
    process.env.EXPORT_JOBS_QUEUE_LIMIT,
    defaultQueue,
  );
  const queueCap = Math.min(envQueue, hardMax);
  return Math.min(requested, queueCap);
}

async function processExportJob(jobId: string, userId: string) {
  const [job] = await db
    .select()
    .from(exportJobs)
    .where(and(eq(exportJobs.id, jobId), eq(exportJobs.userId, userId)))
    .limit(1);
  if (!job) return;

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const storedName = `exports/${jobId}.zip`;
  const fileName = `swush-backup-${datePart}.zip`;

  try {
    let exportedSize: number | null = null;
    const options = (job.options ?? null) as ExportOptions | null;
    const driver = await getDefaultStorageDriver();
    if (driver === "s3") {
      const tmpDir = await mkdtemp(
        `${path.resolve(os.tmpdir())}${path.sep}swush-export-`,
      );
      const safeJobId = sanitizeFileSegment(jobId);
      const tmpPath = resolveWithin(tmpDir, `${safeJobId}.zip`);
      const archive = archiver("zip", { zlib: { level: 9 } });

      try {
        await new Promise<void>((resolve, reject) => {
          const out = createWriteStream(tmpPath);
          const onError = (err: Error) => reject(err);
          const onWarning = (err: Error & { code?: string }) => {
            if (err.code !== "ENOENT") reject(err);
          };

          out.on("close", () => resolve());
          out.on("error", onError);
          archive.on("error", onError);
          archive.on("warning", onWarning);
          archive.pipe(out);
          appendExportData(archive, userId, options)
            .then(() => archive.finalize())
            .catch(reject);
        });

        const stats = await stat(tmpPath);
        exportedSize = stats.size;
        const stream = createReadStream(tmpPath);
        await putStreamToStorage({
          target: { userId, storedName },
          stream,
          contentType: "application/zip",
          cacheControl: "no-store",
          contentLength: stats.size,
          driver,
        });
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    } else {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const pass = new PassThrough();
      archive.on("warning", (err) => {
        if (err.code !== "ENOENT") {
          pass.destroy(err);
        }
      });
      archive.on("error", (err) => {
        pass.destroy(err);
      });
      archive.pipe(pass);

      const putPromise = putStreamToStorage({
        target: { userId, storedName },
        stream: pass,
        contentType: "application/zip",
        cacheControl: "no-store",
        driver,
      });

      await appendExportData(archive, userId, options);
      await archive.finalize();
      await putPromise;
    }

    await db
      .update(exportJobs)
      .set({
        status: "ready",
        fileName,
        storedName,
        storageDriver: driver,
        size: exportedSize ?? undefined,
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(exportJobs.id, jobId));

    await createNotification({
      userId,
      title: "Export ready",
      message: `Backup ${datePart} is ready to download.`,
      type: "system",
      data: { exportId: jobId },
    });
  } catch (err) {
    await db
      .update(exportJobs)
      .set({
        status: "failed",
        error: (err as Error)?.message || "Export failed",
        updatedAt: new Date(),
      })
      .where(eq(exportJobs.id, jobId));
  }
}

export async function runExportJob(jobId: string, userId: string) {
  if (!isJobExecutionEnabled()) return { processed: 0 };

  const [claimed] = await db
    .update(exportJobs)
    .set({ status: "processing", updatedAt: new Date(), error: null })
    .where(
      and(
        eq(exportJobs.id, jobId),
        eq(exportJobs.userId, userId),
        eq(exportJobs.status, "queued"),
      ),
    )
    .returning({ id: exportJobs.id });

  if (!claimed) return { processed: 0 };

  await processExportJob(jobId, userId);
  return { processed: 1 };
}

export async function runExportJobs(limit = 1) {
  if (!isJobExecutionEnabled()) return { processed: 0 };

  const queueLimit = resolveExportJobLimits(limit);
  const jobs = await db
    .select({ id: exportJobs.id, userId: exportJobs.userId })
    .from(exportJobs)
    .where(eq(exportJobs.status, "queued"))
    .orderBy(asc(exportJobs.createdAt))
    .limit(queueLimit);

  if (!jobs.length) return { processed: 0 };

  let processed = 0;
  for (const job of jobs) {
    const result = await runExportJob(job.id, job.userId);
    processed += result.processed;
  }

  return { processed };
}

let exportRunnerActive = false;
const pendingExportJobIds = new Set<string>();
let pendingExportBatch = false;

export async function kickExportRunner(params?: {
  limit?: number;
  jobId?: string | null;
}) {
  if (!isJobExecutionEnabled()) return { processed: 0 };

  if (params?.jobId) {
    pendingExportJobIds.add(params.jobId);
  } else {
    pendingExportBatch = true;
  }

  if (exportRunnerActive) return { processed: 0 };
  exportRunnerActive = true;

  const run = async (): Promise<{ processed: number }> => {
    let processed = 0;

    while (pendingExportJobIds.size > 0) {
      const [jobId] = pendingExportJobIds;
      if (!jobId) break;
      pendingExportJobIds.delete(jobId);

      const [job] = await db
        .select({
          id: exportJobs.id,
          userId: exportJobs.userId,
          status: exportJobs.status,
        })
        .from(exportJobs)
        .where(eq(exportJobs.id, jobId))
        .limit(1);

      if (!job || job.status !== "queued") continue;

      const result = await runExportJob(job.id, job.userId);
      processed += result.processed;
    }

    if (pendingExportBatch) {
      pendingExportBatch = false;
      const limit = typeof params?.limit === "number" ? params.limit : 1;
      const result = await runExportJobs(limit);
      processed += result.processed;
    }

    if (pendingExportJobIds.size > 0 || pendingExportBatch) {
      return run();
    }

    return { processed };
  };

  try {
    return await run();
  } finally {
    exportRunnerActive = false;
    if (pendingExportJobIds.size > 0 || pendingExportBatch) {
      setImmediate(() => {
        void kickExportRunner().catch(() => {});
      });
    }
  }
}

export function getExportRunnerState() {
  return {
    active: exportRunnerActive,
    pendingById: pendingExportJobIds.size,
    pendingBatch: pendingExportBatch,
  };
}
