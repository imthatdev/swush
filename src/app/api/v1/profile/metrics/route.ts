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
import { db } from "@/db/client";
import {
  files,
  bookmarks,
  shortLinks,
  shortLinkVisitEvents,
  folders,
} from "@/db/schemas";
import { and, desc, eq } from "drizzle-orm";
import { count, sum } from "drizzle-orm/sql/functions";
import { getCurrentUser } from "@/lib/client/user";
import { withApiError } from "@/lib/server/api-error";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import {
  loadTrackedMetricsEvents,
  type TrackedMetricsEvent,
} from "@/lib/server/metrics-tracked-events";
import { loadMetricsAggregateData } from "@/lib/server/metrics-aggregates";

const RANGE_DAYS = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const;

type RangeKey = keyof typeof RANGE_DAYS;

const SHARED_REFERRER_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "t.co",
  "facebook.com",
  "m.facebook.com",
  "linkedin.com",
  "reddit.com",
  "discord.com",
  "instagram.com",
  "threads.net",
  "youtube.com",
  "news.ycombinator.com",
]);

function parseRangeKey(value: string | null): RangeKey {
  if (!value) return "30d";
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "24h" ||
    normalized === "7d" ||
    normalized === "30d" ||
    normalized === "90d"
  ) {
    return normalized;
  }
  return "30d";
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function normalizeLabel(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function parseTimeZone(value: string | null) {
  const normalized = (value || "").trim();
  if (!normalized) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized });
    return normalized;
  } catch {
    return "UTC";
  }
}

function normalizeHost(value?: string | null) {
  const raw = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!raw) return "";
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return withoutScheme.replace(/:\d+$/, "");
}

function hostFromUrl(value?: string | null) {
  if (!value) return "";
  try {
    return normalizeHost(new URL(value).host);
  } catch {
    return normalizeHost(value);
  }
}

function rootDomain(host: string) {
  const parts = host.split(".").filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join(".");
}

type InternalHostMatcher = {
  hosts: Set<string>;
  roots: Set<string>;
};

function buildInternalHostMatcher(
  candidates: Array<string | null | undefined>,
) {
  const hosts = new Set<string>();
  const roots = new Set<string>();
  for (const candidate of candidates) {
    const host = hostFromUrl(candidate);
    if (!host) continue;
    hosts.add(host);
    roots.add(rootDomain(host));
  }
  return { hosts, roots } satisfies InternalHostMatcher;
}

function isInternalHost(host: string, matcher: InternalHostMatcher) {
  if (!host) return false;
  if (matcher.hosts.has(host)) return true;
  return matcher.roots.has(rootDomain(host));
}

function prettyType(type: string) {
  switch (type) {
    case "short_link":
      return "Short link";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

function referrerContext(
  host: string | null | undefined,
  matcher: InternalHostMatcher,
) {
  const normalized = (host || "").trim().toLowerCase();
  if (!normalized || normalized === "direct") return "Direct";
  if (SHARED_REFERRER_HOSTS.has(normalized)) return "Shared link";
  if (isInternalHost(normalized, matcher)) return "Internal website";
  return "External website";
}

function withPct<T extends { views: number }>(rows: T[], total: number) {
  return rows.map((row) => ({
    ...row,
    pct: total > 0 ? (row.views / total) * 100 : 0,
  }));
}

type TopItemRow = {
  id: string;
  type: string;
  title: string;
  views: number;
  createdAt: string;
  engagementScore: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function toDayMs(day: string) {
  const [year, month, date] = day.split("-").map((value) => Number(value));
  if (!year || !month || !date) return 0;
  return Date.UTC(year, month - 1, date);
}

function fromDayMs(ms: number) {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildTimeFormatters(timeZone: string) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  });
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  });
  return { day, hour, weekday };
}

