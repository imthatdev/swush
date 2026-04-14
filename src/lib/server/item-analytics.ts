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

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bookmarks, files, shortLinks } from "@/db/schemas";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";

type HeadersLike = Pick<Headers, "get">;

export type ItemAnalyticsType = "file" | "bookmark" | "short_link";

type ItemAnalyticsPayload = {
  interactions: number;
  lastEventAt: string | null;
  byCountry: Record<string, number>;
  byCity: Record<string, number>;
  byReferrer: Record<string, number>;
  bySource: Record<string, number>;
  byContext: Record<string, number>;
  byBrowser: Record<string, number>;
  byOs: Record<string, number>;
};

type HitDimensions = {
  country: string;
  city: string;
  referrer: string;
  source: string;
  context: string;
  browser: string;
  os: string;
};

type InternalHostMatcher = {
  hosts: Set<string>;
  roots: Set<string>;
};

const UNKNOWN = "Unknown";
const DIRECT = "Direct";

function sanitizeText(value: string | null | undefined, max = 120) {
  if (!value) return "";
  return value.trim().slice(0, max);
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

function buildInternalMatcher(candidates: Array<string | null | undefined>) {
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

function firstHeader(headers: HeadersLike, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value?.trim()) return value.trim();
  }
  return "";
}

function parseBrowserName(userAgentRaw: string | null) {
  const ua = (userAgentRaw || "").toLowerCase();
  if (!ua) return UNKNOWN;
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
  if (!ua) return UNKNOWN;
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

function parseReferrerHost(referrerRaw: string | null) {
  const clean = sanitizeText(referrerRaw, 600);
  if (!clean) return DIRECT;
  return hostFromUrl(clean) || sanitizeText(clean, 200) || DIRECT;
}

function parseCountry(headers: HeadersLike) {
  const countryName = sanitizeText(
    firstHeader(headers, [
      "x-vercel-ip-country-name",
      "cloudfront-viewer-country-name",
      "x-country-name",
    ]),
    120,
  );
  if (countryName) return countryName;
  const countryCode = sanitizeText(
    firstHeader(headers, [
      "x-vercel-ip-country",
      "cf-ipcountry",
      "cloudfront-viewer-country",
      "x-country-code",
    ]),
    32,
  ).toUpperCase();
  return countryCode || UNKNOWN;
}

function parseCity(headers: HeadersLike) {
  return (
    sanitizeText(
      firstHeader(headers, [
        "x-vercel-ip-city",
        "cloudfront-viewer-city",
        "cf-ipcity",
        "x-city",
      ]),
      120,
    ) || UNKNOWN
  );
}

function parseSourceType(input: {
  browser: string;
  os: string;
  referrerUrl: string;
  referrerHost: string;
  matcher: InternalHostMatcher;
}) {
  const browser = input.browser.toLowerCase();
  const referrerUrl = input.referrerUrl.toLowerCase();
  if (browser === "curl" || browser === "postman") return "API";
  if (
    referrerUrl.startsWith("chrome-extension://") ||
    referrerUrl.startsWith("moz-extension://")
  ) {
    return "Extension";
  }
  if (input.os === "Android" || input.os === "iOS") return "Mobile";
  if (isInternalHost(input.referrerHost, input.matcher)) return "Internal";
  return "Web";
}

function asCountMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, number>;
  }
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const label = sanitizeText(key, 120);
    if (!label) continue;
    const numeric =
      typeof raw === "number"
        ? raw
        : typeof raw === "string"
          ? Number(raw)
          : 0;
    if (Number.isFinite(numeric) && numeric > 0) out[label] = numeric;
  }
  return out;
}

function normalizeAnalytics(value: unknown): ItemAnalyticsPayload {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    interactions:
      typeof raw.interactions === "number" && Number.isFinite(raw.interactions)
        ? raw.interactions
        : 0,
    lastEventAt:
      typeof raw.lastEventAt === "string" && raw.lastEventAt.trim()
        ? raw.lastEventAt
        : null,
    byCountry: asCountMap(raw.byCountry),
    byCity: asCountMap(raw.byCity),
    byReferrer: asCountMap(raw.byReferrer),
    bySource: asCountMap(raw.bySource),
    byContext: asCountMap(raw.byContext),
    byBrowser: asCountMap(raw.byBrowser),
    byOs: asCountMap(raw.byOs),
  };
}

