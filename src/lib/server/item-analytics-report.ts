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

import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  auditLog,
  bookmarks,
  files,
  shortLinks,
  shortLinkVisitEvents,
} from "@/db/schemas";
import type { ItemAnalyticsType } from "@/lib/server/item-analytics";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";

const UNKNOWN = "Unknown";
const DIRECT = "Direct";

const RANGE_HOURS = {
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
} as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type ItemAnalyticsRangeKey = keyof typeof RANGE_HOURS;

type InternalHostMatcher = {
  hosts: Set<string>;
  roots: Set<string>;
};

type ItemMeta = {
  id: string;
  type: ItemAnalyticsType;
  title: string;
  subtitle: string | null;
  slug: string | null;
  lifetimeViews: number;
};

type AnalyticsEvent = {
  createdAt: Date;
  browserName: string | null;
  osName: string | null;
  referrerHost: string | null;
  referrerUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
  cityName: string | null;
};

type SeriesPoint = {
  bucket: string;
  label: string;
  views: number;
  uniqueVisitors: number;
};

type DimensionRow = {
  label: string;
  views: number;
  pct: number;
};

export type ItemAnalyticsReport = {
  generatedAt: string;
  range: ItemAnalyticsRangeKey;
  item: {
    id: string;
    itemType: ItemAnalyticsType;
    title: string;
    subtitle: string | null;
    slug: string | null;
    contentType: string;
    lifetimeViews: number;
  };
  summary: {
    trackedViews: number;
    uniqueVisitors: number;
    repeatVisitors: number;
    repeatViews: number;
    lastEventAt: string | null;
  };
  contentTypes: DimensionRow[];
  timeSeries: SeriesPoint[];
  referrers: DimensionRow[];
  countries: DimensionRow[];
  cities: DimensionRow[];
  sources: DimensionRow[];
  browsers: DimensionRow[];
  operatingSystems: DimensionRow[];
};

function parseRangeKey(
  value: string | null | undefined,
): ItemAnalyticsRangeKey {
  if (!value) return "30d";
  const normalized = value.trim().toLowerCase();
  if (normalized === "24h" || normalized === "7d" || normalized === "30d") {
    return normalized;
  }
  return "30d";
}

export function parseItemAnalyticsRange(
  value: string | null | undefined,
): ItemAnalyticsRangeKey {
  return parseRangeKey(value);
}

function parseTimeZone(value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized });
    return normalized;
  } catch {
    return "UTC";
  }
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

function sanitizeText(value: unknown, max = 180) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function normalizeLabel(value: unknown, fallback: string) {
  const next = sanitizeText(value, 180);
  return next || fallback;
}

function normalizeHost(value?: string | null) {
  const raw = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!raw) return "";
  const noScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return noScheme.replace(/:\d+$/, "");
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

