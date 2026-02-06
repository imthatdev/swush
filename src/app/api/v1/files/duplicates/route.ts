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
import { files } from "@/db/schemas/core-schema";
import { and, count, eq, inArray, isNotNull, sql } from "drizzle-orm";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const hashes = await db
    .select({
      contentHash: files.contentHash,
      total: count(files.id).mapWith(Number),
    })
    .from(files)
    .where(and(eq(files.userId, user.id), isNotNull(files.contentHash)))
    .groupBy(files.contentHash)
    .having(sql`count(${files.id}) > 1`)
    .orderBy(sql`count(${files.id}) desc`);

  if (!hashes.length) return NextResponse.json({ groups: [] });

  const hashList = hashes
    .map((h) => h.contentHash)
    .filter((hash): hash is string => typeof hash === "string");
  const fileRows = await db.query.files.findMany({
    where: and(eq(files.userId, user.id), inArray(files.contentHash, hashList)),
    columns: {
      id: true,
      originalName: true,
      slug: true,
      contentHash: true,
      createdAt: true,
    },
    orderBy: (f, { desc }) => [desc(f.createdAt)],
  });

  const groups = hashes.map((h) => ({
    contentHash: h.contentHash,
    total: h.total,
    items: fileRows
      .filter((f) => f.contentHash === h.contentHash)
      .map((f) => ({
        id: f.id,
        title: f.originalName,
        slug: f.slug,
        createdAt: f.createdAt,
      })),
  }));

  return NextResponse.json({ groups });
});
