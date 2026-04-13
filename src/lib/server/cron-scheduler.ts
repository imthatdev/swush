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

import { CronJob } from "cron";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminJobRuns } from "@/db/schemas";
import { isJobExecutionEnabled } from "@/lib/server/job-runner-role";
import { releaseRedisLock, tryAcquireRedisLock } from "@/lib/server/redis";
import {
  runAnilistWatchingJob,
  runMediaOptimizationJob,
  runPushSubscriptionCleanupJob,
  runPreviewGenerationJob,
  runStreamGenerationJob,
  runStorageCleanupJob,
} from "@/lib/server/cron-jobs";

declare global {
  var __swushCronStarted: boolean | undefined;
}

type JobName =
  | "media-optimization"
  | "preview-generation"
  | "stream-generation"
  | "storage-cleanup"
  | "pwa-subscription-cleanup"
  | "anilist-watching";

const CRON_SCHEDULE = "0 3 * * *";
const CRON_TZ = "Etc/GMT-3";
const CRON_LOCK_TTL_MS = (() => {
  const parsed = Number(process.env.REDIS_CRON_LOCK_TTL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 2 * 60 * 60 * 1000;
  return Math.floor(parsed);
})();

async function recordRun(job: JobName, fn: () => Promise<unknown>) {
  const [run] = await db
    .insert(adminJobRuns)
    .values({
      job,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  try {
    const result = await fn();
    await db
      .update(adminJobRuns)
      .set({
        status: "success",
        result: result as Record<string, unknown>,
        finishedAt: new Date(),
      })
      .where(eq(adminJobRuns.id, run.id));
  } catch (error) {
    const message = (error as Error)?.message || "Job failed";
    await db
      .update(adminJobRuns)
      .set({
        status: "failed",
        error: message,
        finishedAt: new Date(),
      })
      .where(eq(adminJobRuns.id, run.id));
  }
}

async function runScheduledJobs() {
  const cleanupDaysRaw = Number(
    process.env.PWA_SUBSCRIPTION_CLEANUP_DAYS || 30,
  );
  const cleanupDays =
    Number.isFinite(cleanupDaysRaw) && cleanupDaysRaw > 0
      ? Math.floor(cleanupDaysRaw)
      : 30;

  const { lock, available } = await tryAcquireRedisLock(
    "cron:scheduled-jobs",
    CRON_LOCK_TTL_MS,
  );

  if (available && !lock) {
    console.info("cron-scheduler: skipped run because lock is already held");
    return;
  }

  try {
    await recordRun("media-optimization", () => runMediaOptimizationJob(3));
    await recordRun("preview-generation", () => runPreviewGenerationJob(3));
    const streamLimitRaw = Number(process.env.STREAM_JOBS_QUEUE_LIMIT || 15);
    const streamLimit =
      Number.isFinite(streamLimitRaw) && streamLimitRaw > 0
        ? Math.floor(streamLimitRaw)
        : 15;
    await recordRun("stream-generation", () =>
      runStreamGenerationJob(streamLimit),
    );
    await recordRun("storage-cleanup", () => runStorageCleanupJob(3));
    await recordRun("pwa-subscription-cleanup", () =>
      runPushSubscriptionCleanupJob(cleanupDays),
    );
    await recordRun("anilist-watching", () => runAnilistWatchingJob());
  } finally {
    await releaseRedisLock(lock);
  }
}

export function startCronScheduler() {
  if (globalThis.__swushCronStarted) return;
  if (!isJobExecutionEnabled()) return;
  if (process.env.ENABLE_APP_CRON === "false") return;

  globalThis.__swushCronStarted = true;
  const job = new CronJob(
    CRON_SCHEDULE,
    () => {
      void runScheduledJobs();
    },
    null,
    false,
    CRON_TZ,
  );
  job.start();
}
