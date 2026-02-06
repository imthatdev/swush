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
import { db } from "@/db/client";
import { files, shortLinks, tags, folders, watchlistItems } from "@/db/schemas";
import { eq, sql, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/client/user";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = user.id;

  const [
    filesRow,
    shortLinksRow,
    tagsRow,
    foldersRow,
    watchlistRow,
    storageRow,
    publicFilesRow,
    publicShortLinksRow,
    shortLinkClicksRow,
  ] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(files)
      .where(eq(files.userId, userId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(shortLinks)
      .where(eq(shortLinks.userId, userId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(tags)
      .where(eq(tags.userId, userId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(folders)
      .where(eq(folders.userId, userId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, userId)),
    db
      .select({ total: sql<number>`coalesce(sum(${files.size}), 0)` })
      .from(files)
      .where(eq(files.userId, userId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.isPublic, true))),
    db
      .select({ total: sql<number>`count(*)` })
      .from(shortLinks)
      .where(and(eq(shortLinks.userId, userId), eq(shortLinks.isPublic, true))),
    db
      .select({
        total: sql<number>`coalesce(sum(${shortLinks.clickCount}), 0)`,
      })
      .from(shortLinks)
      .where(eq(shortLinks.userId, userId)),
  ]);

  return NextResponse.json({
    totals: {
      files: Number(filesRow?.[0]?.total ?? 0),
      shortLinks: Number(shortLinksRow?.[0]?.total ?? 0),
      tags: Number(tagsRow?.[0]?.total ?? 0),
      folders: Number(foldersRow?.[0]?.total ?? 0),
      watchlist: Number(watchlistRow?.[0]?.total ?? 0),
    },
    storageBytes: Number(storageRow?.[0]?.total ?? 0),
    publicTotals: {
      files: Number(publicFilesRow?.[0]?.total ?? 0),
      shortLinks: Number(publicShortLinksRow?.[0]?.total ?? 0),
    },
    shortLinkClicks: Number(shortLinkClicksRow?.[0]?.total ?? 0),
  });
});
