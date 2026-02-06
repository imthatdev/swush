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
import { and, count, desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { exportJobs } from "@/db/schemas";
import type { ExportOptions } from "@/lib/server/export";
import { runExportJob } from "@/lib/server/export-jobs";
import { deleteFileFromStorage } from "@/lib/storage";
import { withApiError } from "@/lib/server/api-error";

export const runtime = "nodejs";

export const GET = withApiError(async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || "0");
  const offsetRaw = Number(url.searchParams.get("offset") || "0");
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 0), 50)
    : 0;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  const [totalRow] = await db
    .select({ total: count() })
    .from(exportJobs)
    .where(eq(exportJobs.userId, session.user.id));

  const rowsQuery = db
    .select()
    .from(exportJobs)
    .where(eq(exportJobs.userId, session.user.id))
    .orderBy(desc(exportJobs.createdAt));

  const rows =
    limit > 0
      ? await rowsQuery.limit(limit).offset(offset)
      : await rowsQuery.offset(offset);

  return NextResponse.json({
    items: rows,
    total: totalRow?.total ?? rows.length,
  });
});

export const POST = withApiError(async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    include?: Partial<ExportOptions>;
  };
  const include = body?.include ?? null;
  const active = await db
    .select({ id: exportJobs.id })
    .from(exportJobs)
    .where(
      and(
        eq(exportJobs.userId, userId),
        eq(exportJobs.status, "processing")
      )
    )
    .limit(1);
  if (active.length) {
    return NextResponse.json(
      { error: "Export already in progress" },
      { status: 409 }
    );
  }

  const [row] = await db
    .insert(exportJobs)
    .values({
      userId,
      status: "queued",
      options: include,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  void runExportJob(row.id, userId);

  return NextResponse.json({ id: row.id, status: row.status });
});

export const DELETE = withApiError(async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "failed").toLowerCase();
  const status = scope === "all" ? undefined : "failed";

  const rows = status
    ? await db
        .select()
        .from(exportJobs)
        .where(and(eq(exportJobs.userId, session.user.id), eq(exportJobs.status, status)))
    : await db
        .select()
        .from(exportJobs)
        .where(eq(exportJobs.userId, session.user.id));

  for (const row of rows) {
    if (row.storedName) {
      await deleteFileFromStorage(
        { userId: session.user.id, storedName: row.storedName },
        { driver: (row.storageDriver || "local") as "local" | "s3" }
      );
    }
  }

  if (status) {
    await db
      .delete(exportJobs)
      .where(and(eq(exportJobs.userId, session.user.id), eq(exportJobs.status, status)));
  } else {
    await db.delete(exportJobs).where(eq(exportJobs.userId, session.user.id));
  }

  return NextResponse.json({ status: true, deleted: rows.length });
});
