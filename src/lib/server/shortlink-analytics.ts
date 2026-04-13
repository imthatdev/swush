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

import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { shortLinkVisitEvents, shortLinks } from "@/db/schemas";

type HeadersLike = Pick<Headers, "get">;

type VisitCaptureInput = {
  shortLinkId: string;
  userId: string;
  slug: string;
  destinationUrl: string;
  headers: HeadersLike;
};

type AnalyticsDimensionRow = {
  label: string;
  count: number;
  byLink: Record<string, number>;
};

type AnalyticsTimeRow = {
  date: string;
  total: number;
  byLink: Record<string, number>;
};

type AnalyticsLinkMeta = {
  id: string;
  slug: string;
  originalUrl: string;
  clickCount: number;
  trackedClicks: number;
};

export type ShortLinkAnalyticsPayload = {
  generatedAt: string;
  days: number;
  links: AnalyticsLinkMeta[];
  totalTrackedClicks: number;
  timeSeries: AnalyticsTimeRow[];
  browsers: AnalyticsDimensionRow[];
  operatingSystems: AnalyticsDimensionRow[];
  referrers: AnalyticsDimensionRow[];
  utmSources: AnalyticsDimensionRow[];
  countries: AnalyticsDimensionRow[];
  cities: AnalyticsDimensionRow[];
};

const UNKNOWN_LABEL = "Unknown";
const DIRECT_LABEL = "Direct";

function firstHeader(headers: HeadersLike, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value && value.trim()) return value.trim();
  }
  return null;
}

function sanitizeText(value: string | null | undefined, max = 180) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function parseBrowserName(userAgentRaw: string | null) {
  const ua = (userAgentRaw || "").toLowerCase();
  if (!ua) return UNKNOWN_LABEL;
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("samsungbrowser")) return "Samsung Internet";
  if (ua.includes("curl/")) return "curl";
  if (ua.includes("postmanruntime")) return "Postman";
  return "Other";
}

function parseOsName(userAgentRaw: string | null) {
  const ua = (userAgentRaw || "").toLowerCase();
  if (!ua) return UNKNOWN_LABEL;
  if (ua.includes("windows nt")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
    return "iOS";
  }
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("cros")) return "ChromeOS";
  if (ua.includes("linux")) return "Linux";
  return "Other";
}

function parseReferrer(referrerRaw: string | null) {
  const clean = sanitizeText(referrerRaw, 600);
  if (!clean) return { host: DIRECT_LABEL, url: null as string | null };
  try {
    const ref = new URL(clean);
    const host = sanitizeText(ref.hostname, 200) || DIRECT_LABEL;
    return { host, url: clean };
  } catch {
    return { host: sanitizeText(clean, 200) || DIRECT_LABEL, url: clean };
  }
}

function extractUtmFromDestination(destinationUrl: string) {
  try {
    const url = new URL(destinationUrl);
    return {
      utmSource: sanitizeText(url.searchParams.get("utm_source"), 120),
      utmMedium: sanitizeText(url.searchParams.get("utm_medium"), 120),
      utmCampaign: sanitizeText(url.searchParams.get("utm_campaign"), 120),
      utmTerm: sanitizeText(url.searchParams.get("utm_term"), 120),
      utmContent: sanitizeText(url.searchParams.get("utm_content"), 120),
    };
  } catch {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmTerm: null,
      utmContent: null,
    };
  }
}

function resolveCountryName(countryCode: string | null) {
  if (!countryCode || countryCode.length !== 2) return null;
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return sanitizeText(
      displayNames.of(countryCode.toUpperCase()) ?? null,
      120,
    );
  } catch {
    return null;
  }
}

function getCountryCode(headers: HeadersLike) {
  const code = firstHeader(headers, [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "cloudfront-viewer-country",
    "x-country-code",
  ]);
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return normalized.length === 2 ? normalized : null;
}

function getCityName(headers: HeadersLike) {
  const city = firstHeader(headers, [
    "x-vercel-ip-city",
    "cloudfront-viewer-city",
    "cf-ipcity",
    "x-city",
  ]);
  return sanitizeText(city, 120);
}