function incrementCounter(map: Record<string, number>, key: string) {
  const label = sanitizeText(key, 120) || UNKNOWN;
  map[label] = (map[label] ?? 0) + 1;
}

function applyHit(analytics: ItemAnalyticsPayload, hit: HitDimensions, nowIso: string) {
  analytics.interactions += 1;
  analytics.lastEventAt = nowIso;
  incrementCounter(analytics.byCountry, hit.country);
  incrementCounter(analytics.byCity, hit.city);
  incrementCounter(analytics.byReferrer, hit.referrer);
  incrementCounter(analytics.bySource, hit.source);
  incrementCounter(analytics.byContext, hit.context);
  incrementCounter(analytics.byBrowser, hit.browser);
  incrementCounter(analytics.byOs, hit.os);
  return analytics;
}

async function selectAnalytics(type: ItemAnalyticsType, itemId: string) {
  switch (type) {
    case "file": {
      const [row] = await db
        .select({ analytics: files.analytics })
        .from(files)
        .where(eq(files.id, itemId))
        .limit(1);
      return row?.analytics;
    }
    case "bookmark": {
      const [row] = await db
        .select({ analytics: bookmarks.analytics })
        .from(bookmarks)
        .where(eq(bookmarks.id, itemId))
        .limit(1);
      return row?.analytics;
    }
    case "short_link": {
      const [row] = await db
        .select({ analytics: shortLinks.analytics })
        .from(shortLinks)
        .where(eq(shortLinks.id, itemId))
        .limit(1);
      return row?.analytics;
    }
  }
}

async function updateAnalytics(
  type: ItemAnalyticsType,
  itemId: string,
  analytics: ItemAnalyticsPayload,
) {
  switch (type) {
    case "file":
      await db.update(files).set({ analytics }).where(eq(files.id, itemId));
      return;
    case "bookmark":
      await db
        .update(bookmarks)
        .set({ analytics })
        .where(eq(bookmarks.id, itemId));
      return;
    case "short_link":
      await db
        .update(shortLinks)
        .set({ analytics })
        .where(eq(shortLinks.id, itemId));
      return;
  }
}

export async function recordItemAnalyticsHit(input: {
  itemType: ItemAnalyticsType;
  itemId: string;
  headers: HeadersLike;
  context?: string | null;
}) {
  if (!input.itemId) return;

  try {
    const runtime = await getPublicRuntimeSettings().catch(() => ({
      appUrl: "",
      sharingDomain: "",
    }));
    const matcher = buildInternalMatcher([
      runtime.appUrl,
      runtime.sharingDomain,
      input.headers.get("host"),
      input.headers.get("x-forwarded-host"),
      input.headers.get("origin"),
      input.headers.get("referer"),
    ]);

    const userAgent = input.headers.get("user-agent");
    const browser = parseBrowserName(userAgent);
    const os = parseOsName(userAgent);
    const referrerUrl = sanitizeText(input.headers.get("referer"), 600);
    const referrerHost = parseReferrerHost(referrerUrl || null);
    const source = parseSourceType({
      browser,
      os,
      referrerUrl,
      referrerHost,
      matcher,
    });

    const nowIso = new Date().toISOString();
    const hit: HitDimensions = {
      country: parseCountry(input.headers),
      city: parseCity(input.headers),
      referrer: referrerHost || DIRECT,
      source,
      context:
        sanitizeText(input.context, 120).toLowerCase() ||
        sanitizeText(input.itemType, 120).toLowerCase() ||
        UNKNOWN.toLowerCase(),
      browser,
      os,
    };

    const existing = normalizeAnalytics(
      await selectAnalytics(input.itemType, input.itemId),
    );
    const next = applyHit(existing, hit, nowIso);
    await updateAnalytics(input.itemType, input.itemId, next);
  } catch {
    // Analytics aggregation should never break public/view flows.
  }
}
