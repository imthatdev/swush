/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { assertSafeExternalHttpUrl } from "@/lib/security/url";

type MetaAttrs = Record<string, string>;

function parseMetaTags(html: string): MetaAttrs[] {
  const metaTagRe = /<meta\b[^>]*>/gi;
  const attrRe = /([^\s=/>]+)\s*=\s*["']([^"']*)["']/gi;
  const tags: MetaAttrs[] = [];

  let tagMatch: RegExpExecArray | null = null;
  while ((tagMatch = metaTagRe.exec(html)) !== null) {
    const attrs: MetaAttrs = {};
    const tag = tagMatch[0];
    let attrMatch: RegExpExecArray | null = null;
    while ((attrMatch = attrRe.exec(tag)) !== null) {
      attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
    }
    tags.push(attrs);
  }

  return tags;
}

function findMetaContent(tags: MetaAttrs[], key: string, value: string) {
  const wantedKey = key.toLowerCase();
  const wantedValue = value.toLowerCase();
  const match = tags.find(
    (attrs) => (attrs[wantedKey] || "").toLowerCase() === wantedValue,
  );
  const content = match?.content?.trim();
  return content || null;
}

export async function fetchPageMeta(targetUrl: string): Promise<{
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}> {
  try {
    const safeTargetUrl = assertSafeExternalHttpUrl(targetUrl);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(safeTargetUrl, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return {};
    const html = await res.text();
    const metaTags = parseMetaTags(html);

    let title =
      findMetaContent(metaTags, "property", "og:title") ||
      findMetaContent(metaTags, "name", "twitter:title") ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ||
      null;

    let description =
      findMetaContent(metaTags, "property", "og:description") ||
      findMetaContent(metaTags, "name", "twitter:description") ||
      findMetaContent(metaTags, "name", "description") ||
      null;

    let imageUrl =
      findMetaContent(metaTags, "property", "og:image") ||
      findMetaContent(metaTags, "name", "twitter:image") ||
      null;

    title = title?.trim() || null;
    description = description?.trim() || null;
    imageUrl = imageUrl?.trim() || null;

    if (imageUrl) {
      try {
        imageUrl = new URL(imageUrl, safeTargetUrl).toString();
      } catch {}
    }

    return { title, description, imageUrl };
  } catch {
    return {};
  }
}

export function getAppOrigin(appUrl?: string | null) {
  return resolveShareOrigin({ appUrl });
}

type BuildShareUrlOptions = {
  appUrl?: string | null;
  sharingDomain?: string | null;
  query?:
    | URLSearchParams
    | Record<string, string | number | boolean | null | undefined>;
};

type ShareUrlOptions = {
  anonymous?: boolean;
  appUrl?: string | null;
  sharingDomain?: string | null;
};

function normalizeHttpOrigin(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

export function normalizeSharingDomain(value?: string | null) {
  return normalizeHttpOrigin(value);
}

function getRuntimeConfigOrigin(key: "appUrl" | "sharingDomain") {
  if (typeof document === "undefined") return "";
  const body = document.body;
  if (!body) return "";

  const raw =
    key === "sharingDomain" ? body.dataset.sharingDomain : body.dataset.appUrl;
  return normalizeHttpOrigin(raw);
}

function resolveShareOrigin(options?: {
  appUrl?: string | null;
  sharingDomain?: string | null;
}) {
  const sharingDomain =
    normalizeHttpOrigin(options?.sharingDomain) ||
    getRuntimeConfigOrigin("sharingDomain");
  if (sharingDomain) return sharingDomain;

  const appOrigin =
    normalizeHttpOrigin(options?.appUrl) || getRuntimeConfigOrigin("appUrl");
  if (appOrigin) return appOrigin;

  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return "";
}

export function buildShareUrl(path: string, options?: BuildShareUrlOptions) {
  const trimmedPath = path.trim();
  if (!trimmedPath) return "";

  const normalizedPath = trimmedPath.startsWith("/")
    ? trimmedPath
    : `/${trimmedPath}`;
  const base = resolveShareOrigin(options);
  const output = base ? `${base}${normalizedPath}` : normalizedPath;

  const query = options?.query;
  if (!query) return output;

  const params =
    query instanceof URLSearchParams
      ? new URLSearchParams(query)
      : new URLSearchParams();
  if (!(query instanceof URLSearchParams)) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined) continue;
      params.set(key, String(value));
    }
  }

  const suffix = params.toString();
  return suffix ? `${output}?${suffix}` : output;
}

export function shareUrl(
  page: string,
  slug: string | null | undefined,
  options?: ShareUrlOptions,
) {
  if (!slug) return "";
  const params = new URLSearchParams();
  if (options?.anonymous) params.set("anon", "1");
  return buildShareUrl(`/${page}/${slug}`, {
    appUrl: options?.appUrl,
    sharingDomain: options?.sharingDomain,
    query: params,
  });
}

export function randomPassword(length = 16) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?";
  const chars = upper + lower + digits + symbols;
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  const pick = (set: string) =>
    set[buf[Math.floor(Math.random() * buf.length)] % set.length];

  const seed = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from(buf)
    .slice(0, Math.max(0, length - seed.length))
    .map((v) => chars[v % chars.length]);
  const out = [...seed, ...rest];
  for (let i = out.length - 1; i > 0; i--) {
    const j = buf[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}
