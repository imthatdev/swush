/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import "server-only";

import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { remoteUploadJobs } from "@/db/schemas";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { downloadWithYtDlp } from "@/lib/server/yt-dlp";
import { getDefaultStorageDriver, putStreamToStorage } from "@/lib/storage";
import { files as filesTable } from "@/db/schemas/core-schema";
import path from "path";
import { createReadStream } from "fs";
import { open, rm, stat } from "fs/promises";
import { enqueuePreviewJob, kickPreviewRunner } from "./preview-jobs";
import { enqueueStreamJob, kickStreamRunner } from "./stream-jobs";
import { createNotification } from "./notifications";
import { getUserUploadSettings } from "@/lib/server/upload-settings";
import { assertSafeExternalHttpUrl } from "@/lib/security/url";
import { runWithBackgroundIoSlots } from "@/lib/server/background-workload";
import { buildRetryPlan, resolveJobMaxAttempts } from "@/lib/server/job-retry";
import { isJobExecutionEnabled } from "@/lib/server/job-runner-role";

export type RemoteUploadJobStatus =
  | "queued"
  | "downloading"
  | "processing"
  | "completed"
  | "failed"
  | "dead-letter";

export type RemoteUploadJob = {
  id: string;
  userId: string;
  url: string;
  name?: string | null;
  status: RemoteUploadJobStatus;
  percent: number;
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date;
  deadLetterAt?: Date | null;
  fileId?: string | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const REMOTE_UPLOAD_DEFAULT_CONCURRENCY = 2;

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.floor(parsed));
}