function normalizeDimensionLabel(
  label: string | null | undefined,
  fallback: string,
) {
  const value = sanitizeText(label, 180);
  return value || fallback;
}

function pushDimensionCount(
  map: Map<string, AnalyticsDimensionRow>,
  label: string,
  shortLinkId: string,
) {
  const key = label.toLowerCase();
  const current = map.get(key);
  if (!current) {
    map.set(key, {
      label,
      count: 1,
      byLink: { [shortLinkId]: 1 },
    });
    return;
  }
  current.count += 1;
  current.byLink[shortLinkId] = (current.byLink[shortLinkId] ?? 0) + 1;
}

function defaultDimensionSort(
  a: AnalyticsDimensionRow,
  b: AnalyticsDimensionRow,
) {
  return b.count - a.count || a.label.localeCompare(b.label);
}

export async function recordShortLinkVisit(input: VisitCaptureInput) {
  if (!input.shortLinkId || !input.userId || !input.slug) return;

  const browserName = parseBrowserName(input.headers.get("user-agent"));
  const osName = parseOsName(input.headers.get("user-agent"));
  const referrer = parseReferrer(input.headers.get("referer"));
  const countryCode = getCountryCode(input.headers);
  const countryName =
    sanitizeText(
      firstHeader(input.headers, [
        "x-vercel-ip-country-name",
        "cloudfront-viewer-country-name",
        "x-country-name",
      ]),
      120,
    ) || resolveCountryName(countryCode);
  const cityName = getCityName(input.headers);
  const utm = extractUtmFromDestination(input.destinationUrl);

  try {
    await db.insert(shortLinkVisitEvents).values({
      shortLinkId: input.shortLinkId,
      userId: input.userId,
      slug: input.slug,
      browserName,
      osName,
      referrerHost: referrer.host,
      referrerUrl: referrer.url,
      utmSource: utm.utmSource,
      utmMedium: utm.utmMedium,
      utmCampaign: utm.utmCampaign,
      utmTerm: utm.utmTerm,
      utmContent: utm.utmContent,
      countryCode,
      countryName,
      cityName,
    });
  } catch {
    // Visit analytics should never block redirect behavior.
  }
}

