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
import { withApiError } from "@/lib/server/api-error";
import { getCurrentUser } from "@/lib/client/user";
import { db } from "@/db/client";
import { files, uploadRequestItems, uploadRequests } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { deleteFile } from "@/lib/api/files/delete";

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await params;
  const body = (await req.json().catch(() => null)) as {
    action?: "approve" | "reject";
  } | null;

  const action = body?.action;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  }

  const [requestRow] = await db
    .select({ id: uploadRequests.id, userId: uploadRequests.userId })
    .from(uploadRequests)
    .where(eq(uploadRequests.id, id))
    .limit(1);

  if (!requestRow || requestRow.userId !== user.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [item] = await db
    .select({
      id: uploadRequestItems.id,
      fileId: uploadRequestItems.fileId,
      status: uploadRequestItems.status,
      fileSlug: files.slug,
    })
    .from(uploadRequestItems)
    .leftJoin(files, eq(files.id, uploadRequestItems.fileId))
    .where(
      and(
        eq(uploadRequestItems.id, itemId),
        eq(uploadRequestItems.uploadRequestId, id),
      ),
    )
    .limit(1);

  if (!item) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (action === "approve") {
    await db
      .update(uploadRequestItems)
      .set({
        status: "approved",
        decidedAt: new Date(),
        decidedBy: user.id,
      })
      .where(eq(uploadRequestItems.id, itemId));

    return NextResponse.json({ ok: true });
  }

  await db
    .update(uploadRequestItems)
    .set({
      status: "rejected",
      decidedAt: new Date(),
      decidedBy: user.id,
    })
    .where(eq(uploadRequestItems.id, itemId));

  if (item.fileSlug) {
    await deleteFile(req, item.fileSlug);
  }

  return NextResponse.json({ ok: true });
});