function eventFingerprint(event: TrackedMetricsEvent) {
  return [
    event.countryCode || "",
    event.cityName || "",
    event.browserName || "",
    event.osName || "",
    event.referrerHost || "",
  ].join("|");
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const range = parseRangeKey(searchParams.get("range"));
  const days = RANGE_DAYS[range];
  const timeZone = parseTimeZone(searchParams.get("tz"));
  const runtimeSettings = await getPublicRuntimeSettings();
  const internalHostMatcher = buildInternalHostMatcher([
    runtimeSettings.appUrl,
    runtimeSettings.sharingDomain,
    req.nextUrl.host,
    req.headers.get("host"),
    req.headers.get("x-forwarded-host"),
  ]);

  const now = new Date();
  const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousStart = new Date(
    periodStart.getTime() - days * 24 * 60 * 60 * 1000,
  );
  const previousEnd = periodStart;
  const userId = user.id;
  const trackedEvents = await loadTrackedMetricsEvents({
    userId,
    from: previousStart,
    to: now,
  });
  const { totalsRow, createdRow, topTags, performance } =
    await loadMetricsAggregateData({
      userId,
      periodStart,
      previousStart,
      previousEnd,
      now,
    });

  const {
    day: dayFormatter,
    hour: hourFormatter,
    weekday: weekdayFormatter,
  } = buildTimeFormatters(timeZone);
  const dayKey = (value: Date) => dayFormatter.format(value);
  const hourValue = (value: Date) => {
    const parsed = Number(hourFormatter.format(value));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const weekStartKey = (value: Date) => {
    const currentDayKey = dayKey(value);
    const weekday = weekdayFormatter.format(value);
    const weekdayIndex = WEEKDAY_INDEX[weekday] ?? 0;
    const mondayOffset = (weekdayIndex + 6) % 7;
    return fromDayMs(toDayMs(currentDayKey) - mondayOffset * MS_PER_DAY);
  };

  const currentEvents = trackedEvents.filter(
    (event) => event.createdAt >= periodStart && event.createdAt < now,
  );
  const previousEvents = trackedEvents.filter(
    (event) =>
      event.createdAt >= previousStart && event.createdAt < previousEnd,
  );

  const eventSummaryRow: Record<string, unknown> = {
    current_views: currentEvents.length,
    previous_views: previousEvents.length,
    current_unique: new Set(currentEvents.map(eventFingerprint)).size,
    previous_unique: new Set(previousEvents.map(eventFingerprint)).size,
    current_active_items: new Set(currentEvents.map((event) => event.itemKey))
      .size,
    previous_active_items: new Set(previousEvents.map((event) => event.itemKey))
      .size,
  };

  const dayBuckets = new Map<
    string,
    { views: number; fingerprints: Set<string> }
  >();
  const hourlyCounts = new Map<number, number>();
  const countriesMap = new Map<string, number>();
  const citiesMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();
  const repeatByItem = new Map<
    string,
    { total: number; visitors: Set<string> }
  >();
  const visitorDays = new Map<string, Set<string>>();

  for (const event of currentEvents) {
    const day = dayKey(event.createdAt);
    const dayBucket = dayBuckets.get(day) ?? {
      views: 0,
      fingerprints: new Set(),
    };
    dayBucket.views += 1;
    dayBucket.fingerprints.add(eventFingerprint(event));
    dayBuckets.set(day, dayBucket);

    const hour = hourValue(event.createdAt);
    hourlyCounts.set(hour, (hourlyCounts.get(hour) ?? 0) + 1);

    const country = event.countryName || event.countryCode || "Unknown";
    const city = event.cityName || "Unknown";
    countriesMap.set(country, (countriesMap.get(country) ?? 0) + 1);
    citiesMap.set(city, (citiesMap.get(city) ?? 0) + 1);

    const browser = (event.browserName || "").toLowerCase();
    const referrerUrl = (event.referrerUrl || "").toLowerCase();
    const source =
      browser === "curl" || browser === "postman"
        ? "API"
        : referrerUrl.startsWith("chrome-extension://") ||
            referrerUrl.startsWith("moz-extension://")
          ? "Extension"
          : event.osName === "Android" || event.osName === "iOS"
            ? "Mobile"
            : "Web app";
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);

    const referrer = event.referrerHost || "Direct";
    referrerMap.set(referrer, (referrerMap.get(referrer) ?? 0) + 1);

    const visitor = eventFingerprint(event);
    const repeat = repeatByItem.get(event.itemKey) ?? {
      total: 0,
      visitors: new Set<string>(),
    };
    repeat.total += 1;
    repeat.visitors.add(visitor);
    repeatByItem.set(event.itemKey, repeat);

    const daysSet = visitorDays.get(visitor) ?? new Set<string>();
    daysSet.add(day);
    visitorDays.set(visitor, daysSet);
  }

  const seriesRows: Array<Record<string, unknown>> = [];
  for (
    let cursor = toDayMs(dayKey(periodStart));
    cursor <= toDayMs(dayKey(now));
    cursor += MS_PER_DAY
  ) {
    const key = fromDayMs(cursor);
    const hit = dayBuckets.get(key);
    seriesRows.push({
      day: key,
      views: hit?.views ?? 0,
      unique_views: hit?.fingerprints.size ?? 0,
    });
  }
  const seriesResult = { rows: seriesRows };

  const hourlyResult = {
    rows: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      views: hourlyCounts.get(hour) ?? 0,
    })),
  };

  const sortRows = <T extends { label: string; views: number }>(
    rows: T[],
    limit?: number,
  ) =>
    rows
      .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label))
      .slice(0, limit ?? rows.length);

  const countryResult = {
    rows: sortRows(
      Array.from(countriesMap.entries()).map(([label, views]) => ({
        label,
        views,
      })),
      20,
    ),
  };
  const cityResult = {
    rows: sortRows(
      Array.from(citiesMap.entries()).map(([label, views]) => ({
        label,
        views,
      })),
      20,
    ),
  };
  const sourceRows = {
    rows: sortRows(
      Array.from(sourceMap.entries()).map(([label, views]) => ({
        label,
        views,
      })),
    ),
  };
  const referrerRows = {
    rows: Array.from(referrerMap.entries())
      .map(([host, views]) => ({ host, views }))
      .sort((a, b) => b.views - a.views || a.host.localeCompare(b.host)),
  };

  let repeatViewsCount = 0;
  let repeatTotalCount = 0;
  for (const item of repeatByItem.values()) {
    repeatTotalCount += item.total;
    repeatViewsCount += Math.max(0, item.total - item.visitors.size);
  }
  const repeatRows = {
    rows: [{ repeat_views: repeatViewsCount, total_views: repeatTotalCount }],
  };

  let returningVisitorsCount = 0;
  for (const daysSet of visitorDays.values()) {
    if (daysSet.size > 1) returningVisitorsCount += 1;
  }
  const returningRows = {
    rows: [
      {
        visitors: visitorDays.size,
        returning_visitors: returningVisitorsCount,
      },
    ],
  };

  const [shortLinkCreationRows, shortLinkVisitRows] = await Promise.all([
    db
      .select({
        id: shortLinks.id,
        createdAt: shortLinks.createdAt,
      })
      .from(shortLinks)
      .where(eq(shortLinks.userId, userId)),
    db
      .select({
        shortLinkId: shortLinkVisitEvents.shortLinkId,
        createdAt: shortLinkVisitEvents.createdAt,
      })
      .from(shortLinkVisitEvents)
      .where(eq(shortLinkVisitEvents.userId, userId)),
  ]);

  const firstVisitByLink = new Map<string, Date>();
  for (const row of shortLinkVisitRows) {
    if (!row.createdAt) continue;
    const existing = firstVisitByLink.get(row.shortLinkId);
    if (!existing || row.createdAt < existing) {
      firstVisitByLink.set(row.shortLinkId, row.createdAt);
    }
  }
  const firstClickDelays: number[] = [];
  for (const row of shortLinkCreationRows) {
    if (!row.createdAt) continue;
    const firstVisitAt = firstVisitByLink.get(row.id);
    if (!firstVisitAt) continue;
    if (firstVisitAt < periodStart || firstVisitAt >= now) continue;
    firstClickDelays.push(
      (firstVisitAt.getTime() - row.createdAt.getTime()) / 1000,
    );
  }
  const firstClickRows = {
    rows: [
      {
        avg_seconds:
          firstClickDelays.length > 0
            ? firstClickDelays.reduce((sum, value) => sum + value, 0) /
              firstClickDelays.length
            : 0,
      },
    ],
  };

  const visitorWeeks = new Map<string, Set<string>>();
  for (const event of currentEvents) {
    const visitor = eventFingerprint(event);
    const week = weekStartKey(event.createdAt);
    const set = visitorWeeks.get(visitor) ?? new Set<string>();
    set.add(week);
    visitorWeeks.set(visitor, set);
  }

  const firstTouchByVisitor = new Map<string, string>();
  const cohortSizes = new Map<string, number>();
  for (const [visitor, weeks] of visitorWeeks.entries()) {
    const sortedWeeks = Array.from(weeks).sort((a, b) => a.localeCompare(b));
    const firstTouch = sortedWeeks[0];
    if (!firstTouch) continue;
    firstTouchByVisitor.set(visitor, firstTouch);
    cohortSizes.set(firstTouch, (cohortSizes.get(firstTouch) ?? 0) + 1);
  }

  const activityMap = new Map<string, Set<string>>();
  for (const [visitor, weeks] of visitorWeeks.entries()) {
    const cohort = firstTouchByVisitor.get(visitor);
    if (!cohort) continue;
    const cohortMs = toDayMs(cohort);
    for (const week of weeks) {
      const offset = Math.floor((toDayMs(week) - cohortMs) / (7 * MS_PER_DAY));
      if (offset < 0 || offset > 5) continue;
      const key = `${cohort}|${offset}`;
      const set = activityMap.get(key) ?? new Set<string>();
      set.add(visitor);
      activityMap.set(key, set);
    }
  }

  const cohortRows = {
    rows: Array.from(activityMap.entries())
      .map(([key, visitorsSet]) => {
        const [cohortWeek, rawOffset] = key.split("|");
        const weekOffset = Number(rawOffset);
        return {
          cohort_week: cohortWeek,
          week_offset: weekOffset,
          active: visitorsSet.size,
          cohort_size: cohortSizes.get(cohortWeek) ?? visitorsSet.size,
        };
      })
      .sort((a, b) =>
        a.cohort_week === b.cohort_week
          ? a.week_offset - b.week_offset
          : a.cohort_week.localeCompare(b.cohort_week),
      ),
  };

  const [topFiles, topBookmarks, topShortLinks, topSharedLinks, folderRows] =
    await Promise.all([
      db
        .select({
          id: files.id,
          title: files.originalName,
          views: files.views,
          createdAt: files.createdAt,
        })
        .from(files)
        .where(eq(files.userId, userId))
        .orderBy(desc(files.views), desc(files.createdAt))
        .limit(15),
      db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          views: bookmarks.views,
          createdAt: bookmarks.createdAt,
        })
        .from(bookmarks)
        .where(eq(bookmarks.userId, userId))
        .orderBy(desc(bookmarks.views), desc(bookmarks.createdAt))
        .limit(15),
      db
        .select({
          id: shortLinks.id,
          slug: shortLinks.slug,
          clicks: shortLinks.clickCount,
          createdAt: shortLinks.createdAt,
        })
        .from(shortLinks)
        .where(eq(shortLinks.userId, userId))
        .orderBy(desc(shortLinks.clickCount), desc(shortLinks.createdAt))
        .limit(15),
      db
        .select({
          id: shortLinks.id,
          slug: shortLinks.slug,
          clicks: shortLinks.clickCount,
          createdAt: shortLinks.createdAt,
        })
        .from(shortLinks)
        .where(eq(shortLinks.userId, userId))
        .orderBy(desc(shortLinks.clickCount), desc(shortLinks.createdAt))
        .limit(10),
      db
        .select({
          folderId: folders.id,
          name: folders.name,
          items: count(files.id).mapWith(Number),
          views: sum(files.views).mapWith(Number),
          storageBytes: sum(files.size).mapWith(Number),
        })
        .from(files)
        .leftJoin(
          folders,
          and(eq(folders.id, files.folderId), eq(folders.userId, userId)),
        )
        .where(eq(files.userId, userId))
        .groupBy(folders.id, folders.name),
    ]);

  const totals = {
    files: toNumber(totalsRow.files_total),
    notes: 0,
    bookmarks: toNumber(totalsRow.bookmarks_total),
    snippets: 0,
    recipes: 0,
    shortLinks: toNumber(totalsRow.short_links_total),
    tags: toNumber(totalsRow.tags_total),
    folders: toNumber(totalsRow.folders_total),
    watchlist: toNumber(totalsRow.watchlist_total),
    games: 0,
  };

  const totalsViews = {
    files: toNumber(totalsRow.file_views),
    notes: 0,
    bookmarks: toNumber(totalsRow.bookmark_views),
    snippets: 0,
    recipes: 0,
    shortLinks: toNumber(totalsRow.short_link_clicks),
  };

  const currentCreatedTotal =
    toNumber(createdRow.files_current) + toNumber(createdRow.bookmarks_current);

  const previousCreatedTotal =
    toNumber(createdRow.files_previous) +
    toNumber(createdRow.bookmarks_previous);

  const currentShortLinks = toNumber(createdRow.short_links_current);
  const previousShortLinks = toNumber(createdRow.short_links_previous);

  const currentViews = toNumber(eventSummaryRow.current_views);
  const previousViews = toNumber(eventSummaryRow.previous_views);
  const currentUniqueViews = toNumber(eventSummaryRow.current_unique);
  const previousUniqueViews = toNumber(eventSummaryRow.previous_unique);
  const currentActiveItems = toNumber(eventSummaryRow.current_active_items);
  const previousActiveItems = toNumber(eventSummaryRow.previous_active_items);

  const dateSeed = (seriesResult.rows || []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      date: String(r.day),
      views: toNumber(r.views),
      uniqueViews: toNumber(r.unique_views),
    };
  });

  const hourly = (hourlyResult.rows || []).map((row) => {
    const r = row as Record<string, unknown>;
    const hour = toNumber(r.hour);
    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      views: toNumber(r.views),
    };
  });

  const countriesRaw = (countryResult.rows || []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      label: normalizeLabel(
        typeof r.label === "string" ? r.label : null,
        "Unknown",
      ),
      views: toNumber(r.views),
    };
  });

  const citiesRaw = (cityResult.rows || []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      label: normalizeLabel(
        typeof r.label === "string" ? r.label : null,
        "Unknown",
      ),
      views: toNumber(r.views),
    };
  });

  const sourceRaw = (sourceRows.rows || []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      label: normalizeLabel(
        typeof r.label === "string" ? r.label : null,
        "Web app",
      ),
      views: toNumber(r.views),
    };
  });

  const referrerRaw = (referrerRows.rows || []).map((row) => {
    const r = row as Record<string, unknown>;
    const host = normalizeLabel(
      typeof r.host === "string" ? r.host : null,
      "Direct",
    );
    return {
      label: referrerContext(host, internalHostMatcher),
      views: toNumber(r.views),
    };
  });

  const referrerMergedMap = new Map<string, number>();
  for (const row of referrerRaw) {
    referrerMergedMap.set(
      row.label,
      (referrerMergedMap.get(row.label) ?? 0) + row.views,
    );
  }
  const referrerMerged = Array.from(referrerMergedMap.entries())
    .map(([label, views]) => ({ label, views }))
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label));

  const repeatRow = (repeatRows.rows?.[0] ?? {}) as Record<string, unknown>;
  const repeatViews = toNumber(repeatRow.repeat_views);
  const repeatTotal = toNumber(repeatRow.total_views);

  const returningRow = (returningRows.rows?.[0] ?? {}) as Record<
    string,
    unknown
  >;
  const visitors = toNumber(returningRow.visitors);
  const returningVisitors = toNumber(returningRow.returning_visitors);

  const firstClickRow = (firstClickRows.rows?.[0] ?? {}) as Record<
    string,
    unknown
  >;
  const avgTimeToFirstClickSeconds = toNumber(firstClickRow.avg_seconds);

  const cohortHeatmap = (cohortRows.rows || []).map((row) => {
    const r = row as Record<string, unknown>;
    const cohortSize = Math.max(1, toNumber(r.cohort_size));
    const active = toNumber(r.active);
    const weekOffset = toNumber(r.week_offset);
    return {
      cohort: String(r.cohort_week || ""),
      weekOffset,
      week: `W${weekOffset}`,
      active,
      cohortSize,
      rate: (active / cohortSize) * 100,
    };
  });

  const cohortSeriesMap = new Map<
    string,
    {
      cohort: string;
      size: number;
      week0: number;
      week1: number;
      week2: number;
      week3: number;
      week4: number;
      week5: number;
    }
  >();

  for (const row of cohortHeatmap) {
    const hit = cohortSeriesMap.get(row.cohort) ?? {
      cohort: row.cohort,
      size: row.cohortSize,
      week0: 0,
      week1: 0,
      week2: 0,
      week3: 0,
      week4: 0,
      week5: 0,
    };
    if (row.weekOffset === 0) hit.week0 = row.rate;
    if (row.weekOffset === 1) hit.week1 = row.rate;
    if (row.weekOffset === 2) hit.week2 = row.rate;
    if (row.weekOffset === 3) hit.week3 = row.rate;
    if (row.weekOffset === 4) hit.week4 = row.rate;
    if (row.weekOffset === 5) hit.week5 = row.rate;
    cohortSeriesMap.set(row.cohort, hit);
  }

  const cohortSeries = Array.from(cohortSeriesMap.values()).sort((a, b) =>
    a.cohort.localeCompare(b.cohort),
  );

  const makeItem = (
    id: string,
    type: string,
    title: string,
    views: number,
    createdAt: Date | string | null,
  ): TopItemRow => {
    const created =
      createdAt instanceof Date
        ? createdAt
        : createdAt
          ? new Date(createdAt)
          : new Date(0);
    const ageDays = Math.max(
      0,
      Math.floor((now.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)),
    );
    const recencyBoost = Math.max(0, 30 - ageDays) / 30;

    return {
      id,
      type,
      title: title || "Untitled",
      views,
      createdAt: created.toISOString(),
      engagementScore: Number((views * 0.8 + recencyBoost * 20).toFixed(2)),
    };
  };

  const topItems = [
    ...topFiles.map((row) =>
      makeItem(
        row.id,
        "file",
        normalizeLabel(row.title, "Untitled file"),
        toNumber(row.views),
        row.createdAt,
      ),
    ),
    ...topBookmarks.map((row) =>
      makeItem(
        row.id,
        "bookmark",
        normalizeLabel(row.title, "Untitled bookmark"),
        toNumber(row.views),
        row.createdAt,
      ),
    ),
    ...topShortLinks.map((row) =>
      makeItem(
        row.id,
        "short_link",
        normalizeLabel(row.slug, "Untitled short link"),
        toNumber(row.clicks),
        row.createdAt,
      ),
    ),
  ]
    .sort((a, b) => b.views - a.views || b.engagementScore - a.engagementScore)
    .slice(0, 15)
    .map((row) => ({ ...row, type: prettyType(row.type) }));

  const sharedLinks = topSharedLinks.map((row) => ({
    id: row.id,
    slug: row.slug,
    clicks: toNumber(row.clicks),
    createdAt: row.createdAt
      ? row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : new Date(row.createdAt).toISOString()
      : new Date(0).toISOString(),
  }));

  const folderAnalytics = folderRows
    .map((row) => ({
      folderId: row.folderId ?? null,
      name: normalizeLabel(row.name, "Uncategorized"),
      items: toNumber(row.items),
      views: toNumber(row.views),
      storageBytes: toNumber(row.storageBytes),
    }))
    .sort((a, b) => b.views - a.views || b.items - a.items)
    .slice(0, 20);

  const contentTypes = [
    { label: "Files", items: totals.files, views: totalsViews.files },
    { label: "Notes", items: 0, views: 0 },
    {
      label: "Bookmarks",
      items: totals.bookmarks,
      views: totalsViews.bookmarks,
    },
    { label: "Snippets", items: 0, views: 0 },
    { label: "Recipes", items: 0, views: 0 },
    {
      label: "Short links",
      items: totals.shortLinks,
      views: totalsViews.shortLinks,
    },
  ].sort((a, b) => b.items - a.items || b.views - a.views);

  const allTimeViews =
    totalsViews.files + totalsViews.bookmarks + totalsViews.shortLinks;

  return NextResponse.json({
    generatedAt: now.toISOString(),
    range: {
      key: range,
      days,
      from: periodStart.toISOString(),
      to: now.toISOString(),
    },
    overview: {
      totalUploads: totals.files,
      totalShortLinks: totals.shortLinks,
      totalViewsAndClicks: allTimeViews,
      periodViews: currentViews,
      periodUniqueViews: currentUniqueViews,
      activeItems: currentActiveItems,
      growth: {
        uploadsPct: percentChange(currentCreatedTotal, previousCreatedTotal),
        shortLinksPct: percentChange(currentShortLinks, previousShortLinks),
        viewsPct: percentChange(currentViews, previousViews),
        uniqueViewsPct: percentChange(currentUniqueViews, previousUniqueViews),
        activeItemsPct: percentChange(currentActiveItems, previousActiveItems),
      },
    },
    totals: {
      ...totals,
      storageBytes: toNumber(totalsRow.storage_bytes),
      views: totalsViews,
      publicTotals: {
        files: toNumber(totalsRow.public_files),
        notes: 0,
        bookmarks: toNumber(totalsRow.public_bookmarks),
        snippets: 0,
        recipes: 0,
        shortLinks: toNumber(totalsRow.public_short_links),
      },
    },
    charts: {
      viewsOverTime: dateSeed,
      hourly,
      topItems: topItems.slice(0, 10),
    },
    geo: {
      countries: withPct(countriesRaw, currentViews),
      cities: withPct(citiesRaw, currentViews),
    },
    context: {
      sourceTypes: withPct(sourceRaw, currentViews),
      referrerTypes: withPct(referrerMerged, currentViews),
      contentTypes,
      topTags,
    },
    engagement: {
      avgTimeToFirstClickSeconds:
        avgTimeToFirstClickSeconds > 0 ? avgTimeToFirstClickSeconds : null,
      repeatViews,
      repeatViewRatePct:
        repeatTotal > 0 ? (repeatViews / repeatTotal) * 100 : 0,
      returnVisitorRatePct:
        visitors > 0 ? (returningVisitors / visitors) * 100 : null,
      saveToViewRatio:
        currentViews > 0 ? currentCreatedTotal / currentViews : null,
      cohorts: {
        heatmap: cohortHeatmap,
        series: cohortSeries,
      },
    },
    leaderboards: {
      mostViewedItems: topItems,
      mostSharedShortLinks: sharedLinks,
      mostSavedContentTypes: [...contentTypes].sort(
        (a, b) => b.items - a.items || b.views - a.views,
      ),
      mostActiveCollections: [...folderAnalytics].sort(
        (a, b) => b.views - a.views || b.items - a.items,
      ),
    },
    collections: {
      folders: folderAnalytics,
    },
    performance: {
      uploads: {
        total: performance.total,
        success: performance.success,
        failed: performance.failed,
        successRatePct:
          performance.total > 0
            ? (performance.success / performance.total) * 100
            : null,
        avgUploadTimeSeconds:
          performance.avg_seconds > 0 ? performance.avg_seconds : null,
        queued: performance.queued,
        processing: performance.processing,
      },
    },
  });
});
