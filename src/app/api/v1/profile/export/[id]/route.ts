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
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { exportJobs } from "@/db/schemas";
import { readFromStorage, deleteFileFromStorage } from "@/lib/storage";
import { Readable } from "stream";
import { withApiError } from "@/lib/server/api-error";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export const GET = withApiError(async function GET(
  req: NextRequest,
  { params }: { params: Params },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [job] = await db
    .select()
    .from(exportJobs)
    .where(and(eq(exportJobs.id, id), eq(exportJobs.userId, session.user.id)))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status !== "ready" || !job.storedName) {
    return NextResponse.json({ error: "Export not ready" }, { status: 409 });
  }

  const read = await readFromStorage(
    { userId: session.user.id, storedName: job.storedName },
    { driver: (job.storageDriver || "local") as "local" | "s3" },
  );
  if (!read) {
    await db
      .update(exportJobs)
      .set({
        status: "failed",
        error: "Export file missing",
        updatedAt: new Date(),
      })
      .where(eq(exportJobs.id, job.id));
    return NextResponse.json({ error: "Export missing" }, { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${job.fileName || "export.zip"}"`,
    "Cache-Control": "no-store",
  });

  return new NextResponse(
    Readable.toWeb(read.stream) as unknown as ReadableStream,
    {
      headers,
    },
  );
});

export const DELETE = withApiError(async function DELETE(
  req: NextRequest,
  { params }: { params: Params },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [job] = await db
    .select()
    .from(exportJobs)
    .where(and(eq(exportJobs.id, id), eq(exportJobs.userId, session.user.id)))
    .limit(1);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (job.storedName) {
    await deleteFileFromStorage(
      { userId: session.user.id, storedName: job.storedName },
      { driver: (job.storageDriver || "local") as "local" | "s3" },
    );
  }

  await db.delete(exportJobs).where(eq(exportJobs.id, job.id));
  return NextResponse.json({ status: true });
});