function prettyType(type: ItemAnalyticsType) {
  if (type === "short_link") return "Short link";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function parseMetaRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function classifySource(event: AnalyticsEvent, matcher: InternalHostMatcher) {
  const browser = normalizeLabel(event.browserName, UNKNOWN).toLowerCase();
  const os = normalizeLabel(event.osName, UNKNOWN);
  const referrerHost = normalizeLabel(event.referrerHost, DIRECT).toLowerCase();
  const referrerUrl = sanitizeText(event.referrerUrl, 600).toLowerCase();

  if (browser === "curl" || browser === "postman") return "API";
  if (
    referrerUrl.startsWith("chrome-extension://") ||
    referrerUrl.startsWith("moz-extension://")
  ) {
    return "Extension";
  }
  if (os === "Android" || os === "iOS") return "Mobile";
  if (referrerHost === DIRECT.toLowerCase()) return DIRECT;
  if (isInternalHost(referrerHost, matcher)) return "Internal";
  return "Web";
}

function fingerprint(event: AnalyticsEvent) {
  return [
    normalizeLabel(event.countryCode || event.countryName, UNKNOWN),
    normalizeLabel(event.cityName, UNKNOWN),
    normalizeLabel(event.browserName, UNKNOWN),
    normalizeLabel(event.osName, UNKNOWN),
    normalizeLabel(event.referrerHost, DIRECT),
  ].join("|");
}

function pushCount(map: Map<string, number>, label: string) {
  map.set(label, (map.get(label) ?? 0) + 1);
}

function mapToRows(map: Map<string, number>, total: number, limit = 8) {
  return Array.from(map.entries())
    .map(([label, views]) => ({
      label,
      views,
      pct: total > 0 ? (views / total) * 100 : 0,
    }))
    .sort((a, b) => b.views - a.views || a.label.localeCompare(b.label))
    .slice(0, limit);
}

async function loadOwnedItemMeta(input: {
  userId: string;
  itemId: string;
  itemType: ItemAnalyticsType;
}): Promise<ItemMeta | null> {
  const { userId, itemId, itemType } = input;

  switch (itemType) {
    case "file": {
      const [row] = await db
        .select({
          id: files.id,
          originalName: files.originalName,
          slug: files.slug,
          views: files.views,
        })
        .from(files)
        .where(and(eq(files.id, itemId), eq(files.userId, userId)))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        type: itemType,
        title: row.originalName || "Untitled file",
        subtitle: null,
        slug: row.slug,
        lifetimeViews: toNumber(row.views),
      };
    }
    case "bookmark": {
      const [row] = await db
        .select({
          id: bookmarks.id,
          title: bookmarks.title,
          url: bookmarks.url,
          slug: bookmarks.slug,
          views: bookmarks.views,
        })
        .from(bookmarks)
        .where(and(eq(bookmarks.id, itemId), eq(bookmarks.userId, userId)))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        type: itemType,
        title: row.title || row.url || "Untitled bookmark",
        subtitle: row.url || null,
        slug: row.slug,
        lifetimeViews: toNumber(row.views),
      };
    }
    case "short_link": {
      const [row] = await db
        .select({
          id: shortLinks.id,
          slug: shortLinks.slug,
          originalUrl: shortLinks.originalUrl,
          clickCount: shortLinks.clickCount,
        })
        .from(shortLinks)
        .where(and(eq(shortLinks.id, itemId), eq(shortLinks.userId, userId)))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        type: itemType,
        title: row.slug,
        subtitle: row.originalUrl || null,
        slug: row.slug,
        lifetimeViews: toNumber(row.clickCount),
      };
    }
  }
}

