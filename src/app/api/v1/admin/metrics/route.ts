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
import {
  user,
  userInfo,
  files,
  shortLinks,
  tags,
  folders,
  watchlistItems,
} from "@/db/schemas";
import { eq, gte, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/security/roles";
import type { AdminMetrics } from "@/types/admin-metrics";
import { withApiError } from "@/lib/server/api-error";

const DAY_WINDOW = 30;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDailySeed(startDate: Date) {
  const days = Array.from({ length: DAY_WINDOW }, (_, idx) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + idx);
    return dayKey(d);
  });

  return days.map((date) => ({
    date,
    users: 0,
    files: 0,
    storageBytes: 0,
    notes: 0,
    bookmarks: 0,
    snippets: 0,
    recipes: 0,
    shortLinks: 0,
  }));
}

export const GET = withApiError(async function GET() {
  await requireAdmin();

  const [usersRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(user);
  const [verifiedUsersRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(user)
    .where(eq(user.emailVerified, true));
  const [adminsRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(userInfo)
    .where(eq(userInfo.role, "admin"));
  const [ownersRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(userInfo)
    .where(eq(userInfo.role, "owner"));

  const [filesRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(files);
  const [shortLinksRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(shortLinks);
  const [tagsRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(tags);
  const [foldersRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(folders);
  const [watchlistRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(watchlistItems);

  const [storageRow] = await db
    .select({ total: sql<number>`coalesce(sum(${files.size}), 0)` })
    .from(files);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (DAY_WINDOW - 1));
  startDate.setHours(0, 0, 0, 0);

  const daily = buildDailySeed(startDate);
  const dailyMap = new Map(daily.map((row) => [row.date, row]));

  const filesDaily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${files.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
      bytes: sql<number>`coalesce(sum(${files.size}), 0)`,
    })
    .from(files)
    .where(gte(files.createdAt, startDate))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  filesDaily.forEach((row) => {
    const hit = dailyMap.get(row.day);
    if (!hit) return;
    hit.files = Number(row.count) || 0;
    hit.storageBytes = Number(row.bytes) || 0;
  });

  const usersDaily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${user.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(user)
    .where(gte(user.createdAt, startDate))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  usersDaily.forEach((row) => {
    const hit = dailyMap.get(row.day);
    if (!hit) return;
    hit.users = Number(row.count) || 0;
  });

  const shortLinksDaily = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${shortLinks.createdAt}), 'YYYY-MM-DD')`,
      count: sql<number>`count(*)`,
    })
    .from(shortLinks)
    .where(gte(shortLinks.createdAt, startDate))
    .groupBy(sql`1`)
    .orderBy(sql`1`);

  shortLinksDaily.forEach((row) => {
    const hit = dailyMap.get(row.day);
    if (!hit) return;
    hit.shortLinks = Number(row.count) || 0;
  });

  const payload: AdminMetrics = {
    totals: {
      users: Number(usersRow?.total ?? 0),
      verifiedUsers: Number(verifiedUsersRow?.total ?? 0),
      admins: Number(adminsRow?.total ?? 0),
      owners: Number(ownersRow?.total ?? 0),
      files: Number(filesRow?.total ?? 0),
      shortLinks: Number(shortLinksRow?.total ?? 0),
      tags: Number(tagsRow?.total ?? 0),
      folders: Number(foldersRow?.total ?? 0),
      watchlist: Number(watchlistRow?.total ?? 0),
    },
    storageBytes: Number(storageRow?.total ?? 0),
    daily,
  };

  return NextResponse.json(payload);
});
