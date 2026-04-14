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

import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { count, sum } from "drizzle-orm/sql/functions";
import { db } from "@/db/client";
import {
  bookmarks,
  files,
  filesToTags,
  folders,
  remoteUploadJobs,
  shortLinks,
  tags,
  watchlistItems,
} from "@/db/schemas";

type MetricsTotalsRow = {
  files_total: number;
  notes_total: number;
  bookmarks_total: number;
  snippets_total: number;
  recipes_total: number;
  short_links_total: number;
  tags_total: number;
  folders_total: number;
  watchlist_total: number;
  games_total: number;
  storage_bytes: number;
  file_views: number;
  note_views: number;
  bookmark_views: number;
  snippet_views: number;
  recipe_views: number;
  short_link_clicks: number;
  public_files: number;
  public_notes: number;
  public_bookmarks: number;
  public_snippets: number;
  public_recipes: number;
  public_short_links: number;
};

type MetricsCreatedRow = {
  files_current: number;
  notes_current: number;
  bookmarks_current: number;
  snippets_current: number;
  recipes_current: number;
  short_links_current: number;
  files_previous: number;
  notes_previous: number;
  bookmarks_previous: number;
  snippets_previous: number;
  recipes_previous: number;
  short_links_previous: number;
};

type MetricsPerformance = {
  total: number;
  success: number;
  failed: number;
  avg_seconds: number;
  queued: number;
  processing: number;
};

function toNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeTag(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  return normalized || null;
}

function sortTagRows(rows: Array<{ label: string; uses: number }>) {
  return rows
    .sort((a, b) => b.uses - a.uses || a.label.localeCompare(b.label))
    .slice(0, 12);
}