async function loadItemEvents(input: {
  userId: string;
  itemId: string;
  itemType: ItemAnalyticsType;
  since: Date;
  now: Date;
}): Promise<AnalyticsEvent[]> {
  const { userId, itemId, itemType, since, now } = input;

  if (itemType === "short_link") {
    const rows = await db
      .select({
        createdAt: shortLinkVisitEvents.createdAt,
        browserName: shortLinkVisitEvents.browserName,
        osName: shortLinkVisitEvents.osName,
        referrerHost: shortLinkVisitEvents.referrerHost,
        referrerUrl: shortLinkVisitEvents.referrerUrl,
        countryCode: shortLinkVisitEvents.countryCode,
        countryName: shortLinkVisitEvents.countryName,
        cityName: shortLinkVisitEvents.cityName,
      })
      .from(shortLinkVisitEvents)
      .where(
        and(
          eq(shortLinkVisitEvents.userId, userId),
          eq(shortLinkVisitEvents.shortLinkId, itemId),
          gte(shortLinkVisitEvents.createdAt, since),
          lt(shortLinkVisitEvents.createdAt, now),
        ),
      );

    return rows
      .filter((row) => row.createdAt)
      .map((row) => ({
        createdAt: row.createdAt as Date,
        browserName: sanitizeText(row.browserName, 120) || null,
        osName: sanitizeText(row.osName, 120) || null,
        referrerHost: sanitizeText(row.referrerHost, 200) || null,
        referrerUrl: sanitizeText(row.referrerUrl, 600) || null,
        countryCode: sanitizeText(row.countryCode, 32) || null,
        countryName: sanitizeText(row.countryName, 120) || null,
        cityName: sanitizeText(row.cityName, 120) || null,
      }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const action = `view.${itemType}`;
  const rows = await db
    .select({
      createdAt: auditLog.createdAt,
      meta: auditLog.meta,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, action),
        eq(auditLog.targetType, itemType),
        eq(auditLog.targetId, itemId),
        gte(auditLog.createdAt, since),
        lt(auditLog.createdAt, now),
      ),
    );

  const output: AnalyticsEvent[] = [];
  for (const row of rows) {
    if (!row.createdAt) continue;
    const meta = parseMetaRecord(row.meta);
    if (!meta) continue;
    const ownerUserId = sanitizeText(meta.ownerUserId, 120);
    if (!ownerUserId || ownerUserId !== userId) continue;

    output.push({
      createdAt: row.createdAt,
      browserName: sanitizeText(meta.browserName, 120) || null,
      osName: sanitizeText(meta.osName, 120) || null,
      referrerHost: sanitizeText(meta.referrerHost, 200) || null,
      referrerUrl: sanitizeText(meta.referrerUrl, 600) || null,
      countryCode: sanitizeText(meta.countryCode, 32) || null,
      countryName: sanitizeText(meta.countryName, 120) || null,
      cityName: sanitizeText(meta.cityName, 120) || null,
    });
  }

  output.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return output;
}

function buildHourlySeries(input: {
  events: AnalyticsEvent[];
  now: Date;
  timeZone: string;
}) {
  const { events, now, timeZone } = input;
  const hourLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const bucketMap = new Map<number, { views: number; visitors: Set<string> }>();
  for (const event of events) {
    const ms = event.createdAt.getTime();
    const bucket = Math.floor(ms / HOUR_MS) * HOUR_MS;
    const hit = bucketMap.get(bucket) ?? {
      views: 0,
      visitors: new Set<string>(),
    };
    hit.views += 1;
    hit.visitors.add(fingerprint(event));
    bucketMap.set(bucket, hit);
  }

  const endBucket = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const startBucket = endBucket - (24 - 1) * HOUR_MS;
  const series: SeriesPoint[] = [];

  for (let cursor = startBucket; cursor <= endBucket; cursor += HOUR_MS) {
    const hit = bucketMap.get(cursor);
    const bucketDate = new Date(cursor);
    series.push({
      bucket: bucketDate.toISOString(),
      label: hourLabelFormatter.format(bucketDate),
      views: hit?.views ?? 0,
      uniqueVisitors: hit?.visitors.size ?? 0,
    });
  }

  return series;
}

function buildDailySeries(input: {
  events: AnalyticsEvent[];
  now: Date;
  days: number;
  timeZone: string;
}) {
  const { events, now, days, timeZone } = input;
  const dayLabelFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  });

  const bucketMap = new Map<number, { views: number; visitors: Set<string> }>();
  for (const event of events) {
    const ms = event.createdAt.getTime();
    const bucket = Math.floor(ms / DAY_MS) * DAY_MS;
    const hit = bucketMap.get(bucket) ?? {
      views: 0,
      visitors: new Set<string>(),
    };
    hit.views += 1;
    hit.visitors.add(fingerprint(event));
    bucketMap.set(bucket, hit);
  }

  const endBucket = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  const startBucket = endBucket - (days - 1) * DAY_MS;
  const series: SeriesPoint[] = [];

  for (let cursor = startBucket; cursor <= endBucket; cursor += DAY_MS) {
    const hit = bucketMap.get(cursor);
    const bucketDate = new Date(cursor);
    series.push({
      bucket: bucketDate.toISOString().slice(0, 10),
      label: dayLabelFormatter.format(bucketDate),
      views: hit?.views ?? 0,
      uniqueVisitors: hit?.visitors.size ?? 0,
    });
  }

  return series;
}

