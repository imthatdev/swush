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

import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminJobRuns } from "@/db/schemas";
import { requireOwner } from "@/lib/security/roles";
import { withApiError } from "@/lib/server/api-error";
import {
  runAnilistWatchingJob,
  runMediaOptimizationJob,
  runPreviewGenerationJob,
  runStreamGenerationJob,
  runStorageCleanupJob,
} from "@/lib/server/cron-jobs";

const JOBS = [
  "media-optimization",
  "preview-generation",
  "stream-generation",
  "storage-cleanup",
  "anilist-watching",
] as const;
type JobName = (typeof JOBS)[number];

export const GET = withApiError(async function GET(req: NextRequest) {
  await requireOwner();
  const url = new URL(req.url);
  const limit = Math.min(50, Number(url.searchParams.get("limit") || 10));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  const rows = await db
    .select()
    .from(adminJobRuns)
    .orderBy(desc(adminJobRuns.startedAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(adminJobRuns);

  return NextResponse.json({ items: rows, total, limit, offset });
});

export const POST = withApiError(async function POST(req: NextRequest) {
  const user = await requireOwner();
  const body = await req.json().catch(() => ({}));
  const job = typeof body?.job === "string" ? body.job : "";
  const limit = Number(body?.limit || 3);

  if (!JOBS.includes(job as JobName)) {
    return NextResponse.json({ error: "Invalid job" }, { status: 400 });
  }

  const [run] = await db
    .insert(adminJobRuns)
    .values({
      actorUserId: user.id,
      job,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  try {
    let result: Record<string, unknown>;
    if (job === "media-optimization") {
      result = await runMediaOptimizationJob(limit);
    } else if (job === "preview-generation") {
      result = await runPreviewGenerationJob(limit);
    } else if (job === "stream-generation") {
      result = await runStreamGenerationJob(limit);
    } else if (job === "storage-cleanup") {
      result = await runStorageCleanupJob(limit);
    } else {
      result = await runAnilistWatchingJob();
    }

    const [updated] = await db
      .update(adminJobRuns)
      .set({
        status: "success",
        result,
        finishedAt: new Date(),
      })
      .where(eq(adminJobRuns.id, run.id))
      .returning();

    return NextResponse.json({ status: true, run: updated });
  } catch (err) {
    const message = (err as Error)?.message || "Job failed";
    const [updated] = await db
      .update(adminJobRuns)
      .set({
        status: "failed",
        error: message,
        finishedAt: new Date(),
      })
      .where(eq(adminJobRuns.id, run.id))
      .returning();

    return NextResponse.json(
      { status: false, error: message, run: updated },
      { status: 500 },
    );
  }
});

export const DELETE = withApiError(async function DELETE() {
  await requireOwner();
  await db.delete(adminJobRuns);
  return NextResponse.json({ status: true });
});