export async function loadMetricsAggregateData(options: {
  userId: string;
  periodStart: Date;
  previousStart: Date;
  previousEnd: Date;
  now: Date;
}) {
  const {
    userId,
    periodStart,
    previousStart,
    previousEnd,
    now,
  } = options;

  const [
    filesAggRows,
    bookmarksAggRows,
    shortLinksAggRows,
    tagsCountRows,
    foldersCountRows,
    watchlistCountRows,
    publicFilesRows,
    publicBookmarksRows,
    publicShortLinksRows,
    filesCurrentRows,
    bookmarksCurrentRows,
    shortLinksCurrentRows,
    filesPreviousRows,
    bookmarksPreviousRows,
    shortLinksPreviousRows,
    fileTagRows,
    bookmarkTagRows,
    shortLinkTagRows,
    periodUploadRows,
    queueStatusRows,
  ] = await Promise.all([
    db
      .select({
        total: count(files.id).mapWith(Number),
        storageBytes: sum(files.size).mapWith(Number),
        views: sum(files.views).mapWith(Number),
      })
      .from(files)
      .where(eq(files.userId, userId)),
    db
      .select({
        total: count(bookmarks.id).mapWith(Number),
        views: sum(bookmarks.views).mapWith(Number),
      })
      .from(bookmarks)
      .where(eq(bookmarks.userId, userId)),
    db
      .select({
        total: count(shortLinks.id).mapWith(Number),
        clicks: sum(shortLinks.clickCount).mapWith(Number),
      })
      .from(shortLinks)
      .where(eq(shortLinks.userId, userId)),
    db
      .select({
        total: count(tags.id).mapWith(Number),
      })
      .from(tags)
      .where(eq(tags.userId, userId)),
    db
      .select({
        total: count(folders.id).mapWith(Number),
      })
      .from(folders)
      .where(eq(folders.userId, userId)),
    db
      .select({
        total: count(watchlistItems.id).mapWith(Number),
      })
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, userId)),
    db
      .select({ total: count(files.id).mapWith(Number) })
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.isPublic, true))),
    db
      .select({ total: count(bookmarks.id).mapWith(Number) })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.isPublic, true))),
    db
      .select({ total: count(shortLinks.id).mapWith(Number) })
      .from(shortLinks)
      .where(and(eq(shortLinks.userId, userId), eq(shortLinks.isPublic, true))),
    db
      .select({ total: count(files.id).mapWith(Number) })
      .from(files)
      .where(
        and(
          eq(files.userId, userId),
          gte(files.createdAt, periodStart),
          lt(files.createdAt, now),
        ),
      ),
    db
      .select({ total: count(bookmarks.id).mapWith(Number) })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          gte(bookmarks.createdAt, periodStart),
          lt(bookmarks.createdAt, now),
        ),
      ),
    db
      .select({ total: count(shortLinks.id).mapWith(Number) })
      .from(shortLinks)
      .where(
        and(
          eq(shortLinks.userId, userId),
          gte(shortLinks.createdAt, periodStart),
          lt(shortLinks.createdAt, now),
        ),
      ),
    db
      .select({ total: count(files.id).mapWith(Number) })
      .from(files)
      .where(
        and(
          eq(files.userId, userId),
          gte(files.createdAt, previousStart),
          lt(files.createdAt, previousEnd),
        ),
      ),
    db
      .select({ total: count(bookmarks.id).mapWith(Number) })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, userId),
          gte(bookmarks.createdAt, previousStart),
          lt(bookmarks.createdAt, previousEnd),
        ),
      ),
    db
      .select({ total: count(shortLinks.id).mapWith(Number) })
      .from(shortLinks)
      .where(
        and(
          eq(shortLinks.userId, userId),
          gte(shortLinks.createdAt, previousStart),
          lt(shortLinks.createdAt, previousEnd),
        ),
      ),
    db
      .select({ tag: tags.name })
      .from(filesToTags)
      .innerJoin(files, eq(files.id, filesToTags.fileId))
      .innerJoin(tags, eq(tags.id, filesToTags.tagId))
      .where(and(eq(files.userId, userId), eq(tags.userId, userId))),
    db
      .select({ tags: bookmarks.tags })
      .from(bookmarks)
      .where(and(eq(bookmarks.userId, userId), isNotNull(bookmarks.tags))),
    db
      .select({ tags: shortLinks.tags })
      .from(shortLinks)
      .where(and(eq(shortLinks.userId, userId), isNotNull(shortLinks.tags))),
    db
      .select({
        status: remoteUploadJobs.status,
        createdAt: remoteUploadJobs.createdAt,
        updatedAt: remoteUploadJobs.updatedAt,
      })
      .from(remoteUploadJobs)
      .where(
        and(
          eq(remoteUploadJobs.userId, userId),
          gte(remoteUploadJobs.createdAt, periodStart),
          lt(remoteUploadJobs.createdAt, now),
        ),
      ),
    db
      .select({ status: remoteUploadJobs.status })
      .from(remoteUploadJobs)
      .where(
        and(
          eq(remoteUploadJobs.userId, userId),
          inArray(remoteUploadJobs.status, [
            "queued",
            "processing",
            "downloading",
          ]),
        ),
      ),
  ]);

  const filesAgg = filesAggRows[0];
  const bookmarksAgg = bookmarksAggRows[0];
  const shortLinksAgg = shortLinksAggRows[0];

  const totalsRow: MetricsTotalsRow = {
    files_total: toNumber(filesAgg?.total),
    notes_total: 0,
    bookmarks_total: toNumber(bookmarksAgg?.total),
    snippets_total: 0,
    recipes_total: 0,
    short_links_total: toNumber(shortLinksAgg?.total),
    tags_total: toNumber(tagsCountRows[0]?.total),
    folders_total: toNumber(foldersCountRows[0]?.total),
    watchlist_total: toNumber(watchlistCountRows[0]?.total),
    games_total: 0,
    storage_bytes: toNumber(filesAgg?.storageBytes),
    file_views: toNumber(filesAgg?.views),
    note_views: 0,
    bookmark_views: toNumber(bookmarksAgg?.views),
    snippet_views: 0,
    recipe_views: 0,
    short_link_clicks: toNumber(shortLinksAgg?.clicks),
    public_files: toNumber(publicFilesRows[0]?.total),
    public_notes: 0,
    public_bookmarks: toNumber(publicBookmarksRows[0]?.total),
    public_snippets: 0,
    public_recipes: 0,
    public_short_links: toNumber(publicShortLinksRows[0]?.total),
  };

  const createdRow: MetricsCreatedRow = {
    files_current: toNumber(filesCurrentRows[0]?.total),
    notes_current: 0,
    bookmarks_current: toNumber(bookmarksCurrentRows[0]?.total),
    snippets_current: 0,
    recipes_current: 0,
    short_links_current: toNumber(shortLinksCurrentRows[0]?.total),
    files_previous: toNumber(filesPreviousRows[0]?.total),
    notes_previous: 0,
    bookmarks_previous: toNumber(bookmarksPreviousRows[0]?.total),
    snippets_previous: 0,
    recipes_previous: 0,
    short_links_previous: toNumber(shortLinksPreviousRows[0]?.total),
  };

  const allTags: string[] = [];

  for (const row of fileTagRows) {
    const normalized = normalizeTag(row.tag);
    if (normalized) allTags.push(normalized);
  }
  for (const row of [...bookmarkTagRows, ...shortLinkTagRows]) {
    for (const value of row.tags || []) {
      const normalized = normalizeTag(value);
      if (normalized) allTags.push(normalized);
    }
  }

  const tagCounts = new Map<string, number>();
  for (const tag of allTags) {
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  const topTags = sortTagRows(
    Array.from(tagCounts.entries()).map(([label, uses]) => ({ label, uses })),
  );

  let total = 0;
  let success = 0;
  let failed = 0;
  let successDurationSeconds = 0;

  for (const row of periodUploadRows) {
    total += 1;
    if (row.status === "completed") {
      success += 1;
      if (row.createdAt && row.updatedAt) {
        successDurationSeconds +=
          (row.updatedAt.getTime() - row.createdAt.getTime()) / 1000;
      }
    } else if (row.status === "failed" || row.status === "dead-letter") {
      failed += 1;
    }
  }

  let queued = 0;
  let processing = 0;
  for (const row of queueStatusRows) {
    if (row.status === "queued") {
      queued += 1;
    } else if (row.status === "processing" || row.status === "downloading") {
      processing += 1;
    }
  }

  const performance: MetricsPerformance = {
    total,
    success,
    failed,
    avg_seconds: success > 0 ? successDurationSeconds / success : 0,
    queued,
    processing,
  };

  return {
    totalsRow,
    createdRow,
    topTags,
    performance,
  };
}
