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

import "server-only";

import { assertSafeExternalHttpUrl } from "@/lib/security/url";

const MAX_ARCHIVE_HTML_LENGTH = 1_000_000;
const MAX_ARCHIVE_TEXT_LENGTH = 120_000;
const MAX_ARCHIVE_EXCERPT_LENGTH = 360;

export type BookmarkSnapshotMode =
  | "none"
  | "local"
  | "internet_archive"
  | "both";

type LocalArchivePayload = {
  archiveTitle: string | null;
  archiveExcerpt: string | null;
  archiveByline: string | null;
  archiveSiteName: string | null;
  archiveLang: string | null;
  archiveText: string | null;
  archiveHtml: string | null;
  archivedAt: Date;
};

export type BookmarkSnapshotResult = {
  local?: {
    ok: boolean;
    error?: string;
    payload?: LocalArchivePayload;
  };
  internetArchive?: {
    ok: boolean;
    error?: string;
    snapshotUrl?: string | null;
  };
};

function truncateText(value: string, limit: number) {
  if (value.length <= limit) return value;
  return value.slice(0, limit);
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtmlToText(html: string) {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, " ");
  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return collapseWhitespace(decoded);
}

function extractTitle(html: string) {
  return collapseWhitespace(
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "",
  );
}

function extractMetaContent(
  html: string,
  key: "name" | "property",
  value: string,
) {
  const escaped = value.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const pattern = new RegExp(
    `<meta[^>]+${key}=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]*${key}=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  const content = match?.[1] || match?.[2] || "";
  return collapseWhitespace(content);
}

function extractHtmlLang(html: string) {
  return collapseWhitespace(
    html.match(/<html[^>]*\slang=["']([^"']+)["']/i)?.[1] || "",
  );
}

async function createLocalArchive(
  url: string,
): Promise<BookmarkSnapshotResult["local"]> {
  try {
    const safeUrl = assertSafeExternalHttpUrl(url);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10_000);

    const response = await fetch(safeUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        ok: false,
        error: `Snapshot fetch failed (${response.status})`,
      };
    }

    const html = await response.text();
    const normalizedHtml = truncateText(html, MAX_ARCHIVE_HTML_LENGTH);
    const fullText = stripHtmlToText(normalizedHtml);
    const archiveText = truncateText(fullText, MAX_ARCHIVE_TEXT_LENGTH);

    const title =
      extractMetaContent(normalizedHtml, "property", "og:title") ||
      extractMetaContent(normalizedHtml, "name", "twitter:title") ||
      extractTitle(normalizedHtml) ||
      safeUrl;

    const description =
      extractMetaContent(normalizedHtml, "property", "og:description") ||
      extractMetaContent(normalizedHtml, "name", "twitter:description") ||
      extractMetaContent(normalizedHtml, "name", "description") ||
      "";

    const byline =
      extractMetaContent(normalizedHtml, "name", "author") ||
      extractMetaContent(normalizedHtml, "property", "article:author") ||
      null;

    const siteName =
      extractMetaContent(normalizedHtml, "property", "og:site_name") ||
      new URL(safeUrl).hostname;

    const excerpt = truncateText(
      description || archiveText,
      MAX_ARCHIVE_EXCERPT_LENGTH,
    );

    return {
      ok: true,
      payload: {
        archiveTitle: title || null,
        archiveExcerpt: excerpt || null,
        archiveByline: byline,
        archiveSiteName: siteName || null,
        archiveLang: extractHtmlLang(normalizedHtml) || null,
        archiveText: archiveText || null,
        archiveHtml: normalizedHtml || null,
        archivedAt: new Date(),
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message || "Failed to create local snapshot",
    };
  }
}

async function submitToInternetArchive(
  url: string,
): Promise<BookmarkSnapshotResult["internetArchive"]> {
  try {
    const safeUrl = assertSafeExternalHttpUrl(url);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10_000);

    const response = await fetch(
      `https://web.archive.org/save/${encodeURIComponent(safeUrl)}`,
      {
        method: "GET",
        signal: ctrl.signal,
        redirect: "manual",
        cache: "no-store",
        headers: {
          "User-Agent": "Swush/1.0 Bookmark Snapshot",
        },
      },
    );

    clearTimeout(timeout);

    if (response.status >= 400) {
      return {
        ok: false,
        error: `Internet Archive request failed (${response.status})`,
      };
    }

    const locationHeader =
      response.headers.get("content-location") ||
      response.headers.get("location");

    const snapshotUrl = locationHeader
      ? new URL(locationHeader, "https://web.archive.org").toString()
      : null;

    return {
      ok: true,
      snapshotUrl,
    };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message || "Failed to submit to Internet Archive",
    };
  }
}

export function normalizeBookmarkSnapshotMode(
  value: unknown,
): BookmarkSnapshotMode {
  if (value === "local") return "local";
  if (value === "internet_archive") return "internet_archive";
  if (value === "both") return "both";
  return "none";
}

export async function createBookmarkSnapshot(options: {
  url: string;
  mode: BookmarkSnapshotMode;
}): Promise<BookmarkSnapshotResult> {
  const mode = normalizeBookmarkSnapshotMode(options.mode);
  const result: BookmarkSnapshotResult = {};

  if (mode === "local" || mode === "both") {
    result.local = await createLocalArchive(options.url);
  }

  if (mode === "internet_archive" || mode === "both") {
    result.internetArchive = await submitToInternetArchive(options.url);
  }

  return result;
}