export async function getItemAnalyticsReport(options: {
  userId: string;
  itemType: ItemAnalyticsType;
  itemId: string;
  range: string | null | undefined;
  timeZone: string | null | undefined;
}): Promise<ItemAnalyticsReport | null> {
  const itemId = options.itemId.trim();
  if (!itemId) return null;

  const range = parseRangeKey(options.range);
  const timeZone = parseTimeZone(options.timeZone);
  const now = new Date();
  const since = new Date(now.getTime() - RANGE_HOURS[range] * HOUR_MS);

  const [runtimeSettings, itemMeta] = await Promise.all([
    getPublicRuntimeSettings().catch(() => ({
      appUrl: "",
      sharingDomain: "",
    })),
    loadOwnedItemMeta({
      userId: options.userId,
      itemId,
      itemType: options.itemType,
    }),
  ]);

  if (!itemMeta) return null;

  const matcher = buildInternalHostMatcher([
    runtimeSettings.appUrl,
    runtimeSettings.sharingDomain,
  ]);

  const events = await loadItemEvents({
    userId: options.userId,
    itemId,
    itemType: options.itemType,
    since,
    now,
  });

  const referrerCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const visitorCounts = new Map<string, number>();

  let lastEventAt: Date | null = null;

  for (const event of events) {
    const referrer = normalizeLabel(event.referrerHost, DIRECT);
    const country = normalizeLabel(
      event.countryName || event.countryCode,
      UNKNOWN,
    );
    const city = normalizeLabel(event.cityName, UNKNOWN);
    const source = classifySource(event, matcher);
    const browser = normalizeLabel(event.browserName, UNKNOWN);
    const os = normalizeLabel(event.osName, UNKNOWN);

    pushCount(referrerCounts, referrer);
    pushCount(countryCounts, country);
    pushCount(cityCounts, city);
    pushCount(sourceCounts, source);
    pushCount(browserCounts, browser);
    pushCount(osCounts, os);

    const visitor = fingerprint(event);
    visitorCounts.set(visitor, (visitorCounts.get(visitor) ?? 0) + 1);

    if (!lastEventAt || event.createdAt > lastEventAt) {
      lastEventAt = event.createdAt;
    }
  }

  const totalTrackedViews = events.length;
  let repeatVisitors = 0;
  let repeatViews = 0;

  for (const count of visitorCounts.values()) {
    if (count > 1) {
      repeatVisitors += 1;
      repeatViews += count - 1;
    }
  }

  const timeSeries =
    range === "24h"
      ? buildHourlySeries({ events, now, timeZone })
      : buildDailySeries({
          events,
          now,
          days: Math.trunc(RANGE_HOURS[range] / 24),
          timeZone,
        });

  return {
    generatedAt: now.toISOString(),
    range,
    item: {
      id: itemMeta.id,
      itemType: itemMeta.type,
      title: itemMeta.title,
      subtitle: itemMeta.subtitle,
      slug: itemMeta.slug,
      contentType: prettyType(itemMeta.type),
      lifetimeViews: itemMeta.lifetimeViews,
    },
    summary: {
      trackedViews: totalTrackedViews,
      uniqueVisitors: visitorCounts.size,
      repeatVisitors,
      repeatViews,
      lastEventAt: lastEventAt ? lastEventAt.toISOString() : null,
    },
    contentTypes: [
      {
        label: prettyType(itemMeta.type),
        views: totalTrackedViews,
        pct: totalTrackedViews > 0 ? 100 : 0,
      },
    ],
    timeSeries,
    referrers: mapToRows(referrerCounts, totalTrackedViews),
    countries: mapToRows(countryCounts, totalTrackedViews),
    cities: mapToRows(cityCounts, totalTrackedViews),
    sources: mapToRows(sourceCounts, totalTrackedViews),
    browsers: mapToRows(browserCounts, totalTrackedViews),
    operatingSystems: mapToRows(osCounts, totalTrackedViews),
  };
}