export async function getShortLinkAnalytics(options: {
  userId: string;
  shortLinkIds: string[];
  days: number;
}): Promise<ShortLinkAnalyticsPayload> {
  const days = Math.min(Math.max(options.days || 30, 1), 365);
  const uniqueIds = Array.from(
    new Set(options.shortLinkIds.map((id) => id.trim()).filter(Boolean)),
  );

  if (!uniqueIds.length) {
    return {
      generatedAt: new Date().toISOString(),
      days,
      links: [],
      totalTrackedClicks: 0,
      timeSeries: [],
      browsers: [],
      operatingSystems: [],
      referrers: [],
      utmSources: [],
      countries: [],
      cities: [],
    };
  }

  const links = await db
    .select({
      id: shortLinks.id,
      slug: shortLinks.slug,
      originalUrl: shortLinks.originalUrl,
      clickCount: shortLinks.clickCount,
    })
    .from(shortLinks)
    .where(
      and(
        eq(shortLinks.userId, options.userId),
        inArray(shortLinks.id, uniqueIds),
      ),
    );

  if (!links.length) {
    return {
      generatedAt: new Date().toISOString(),
      days,
      links: [],
      totalTrackedClicks: 0,
      timeSeries: [],
      browsers: [],
      operatingSystems: [],
      referrers: [],
      utmSources: [],
      countries: [],
      cities: [],
    };
  }

  const allowedIds = links.map((link) => link.id);
  const since = new Date();
  since.setDate(since.getDate() - days + 1);

  const events = await db
    .select({
      shortLinkId: shortLinkVisitEvents.shortLinkId,
      createdAt: shortLinkVisitEvents.createdAt,
      browserName: shortLinkVisitEvents.browserName,
      osName: shortLinkVisitEvents.osName,
      referrerHost: shortLinkVisitEvents.referrerHost,
      utmSource: shortLinkVisitEvents.utmSource,
      countryCode: shortLinkVisitEvents.countryCode,
      countryName: shortLinkVisitEvents.countryName,
      cityName: shortLinkVisitEvents.cityName,
    })
    .from(shortLinkVisitEvents)
    .where(
      and(
        eq(shortLinkVisitEvents.userId, options.userId),
        inArray(shortLinkVisitEvents.shortLinkId, allowedIds),
        gte(shortLinkVisitEvents.createdAt, since),
      ),
    );

  const timeMap = new Map<string, AnalyticsTimeRow>();
  const browserMap = new Map<string, AnalyticsDimensionRow>();
  const osMap = new Map<string, AnalyticsDimensionRow>();
  const referrerMap = new Map<string, AnalyticsDimensionRow>();
  const utmSourceMap = new Map<string, AnalyticsDimensionRow>();
  const countryMap = new Map<string, AnalyticsDimensionRow>();
  const cityMap = new Map<string, AnalyticsDimensionRow>();
  const trackedByLink: Record<string, number> = {};

  for (const row of events) {
    const rowDate = new Date(row.createdAt ?? new Date());
    const date = Number.isNaN(rowDate.getTime())
      ? new Date().toISOString().slice(0, 10)
      : rowDate.toISOString().slice(0, 10);

    const timeBucket = timeMap.get(date);
    if (!timeBucket) {
      timeMap.set(date, {
        date,
        total: 1,
        byLink: { [row.shortLinkId]: 1 },
      });
    } else {
      timeBucket.total += 1;
      timeBucket.byLink[row.shortLinkId] =
        (timeBucket.byLink[row.shortLinkId] ?? 0) + 1;
    }

    trackedByLink[row.shortLinkId] = (trackedByLink[row.shortLinkId] ?? 0) + 1;

    pushDimensionCount(
      browserMap,
      normalizeDimensionLabel(row.browserName, UNKNOWN_LABEL),
      row.shortLinkId,
    );
    pushDimensionCount(
      osMap,
      normalizeDimensionLabel(row.osName, UNKNOWN_LABEL),
      row.shortLinkId,
    );
    pushDimensionCount(
      referrerMap,
      normalizeDimensionLabel(row.referrerHost, DIRECT_LABEL),
      row.shortLinkId,
    );
    pushDimensionCount(
      utmSourceMap,
      normalizeDimensionLabel(row.utmSource, UNKNOWN_LABEL),
      row.shortLinkId,
    );
    pushDimensionCount(
      countryMap,
      normalizeDimensionLabel(
        row.countryName || row.countryCode,
        UNKNOWN_LABEL,
      ),
      row.shortLinkId,
    );
    pushDimensionCount(
      cityMap,
      normalizeDimensionLabel(row.cityName, UNKNOWN_LABEL),
      row.shortLinkId,
    );
  }

  const analyticsLinks: AnalyticsLinkMeta[] = links
    .map((link) => ({
      id: link.id,
      slug: link.slug,
      originalUrl: link.originalUrl,
      clickCount: Number(link.clickCount ?? 0),
      trackedClicks: trackedByLink[link.id] ?? 0,
    }))
    .sort(
      (a, b) =>
        b.trackedClicks - a.trackedClicks || a.slug.localeCompare(b.slug),
    );

  const timeSeries = Array.from(timeMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    generatedAt: new Date().toISOString(),
    days,
    links: analyticsLinks,
    totalTrackedClicks: events.length,
    timeSeries,
    browsers: Array.from(browserMap.values()).sort(defaultDimensionSort),
    operatingSystems: Array.from(osMap.values()).sort(defaultDimensionSort),
    referrers: Array.from(referrerMap.values()).sort(defaultDimensionSort),
    utmSources: Array.from(utmSourceMap.values()).sort(defaultDimensionSort),
    countries: Array.from(countryMap.values()).sort(defaultDimensionSort),
    cities: Array.from(cityMap.values()).sort(defaultDimensionSort),
  };
}
