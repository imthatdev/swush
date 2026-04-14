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

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLog, shortLinkVisitEvents } from "@/db/schemas";

export type TrackedMetricsEvent = {
  createdAt: Date;
  browserName: string | null;
  osName: string | null;
  referrerHost: string | null;
  referrerUrl: string | null;
  countryCode: string | null;
  countryName: string | null;
  cityName: string | null;
  itemKey: string;
};

const VIEW_ACTIONS = ["view.file", "view.bookmark"] as const;
const READ_ACTIONS = ["file.read", "bookmark.read"] as const;

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseMetaRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseBrowserName(userAgentRaw: string | null) {
  const ua = (userAgentRaw || "").toLowerCase();
  if (!ua) return null;
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/") && !ua.includes("edg/")) return "Chrome";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  return null;
}

function parseOsName(userAgentRaw: string | null) {
  const ua = (userAgentRaw || "").toLowerCase();
  if (!ua) return null;
  if (ua.includes("windows nt")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) {
    return "iOS";
  }
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("cros")) return "ChromeOS";
  if (ua.includes("linux")) return "Linux";
  return null;
}

function eventFromMetaRow(input: {
  createdAt: Date | null;
  targetType: string | null;
  targetId: string | null;
  meta: unknown;
  expectedOwnerUserId: string;
}) {
  if (!input.createdAt || !input.targetId) return null;
  const meta = parseMetaRecord(input.meta);
  if (!meta) return null;
  const ownerUserId = normalizeText(meta.ownerUserId);
  if (!ownerUserId || ownerUserId !== input.expectedOwnerUserId) return null;

  const targetType = normalizeText(input.targetType) || "item";
  return {
    createdAt: input.createdAt,
    browserName: normalizeText(meta.browserName),
    osName: normalizeText(meta.osName),
    referrerHost: normalizeText(meta.referrerHost),
    referrerUrl: normalizeText(meta.referrerUrl),
    countryCode: normalizeText(meta.countryCode),
    countryName: normalizeText(meta.countryName),
    cityName: normalizeText(meta.cityName),
    itemKey: `${targetType}:${input.targetId}`,
  } satisfies TrackedMetricsEvent;
}

function eventFromReadRow(input: {
  createdAt: Date | null;
  targetType: string | null;
  targetId: string | null;
  userAgent: string | null;
}) {
  if (!input.createdAt || !input.targetId) return null;
  const targetType = normalizeText(input.targetType) || "item";
  return {
    createdAt: input.createdAt,
    browserName: parseBrowserName(input.userAgent),
    osName: parseOsName(input.userAgent),
    referrerHost: null,
    referrerUrl: null,
    countryCode: null,
    countryName: null,
    cityName: null,
    itemKey: `${targetType}:${input.targetId}`,
  } satisfies TrackedMetricsEvent;
}

export async function loadTrackedMetricsEvents(options: {
  userId: string;
  from: Date;
  to: Date;
}) {
  const [shortVisits, ownerViewEvents, actorReadEvents] = await Promise.all([
    db
      .select({
        createdAt: shortLinkVisitEvents.createdAt,
        browserName: shortLinkVisitEvents.browserName,
        osName: shortLinkVisitEvents.osName,
        referrerHost: shortLinkVisitEvents.referrerHost,
        referrerUrl: shortLinkVisitEvents.referrerUrl,
        countryCode: shortLinkVisitEvents.countryCode,
        countryName: shortLinkVisitEvents.countryName,
        cityName: shortLinkVisitEvents.cityName,
        shortLinkId: shortLinkVisitEvents.shortLinkId,
      })
      .from(shortLinkVisitEvents)
      .where(
        and(
          eq(shortLinkVisitEvents.userId, options.userId),
          gte(shortLinkVisitEvents.createdAt, options.from),
          lt(shortLinkVisitEvents.createdAt, options.to),
        ),
      ),
    db
      .select({
        createdAt: auditLog.createdAt,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        meta: auditLog.meta,
      })
      .from(auditLog)
      .where(
        and(
          inArray(auditLog.action, [...VIEW_ACTIONS]),
          gte(auditLog.createdAt, options.from),
          lt(auditLog.createdAt, options.to),
        ),
      ),
    db
      .select({
        createdAt: auditLog.createdAt,
        targetType: auditLog.targetType,
        targetId: auditLog.targetId,
        userAgent: auditLog.userAgent,
      })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.actorId, options.userId),
          inArray(auditLog.action, [...READ_ACTIONS]),
          gte(auditLog.createdAt, options.from),
          lt(auditLog.createdAt, options.to),
        ),
      ),
  ]);

  const output: TrackedMetricsEvent[] = [];

  for (const row of shortVisits) {
    if (!row.createdAt) continue;
    output.push({
      createdAt: row.createdAt,
      browserName: normalizeText(row.browserName),
      osName: normalizeText(row.osName),
      referrerHost: normalizeText(row.referrerHost),
      referrerUrl: normalizeText(row.referrerUrl),
      countryCode: normalizeText(row.countryCode),
      countryName: normalizeText(row.countryName),
      cityName: normalizeText(row.cityName),
      itemKey: `short_link:${row.shortLinkId}`,
    });
  }

  for (const row of ownerViewEvents) {
    const parsed = eventFromMetaRow({
      createdAt: row.createdAt,
      targetType: row.targetType,
      targetId: row.targetId,
      meta: row.meta,
      expectedOwnerUserId: options.userId,
    });
    if (parsed) output.push(parsed);
  }

  for (const row of actorReadEvents) {
    const parsed = eventFromReadRow({
      createdAt: row.createdAt,
      targetType: row.targetType,
      targetId: row.targetId,
      userAgent: row.userAgent,
    });
    if (parsed) output.push(parsed);
  }

  output.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return output;
}
