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
import { desc, eq } from "drizzle-orm";

export const GET = withApiError(async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [requestRow] = await db
    .select({ id: uploadRequests.id, userId: uploadRequests.userId })
    .from(uploadRequests)
    .where(eq(uploadRequests.id, id))
    .limit(1);

  if (!requestRow || requestRow.userId !== user.id) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const items = await db
    .select({
      id: uploadRequestItems.id,
      status: uploadRequestItems.status,
      createdAt: uploadRequestItems.createdAt,
      decidedAt: uploadRequestItems.decidedAt,
      fileId: uploadRequestItems.fileId,
      fileSlug: files.slug,
      fileName: files.originalName,
      fileSize: files.size,
    })
    .from(uploadRequestItems)
    .leftJoin(files, eq(files.id, uploadRequestItems.fileId))
    .where(eq(uploadRequestItems.uploadRequestId, id))
    .orderBy(desc(uploadRequestItems.createdAt));

  return NextResponse.json({ items });
});