const REMOTE_UPLOAD_MAX_CONCURRENCY = (() => {
  return readPositiveInt(
    process.env.REMOTE_UPLOAD_JOBS_CONCURRENCY,
    REMOTE_UPLOAD_DEFAULT_CONCURRENCY,
  );
})();
const REMOTE_UPLOAD_IO_SLOTS = readPositiveInt(
  process.env.REMOTE_UPLOAD_IO_SLOTS,
  1,
);
const REMOTE_UPLOAD_MAX_ATTEMPTS = resolveJobMaxAttempts(
  readPositiveInt(process.env.REMOTE_UPLOAD_MAX_ATTEMPTS, 0),
);
const REMOTE_UPLOAD_PROGRESS_UPDATE_MS = (() => {
  const parsed = Number(process.env.REMOTE_UPLOAD_PROGRESS_UPDATE_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1200;
  return Math.max(250, Math.floor(parsed));
})();
const REMOTE_UPLOAD_PROGRESS_STEP = (() => {
  const parsed = Number(process.env.REMOTE_UPLOAD_PROGRESS_STEP);
  if (!Number.isFinite(parsed) || parsed <= 0) return 2;
  return Math.max(1, Math.floor(parsed));
})();

let remoteUploadRunnerWorkers = 0;

function appendExtIfMissing(name: string, ext: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (!ext || trimmed.toLowerCase().endsWith(ext.toLowerCase())) return trimmed;
  return `${trimmed}${ext}`;
}

export async function createRemoteUploadJob(
  userId: string,
  url: string,
  name?: string,
): Promise<RemoteUploadJob> {
  const id = nanoid();
  const now = new Date();
  const job: RemoteUploadJob = {
    id,
    userId,
    url,
    name,
    status: "queued",
    percent: 0,
    attempts: 0,
    maxAttempts: REMOTE_UPLOAD_MAX_ATTEMPTS,
    nextRunAt: now,
    deadLetterAt: null,
    fileId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(remoteUploadJobs).values(job);
  kickRemoteUploadRunner();
  return job;
}

export async function getRemoteUploadJob(
  id: string,
): Promise<RemoteUploadJob | null> {
  const rows = await db
    .select()
    .from(remoteUploadJobs)
    .where(eq(remoteUploadJobs.id, id));
  if (!rows[0]) return null;
  return {
    ...rows[0],
    status: rows[0].status as RemoteUploadJobStatus,
  };
}

export async function listRemoteUploadJobs(
  userId: string,
): Promise<RemoteUploadJob[]> {
  const rows = await db
    .select()
    .from(remoteUploadJobs)
    .where(eq(remoteUploadJobs.userId, userId))
    .orderBy(remoteUploadJobs.createdAt);
  return rows.map((row) => ({
    ...row,
    status: row.status as RemoteUploadJobStatus,
  }));
}

async function claimNextRemoteUploadJob(): Promise<RemoteUploadJob | null> {
  const [next] = await db
    .select()
    .from(remoteUploadJobs)
    .where(
      and(
        eq(remoteUploadJobs.status, "queued"),
        lte(remoteUploadJobs.nextRunAt, new Date()),
      ),
    )
    .orderBy(asc(remoteUploadJobs.createdAt))
    .limit(1);

  if (!next) return null;

  const [claimed] = await db
    .update(remoteUploadJobs)
    .set({
      status: "downloading",
      percent: 0,
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(remoteUploadJobs.id, next.id),
        eq(remoteUploadJobs.status, "queued"),
      ),
    )
    .returning();

  if (!claimed) return null;

  return {
    ...claimed,
    status: claimed.status as RemoteUploadJobStatus,
  };
}

async function runRemoteUploadWorker() {
  if (!isJobExecutionEnabled()) return;

  while (true) {
    const next = await claimNextRemoteUploadJob();
    if (!next) return;
    await runWithBackgroundIoSlots(REMOTE_UPLOAD_IO_SLOTS, () =>
      runRemoteUploadJob(next),
    );
  }
}

export function kickRemoteUploadRunner() {
  if (!isJobExecutionEnabled()) return;

  while (remoteUploadRunnerWorkers < REMOTE_UPLOAD_MAX_CONCURRENCY) {
    remoteUploadRunnerWorkers += 1;
    setImmediate(() => {
      void runRemoteUploadWorker()
        .catch(() => {})
        .finally(() => {
          remoteUploadRunnerWorkers = Math.max(
            0,
            remoteUploadRunnerWorkers - 1,
          );
        });
    });
  }
}

async function markRemoteUploadDeadLetter(
  job: RemoteUploadJob,
  message: string,
) {
  const maxAttempts = resolveJobMaxAttempts(job.maxAttempts);
  await db
    .update(remoteUploadJobs)
    .set({
      status: "dead-letter",
      attempts: Math.max(job.attempts ?? 0, maxAttempts),
      maxAttempts,
      deadLetterAt: new Date(),
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(remoteUploadJobs.id, job.id));
}

async function scheduleRemoteUploadRetry(
  job: RemoteUploadJob,
  message: string,
) {
  const retry = buildRetryPlan({
    currentAttempts: job.attempts,
    maxAttempts: job.maxAttempts,
  });

  if (!retry.shouldRetry || !retry.nextRunAt) {
    await markRemoteUploadDeadLetter(job, message);
    return;
  }

  await db
    .update(remoteUploadJobs)
    .set({
      status: "queued",
      attempts: retry.attempts,
      maxAttempts: retry.maxAttempts,
      nextRunAt: retry.nextRunAt,
      deadLetterAt: null,
      error: message,
      updatedAt: new Date(),
    })
    .where(eq(remoteUploadJobs.id, job.id));
}

async function runRemoteUploadJob(initialJob: RemoteUploadJob) {
  let job = initialJob;
  let tempFilePath: string | null = null;

  const update = async (fields: Partial<RemoteUploadJob>) => {
    const now = new Date();
    job = {
      ...job,
      ...fields,
      updatedAt: now,
    };
    await db
      .update(remoteUploadJobs)
      .set({ ...fields, updatedAt: now })
      .where(eq(remoteUploadJobs.id, job.id));
  };

  let lastProgressPercent = Math.max(0, Math.floor(job.percent || 0));
  let lastProgressAt = 0;
  let progressQueue = Promise.resolve();

  const updateProgress = async (rawPercent: number, force = false) => {
    const percent = Math.max(0, Math.min(100, Math.round(rawPercent)));
    const now = Date.now();

    if (!force) {
      if (percent <= lastProgressPercent) return;
      const progressDelta = percent - lastProgressPercent;
      const timeDelta = now - lastProgressAt;
      if (
        progressDelta < REMOTE_UPLOAD_PROGRESS_STEP &&
        timeDelta < REMOTE_UPLOAD_PROGRESS_UPDATE_MS
      ) {
        return;
      }
    }

    lastProgressPercent = percent;
    lastProgressAt = now;
    progressQueue = progressQueue
      .then(() => update({ percent }))
      .catch(() => {});

    if (force) {
      await progressQueue;
    }
  };

  try {
    const safeUrl = assertSafeExternalHttpUrl(job.url);
    const tmp = await downloadWithYtDlp(safeUrl, "remote", async (p) => {
      const percent = Math.max(0, Math.min(80, Math.round((p ?? 0) * 0.8)));
      void updateProgress(percent);
    });
    tempFilePath = tmp.filePath;
    await updateProgress(80, true);
    await update({ status: "processing", percent: 80 });

    const fileStats = await stat(tmp.filePath);
    const size = fileStats.size;
    await update({ percent: 85 });

    const fd = await open(tmp.filePath, "r");
    const signatureBytes = Buffer.alloc(4100);
    let bytesRead = 0;
    try {
      const read = await fd.read(signatureBytes, 0, signatureBytes.length, 0);
      bytesRead = read.bytesRead;
    } finally {
      await fd.close();
    }

    const sig =
      bytesRead > 0
        ? await (async () => {
            const { fileTypeFromBuffer } = await import("file-type");
            return fileTypeFromBuffer(signatureBytes.subarray(0, bytesRead));
          })()
        : null;

    const effectiveMime = sig?.mime || "application/octet-stream";

    const ext = path.extname(tmp.fileName) || "";
    const storedName = `${nanoid()}${ext}`;

    const sourceName = tmp.sourceTitle?.trim();
    const payloadName = job.name?.trim();
    const fallbackName = `remote-${nanoid(8)}`;
    const baseName =
      sourceName && sourceName.length > 0
        ? sourceName
        : payloadName && payloadName.length > 0
          ? payloadName
          : fallbackName;
    const originalName = appendExtIfMissing(baseName, ext);

    const driver = await getDefaultStorageDriver();
    await putStreamToStorage({
      target: { userId: job.userId, storedName },
      stream: createReadStream(tmp.filePath),
      contentType: effectiveMime,
      contentLength: size,
      driver,
    });
    await update({ percent: 90 });

    const [row] = await db
      .insert(filesTable)
      .values({
        userId: job.userId,
        folderId: null,
        originalName,
        storedName,
        storageDriver: driver,
        mimeType: effectiveMime,
        size,
        slug: `${nanoid()}`,
        description: null,
        isPublic: false,
        password: null,
      })
      .returning();
    await update({ percent: 95 });

    if (
      effectiveMime.startsWith("video/") ||
      (effectiveMime.startsWith("image/") && effectiveMime !== "image/svg+xml")
    ) {
      const previewJobId = await enqueuePreviewJob({
        userId: job.userId,
        fileId: row.id,
      });
      if (previewJobId) {
        setImmediate(() => {
          void kickPreviewRunner({ jobId: previewJobId }).catch(() => {});
        });
      }
    }

    if (
      effectiveMime.startsWith("video/") ||
      effectiveMime.startsWith("audio/")
    ) {
      const userSettings = await getUserUploadSettings(job.userId);
      const streamQuality = userSettings.mediaTranscodeEnabled
        ? userSettings.mediaTranscodeQuality
        : 100;
      const streamJobId = await enqueueStreamJob({
        userId: job.userId,
        fileId: row.id,
        quality: streamQuality,
      });
      if (streamJobId) {
        setImmediate(() => {
          void kickStreamRunner({ jobId: streamJobId }).catch(() => {});
        });
      }
    }

    await update({ percent: 100, status: "completed", fileId: row.id });
    await update({ attempts: 0, nextRunAt: new Date(), deadLetterAt: null });
    await createNotification({
      userId: job.userId,
      title: "Remote upload completed",
      message: `Your remote upload for ${job.url} is complete!`,
      type: "remote-upload",
      data: { jobId: job.id, fileId: row.id, url: job.url },
    });
  } catch (err) {
    const message = String(
      (err as Error)?.message || "Remote upload failed",
    ).slice(0, 1024);
    await scheduleRemoteUploadRetry(job, message);
  } finally {
    await progressQueue.catch(() => {});
    if (tempFilePath) {
      await rm(tempFilePath, { force: true }).catch(() => {});
    }
  }
}

export async function deleteRemoteUploadJobs(
  userId: string,
  ids: string[],
): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;
  await db
    .delete(remoteUploadJobs)
    .where(
      and(
        eq(remoteUploadJobs.userId, userId),
        inArray(remoteUploadJobs.id, ids),
      ),
    );
}

setImmediate(() => {
  if (isJobExecutionEnabled()) {
    kickRemoteUploadRunner();
  }
});

export function getRemoteUploadRunnerState() {
  return {
    enabled: isJobExecutionEnabled(),
    activeWorkers: remoteUploadRunnerWorkers,
    maxWorkers: REMOTE_UPLOAD_MAX_CONCURRENCY,
  };
}
