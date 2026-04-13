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

import { runMediaJobs } from "@/lib/server/media-jobs";
import { kickPreviewRunner } from "@/lib/server/preview-jobs";
import { kickStreamRunner } from "@/lib/server/stream-jobs";
import { kickExportRunner } from "@/lib/server/export-jobs";
import { kickStorageCleanupRunner } from "@/lib/server/storage-cleanup-jobs";
import { releaseRedisLock, tryAcquireRedisLock } from "@/lib/server/redis";
import {
  isApiOnlyRole,
  isJobExecutionEnabled,
  isWorkerOnlyRole,
} from "@/lib/server/job-runner-role";
import { kickRemoteUploadRunner } from "@/lib/server/remote-upload-jobs";
import { kickBookmarkRssRunner } from "@/lib/server/bookmark-rss";

declare global {
  var __swushBackgroundWorkerLoopStarted: boolean | undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

const workerIntervalMs = parsePositiveInt(
  process.env.WORKER_LOOP_INTERVAL_MS,
  3_000,
);
const previewTickLimit = parsePositiveInt(
  process.env.WORKER_PREVIEW_TICK_LIMIT,
  5,
);
const streamTickLimit = parsePositiveInt(
  process.env.WORKER_STREAM_TICK_LIMIT,
  5,
);
const mediaTickLimit = parsePositiveInt(process.env.WORKER_MEDIA_TICK_LIMIT, 4);
const exportTickLimit = parsePositiveInt(
  process.env.WORKER_EXPORT_TICK_LIMIT,
  1,
);
const cleanupTickLimit = parsePositiveInt(
  process.env.WORKER_CLEANUP_TICK_LIMIT,
  5,
);
const bookmarkRssTickLimit = parsePositiveInt(
  process.env.WORKER_BOOKMARK_RSS_TICK_LIMIT,
  2,
);
const workerLockTtlMs = parsePositiveInt(
  process.env.WORKER_LOOP_LOCK_TTL_MS,
  Math.max(2 * workerIntervalMs, 8_000),
);

let tickRunning = false;

async function runWorkerTick() {
  if (tickRunning || !isJobExecutionEnabled()) return;
  tickRunning = true;

  const { lock, available } = await tryAcquireRedisLock(
    "worker-loop:tick",
    workerLockTtlMs,
  );
  if (available && !lock) {
    tickRunning = false;
    return;
  }

  try {
    kickRemoteUploadRunner();

    await Promise.allSettled([
      kickPreviewRunner({ limit: previewTickLimit }),
      kickStreamRunner({ limit: streamTickLimit }),
      runMediaJobs(mediaTickLimit),
      kickExportRunner({ limit: exportTickLimit }),
      kickStorageCleanupRunner({ limit: cleanupTickLimit }),
      kickBookmarkRssRunner({ limit: bookmarkRssTickLimit }),
    ]);
  } finally {
    await releaseRedisLock(lock);
    tickRunning = false;
  }
}

export function startBackgroundJobWorkerLoop() {
  if (globalThis.__swushBackgroundWorkerLoopStarted) return;
  if (!isJobExecutionEnabled()) return;
  if (
    (process.env.ENABLE_BACKGROUND_WORKER_LOOP || "true")
      .trim()
      .toLowerCase() === "false"
  ) {
    return;
  }

  globalThis.__swushBackgroundWorkerLoopStarted = true;

  if (isApiOnlyRole()) return;

  const label = isWorkerOnlyRole() ? "worker" : "api+worker";
  console.info(`background-worker-loop: started (${label})`, {
    intervalMs: workerIntervalMs,
  });

  void runWorkerTick();

  const timer = setInterval(() => {
    void runWorkerTick();
  }, workerIntervalMs);

  timer.unref();
}
