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

import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type {
  AdminQueueHealth,
  AdminQueueHealthRow,
} from "@/types/admin-queue-health";
import { getBackgroundWorkloadState } from "@/lib/server/background-workload";
import { getJobRunnerRole } from "@/lib/server/job-runner-role";
import { getMediaRunnerState } from "@/lib/server/media-jobs";
import { getRemoteUploadRunnerState } from "@/lib/server/remote-upload-jobs";

type AggregateRow = {
  queue_depth: number | string | null;
  delayed: number | string | null;
  processing: number | string | null;
  dead_letter: number | string | null;
  wait_avg_sec: number | string | null;
  wait_p95_sec: number | string | null;
  failed_24h: number | string | null;
  success_24h: number | string | null;
};

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeAggregate(row?: AggregateRow) {
  const queueDepth = toNumber(row?.queue_depth);
  const delayed = toNumber(row?.delayed);
  const processing = toNumber(row?.processing);
  const deadLetter = toNumber(row?.dead_letter);
  const waitAvgSec = toNumber(row?.wait_avg_sec);
  const waitP95Sec = toNumber(row?.wait_p95_sec);
  const failed24h = toNumber(row?.failed_24h);
  const succeeded24h = toNumber(row?.success_24h);
  const denom = failed24h + succeeded24h;

  return {
    queueDepth,
    delayed,
    processing,
    deadLetter,
    waitAvgSec,
    waitP95Sec,
    failed24h,
    succeeded24h,
    failureRate24h: denom > 0 ? failed24h / denom : 0,
  };
}

async function queryAggregate(query: ReturnType<typeof sql>) {
  const result = await db.execute(query);
  const row = (result.rows?.[0] || undefined) as AggregateRow | undefined;
  return normalizeAggregate(row);
}

function makeQueueRow(input: {
  key: string;
  label: string;
  stats: ReturnType<typeof normalizeAggregate>;
  activeWorkers?: number;
}): AdminQueueHealthRow {
  return {
    key: input.key,
    label: input.label,
    queueDepth: input.stats.queueDepth,
    delayed: input.stats.delayed,
    processing: input.stats.processing,
    activeWorkers:
      typeof input.activeWorkers === "number"
        ? Math.max(0, Math.floor(input.activeWorkers))
        : Math.max(0, Math.floor(input.stats.processing)),
    waitAvgSec: input.stats.waitAvgSec,
    waitP95Sec: input.stats.waitP95Sec,
    failureRate24h: input.stats.failureRate24h,
    failed24h: input.stats.failed24h,
    succeeded24h: input.stats.succeeded24h,
    deadLetter: input.stats.deadLetter,
  };
}

export async function getAdminQueueHealth(): Promise<AdminQueueHealth> {
  const [previewStats, streamStats, mediaStats, remoteStats, cleanupStats] =
    await Promise.all([
      queryAggregate(sql`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at <= now() THEN 1 ELSE 0 END), 0)::int AS queue_depth,
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at > now() THEN 1 ELSE 0 END), 0)::int AS delayed,
          COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)::int AS processing,
          COALESCE(SUM(CASE WHEN status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS dead_letter,
          COALESCE(AVG(CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_avg_sec,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_p95_sec,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS failed_24h,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status = 'ready' THEN 1 ELSE 0 END), 0)::int AS success_24h
        FROM preview_jobs
      `),
      queryAggregate(sql`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at <= now() THEN 1 ELSE 0 END), 0)::int AS queue_depth,
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at > now() THEN 1 ELSE 0 END), 0)::int AS delayed,
          COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)::int AS processing,
          COALESCE(SUM(CASE WHEN status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS dead_letter,
          COALESCE(AVG(CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_avg_sec,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_p95_sec,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS failed_24h,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status = 'ready' THEN 1 ELSE 0 END), 0)::int AS success_24h
        FROM stream_jobs
      `),
      queryAggregate(sql`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at <= now() THEN 1 ELSE 0 END), 0)::int AS queue_depth,
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at > now() THEN 1 ELSE 0 END), 0)::int AS delayed,
          COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)::int AS processing,
          COALESCE(SUM(CASE WHEN status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS dead_letter,
          COALESCE(AVG(CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_avg_sec,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_p95_sec,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS failed_24h,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status = 'ready' THEN 1 ELSE 0 END), 0)::int AS success_24h
        FROM media_jobs
      `),
      queryAggregate(sql`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at <= now() THEN 1 ELSE 0 END), 0)::int AS queue_depth,
          COALESCE(SUM(CASE WHEN status = 'queued' AND next_run_at > now() THEN 1 ELSE 0 END), 0)::int AS delayed,
          COALESCE(SUM(CASE WHEN status IN ('downloading', 'processing') THEN 1 ELSE 0 END), 0)::int AS processing,
          COALESCE(SUM(CASE WHEN status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS dead_letter,
          COALESCE(AVG(CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_avg_sec,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CASE WHEN status = 'queued' AND next_run_at <= now() THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_p95_sec,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status IN ('dead-letter', 'failed') THEN 1 ELSE 0 END), 0)::int AS failed_24h,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status = 'completed' THEN 1 ELSE 0 END), 0)::int AS success_24h
        FROM remote_upload_jobs
      `),
      queryAggregate(sql`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0)::int AS queue_depth,
          0::int AS delayed,
          COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)::int AS processing,
          COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0)::int AS dead_letter,
          COALESCE(AVG(CASE WHEN status = 'queued' THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_avg_sec,
          COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY CASE WHEN status = 'queued' THEN EXTRACT(EPOCH FROM (now() - created_at)) END), 0)::float AS wait_p95_sec,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed_24h,
          COALESCE(SUM(CASE WHEN updated_at >= now() - interval '24 hours' AND status = 'ready' THEN 1 ELSE 0 END), 0)::int AS success_24h
        FROM storage_cleanup_jobs
      `),
    ]);

  const workload = getBackgroundWorkloadState();
  const mediaRunner = getMediaRunnerState();
  const remoteRunner = getRemoteUploadRunnerState();

  return {
    generatedAt: new Date().toISOString(),
    runnerRole: getJobRunnerRole(),
    workload: {
      adaptiveEnabled: workload.adaptiveEnabled,
      cpu: workload.lanes.cpu,
      io: workload.lanes.io,
      signals: workload.signals,
    },
    queues: [
      makeQueueRow({
        key: "preview",
        label: "Preview",
        stats: previewStats,
      }),
      makeQueueRow({
        key: "stream",
        label: "Stream",
        stats: streamStats,
      }),
      makeQueueRow({
        key: "media",
        label: "Media",
        stats: mediaStats,
        activeWorkers: mediaRunner.activeWorkers,
      }),
      makeQueueRow({
        key: "remote-upload",
        label: "Remote Upload",
        stats: remoteStats,
        activeWorkers: remoteRunner.activeWorkers,
      }),
      makeQueueRow({
        key: "storage-cleanup",
        label: "Storage Cleanup",
        stats: cleanupStats,
      }),
    ],
  };
}
