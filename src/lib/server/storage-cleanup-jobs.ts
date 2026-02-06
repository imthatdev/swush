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

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storageCleanupJobs } from "@/db/schemas";
import {
  deleteFileFromStorage,
  deletePrefixFromStorage,
  type StorageDriver,
} from "@/lib/storage";

export type StorageCleanupStatus = "queued" | "processing" | "ready" | "failed";

type StorageCleanupInput = {
  userId: string;
  storedName: string;
  driver: StorageDriver;
  isPrefix?: boolean;
};

export async function enqueueStorageCleanupJob(input: StorageCleanupInput) {
  const existing = await db
    .select({ id: storageCleanupJobs.id, status: storageCleanupJobs.status })
    .from(storageCleanupJobs)
    .where(
      and(
        eq(storageCleanupJobs.userId, input.userId),
        eq(storageCleanupJobs.storedName, input.storedName),
        eq(storageCleanupJobs.storageDriver, input.driver),
        eq(storageCleanupJobs.isPrefix, Boolean(input.isPrefix)),
      ),
    )
    .orderBy(desc(storageCleanupJobs.createdAt))
    .limit(1);

  const row = existing[0];
  if (row?.status === "queued" || row?.status === "processing") return row.id;
  if (row?.status === "ready") return null;

  if (row?.status === "failed") {
    await db
      .update(storageCleanupJobs)
      .set({
        status: "queued",
        error: null,
        attempts: 0,
        updatedAt: new Date(),
      })
      .where(eq(storageCleanupJobs.id, row.id));
    return row.id;
  }

  const [inserted] = await db
    .insert(storageCleanupJobs)
    .values({
      userId: input.userId,
      storedName: input.storedName,
      storageDriver: input.driver,
      isPrefix: Boolean(input.isPrefix),
      status: "queued",
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: storageCleanupJobs.id });

  return inserted?.id ?? null;
}

type StorageCleanupRow = typeof storageCleanupJobs.$inferSelect;

async function processStorageCleanupJob(job: StorageCleanupRow) {
  await db
    .update(storageCleanupJobs)
    .set({ status: "processing", updatedAt: new Date(), error: null })
    .where(eq(storageCleanupJobs.id, job.id));

  try {
    if (job.isPrefix) {
      await deletePrefixFromStorage(
        { userId: job.userId, storedName: job.storedName },
        { driver: job.storageDriver as StorageDriver },
      );
    } else {
      await deleteFileFromStorage(
        { userId: job.userId, storedName: job.storedName },
        { driver: job.storageDriver as StorageDriver },
      );
    }

    await db
      .update(storageCleanupJobs)
      .set({ status: "ready", updatedAt: new Date(), error: null })
      .where(eq(storageCleanupJobs.id, job.id));
  } catch (err) {
    const attempts = (job.attempts ?? 0) + 1;
    const fail = attempts >= 3;
    await db
      .update(storageCleanupJobs)
      .set({
        status: fail ? "failed" : "queued",
        attempts,
        error: String((err as Error)?.message || "Cleanup failed").slice(0, 1024),
        updatedAt: new Date(),
      })
      .where(eq(storageCleanupJobs.id, job.id));
  }
}

export async function runStorageCleanupJobById(jobId: string) {
  const [job] = await db
    .select()
    .from(storageCleanupJobs)
    .where(eq(storageCleanupJobs.id, jobId))
    .limit(1);
  if (!job || job.status !== "queued") return { processed: 0 };
  await processStorageCleanupJob(job);
  return { processed: 1 };
}

export async function runStorageCleanupJobs(limit = 3) {
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 3;
  const jobs = await db
    .select()
    .from(storageCleanupJobs)
    .where(eq(storageCleanupJobs.status, "queued"))
    .orderBy(storageCleanupJobs.createdAt)
    .limit(count);

  if (!jobs.length) return { processed: 0 };

  for (const job of jobs) {
    await processStorageCleanupJob(job);
  }

  return { processed: jobs.length };
}

let cleanupRunnerActive = false;
const pendingCleanupIds = new Set<string>();
let pendingCleanupBatch = false;

export async function kickStorageCleanupRunner(params?: {
  limit?: number;
  jobId?: string | null;
}) {
  if (params?.jobId) {
    pendingCleanupIds.add(params.jobId);
  } else {
    pendingCleanupBatch = true;
  }

  if (cleanupRunnerActive) return { processed: 0 };
  cleanupRunnerActive = true;

  const run = async () => {
    let processed = 0;
    while (pendingCleanupIds.size > 0) {
      const [jobId] = pendingCleanupIds;
      if (!jobId) break;
      pendingCleanupIds.delete(jobId);
      const res = await runStorageCleanupJobById(jobId);
      processed += res.processed;
    }

    if (pendingCleanupBatch) {
      pendingCleanupBatch = false;
      const limit = typeof params?.limit === "number" ? params.limit : 3;
      const res = await runStorageCleanupJobs(limit);
      processed += res.processed;
    }

    return { processed };
  };

  try {
    return await run();
  } finally {
    cleanupRunnerActive = false;
    if (pendingCleanupIds.size > 0 || pendingCleanupBatch) {
      setImmediate(() => {
        void kickStorageCleanupRunner().catch(() => {});
      });
    }
  }
}
