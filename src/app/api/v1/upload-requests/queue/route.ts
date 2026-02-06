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

import { NextResponse } from "next/server";
import { withApiError } from "@/lib/server/api-error";
import { getCurrentUser } from "@/lib/client/user";
import { db } from "@/db/client";
import { files, uploadRequestItems, uploadRequests } from "@/db/schemas";
import { and, desc, eq } from "drizzle-orm";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select({
      itemId: uploadRequestItems.id,
      uploadRequestId: uploadRequestItems.uploadRequestId,
      fileId: uploadRequestItems.fileId,
      fileSlug: files.slug,
      fileName: files.originalName,
      fileSize: files.size,
      createdAt: uploadRequestItems.createdAt,
    })
    .from(uploadRequestItems)
    .leftJoin(files, eq(files.id, uploadRequestItems.fileId))
    .innerJoin(
      uploadRequests,
      eq(uploadRequests.id, uploadRequestItems.uploadRequestId),
    )
    .where(
      and(
        eq(uploadRequests.userId, user.id),
        eq(uploadRequestItems.status, "pending"),
      ),
    )
    .orderBy(desc(uploadRequestItems.createdAt));

  return NextResponse.json({ items });
});
