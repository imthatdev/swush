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

import { writeAudit } from "@/lib/api/audit";

type HeadersLike = Pick<Headers, "get">;

type ContentViewType = "file" | "bookmark" | "note" | "snippet" | "recipe";

type ContentViewCaptureInput = {
  ownerUserId: string;
  itemType: ContentViewType;
  itemId: string;
  slug: string;
  headers: HeadersLike;
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

export async function recordContentViewEvent(input: ContentViewCaptureInput) {
  if (!input.ownerUserId || !input.itemType || !input.itemId) return;

  const userAgent = sanitizeText(input.headers.get("user-agent"), 512) || "";
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

  try {
    await writeAudit({
      actorId: null,
      actorRole: "anonymous",
      action: `view.${input.itemType}`,
      targetType: input.itemType,
      targetId: input.itemId,
      statusCode: "200",
      userAgent,
      meta: {
        ownerUserId: input.ownerUserId,
        slug: input.slug,
        browserName: parseBrowserName(userAgent),
        osName: parseOsName(userAgent),
        referrerHost: referrer.host,
        referrerUrl: referrer.url,
        countryCode,
        countryName,
        cityName: getCityName(input.headers),
      },
    });
  } catch {
    // Content view analytics should never block public read behavior.
  }
}
