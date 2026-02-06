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

export async function fetchPageMeta(targetUrl: string): Promise<{
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(targetUrl, {
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

    const findMeta = (key: string, value: string) => {
      const re = new RegExp(
        `<meta[^>]+${key}=["']${value.replace(
          /[-/\\^$*+?.()|[\]{}]/g,
          "\\$&",
        )}["'][^>]*?>`,
        "i",
      );
      const tag = html.match(re)?.[0];
      if (!tag) return null;
      const content = tag.match(/content=[\"']([^\"']+)[\"']/i)?.[1];
      return content || null;
    };

    let title =
      findMeta("property", "og:title") ||
      findMeta("name", "twitter:title") ||
      html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ||
      null;

    let description =
      findMeta("property", "og:description") ||
      findMeta("name", "twitter:description") ||
      findMeta("name", "description") ||
      null;

    let imageUrl =
      findMeta("property", "og:image") ||
      findMeta("name", "twitter:image") ||
      null;

    title = title?.trim() || null;
    description = description?.trim() || null;
    imageUrl = imageUrl?.trim() || null;

    if (imageUrl) {
      try {
        imageUrl = new URL(imageUrl, targetUrl).toString();
      } catch {}
    }

    return { title, description, imageUrl };
  } catch {
    return {};
  }
}

export function getAppOrigin(appUrl?: string | null) {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return appUrl || "";
}

export function shareUrl(
  page: string,
  slug: string | null | undefined,
  options?: { anonymous?: boolean },
) {
  if (!slug) return "";
  const base = getAppOrigin();
  const path = base ? `${base}/${page}/${slug}` : `/${page}/${slug}`;
  const params = new URLSearchParams();
  if (options?.anonymous) params.set("anon", "1");
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
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
