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

import { JSDOM } from "jsdom";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bookmarks } from "@/db/schemas/core-schema";
import {
  createBookmark,
  type CreateBookmarkInput,
  listBookmarksForExport,
} from "@/lib/api/bookmarks";
import { normalizeTagName } from "@/lib/tag-names";
import { assertSafeExternalHttpUrl } from "@/lib/security/url";

const MAX_IMPORT_ITEMS = 1000;

export type BookmarkExportFormat = "json" | "html";

type ExportBookmark = {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  slug: string | null;
  tags: string[];
  isFavorite: boolean;
  isPublic: boolean;
  createdAt: string | null;
};

type NormalizedImportBookmark = {
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  slug: string | null;
  tags: string[];
  isFavorite: boolean;
  isPublic: boolean;
};

export type BookmarkImportSummary = {
  total: number;
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function asString(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function toOptionalString(value: unknown) {
  const text = asString(value);
  return text ? text : null;
}

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["1", "true", "yes", "on"].includes(value.toLowerCase().trim());
  }
  return false;
}

function normalizeTags(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return Array.from(
    new Set(source.map((tag) => normalizeTagName(String(tag))).filter(Boolean)),
  );
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(input: string) {
  return escapeHtml(input).replaceAll("'", "&#39;");
}

function normalizeForImport(value: unknown): NormalizedImportBookmark | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;

  const sourceUrl = asString(item.url || item.href);
  if (!sourceUrl) return null;

  let safeUrl = "";
  try {
    safeUrl = assertSafeExternalHttpUrl(sourceUrl);
  } catch {
    return null;
  }

  const tags = normalizeTags(item.tags);
  const title = asString(item.title) || safeUrl;
  const description = toOptionalString(item.description);
  const imageUrl = toOptionalString(item.imageUrl || item.image);
  const slug = toOptionalString(item.slug);

  return {
    url: safeUrl,
    title,
    description,
    imageUrl,
    slug,
    tags,
    isFavorite: toBoolean(item.isFavorite || item.favorite),
    isPublic: toBoolean(item.isPublic || item.public),
  };
}

function toExportBookmark(
  value: Awaited<ReturnType<typeof listBookmarksForExport>>[number],
): ExportBookmark {
  return {
    url: value.url,
    title: value.title || value.url,
    description: value.description ?? null,
    imageUrl: value.imageUrl ?? null,
    slug: value.slug ?? null,
    tags: value.tags ?? [],
    isFavorite: Boolean(value.isFavorite),
    isPublic: Boolean(value.isPublic),
    createdAt: value.createdAt ? value.createdAt.toISOString() : null,
  };
}

function renderBookmarksHtml(items: ExportBookmark[]) {
  const lines = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file.",
    "     It can be imported by most browsers. -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Swush Bookmarks</TITLE>",
    "<H1>Swush Bookmarks</H1>",
    "<DL><p>",
  ];

  for (const item of items) {
    const attrs: string[] = [`HREF="${escapeAttr(item.url)}"`];
    if (item.createdAt) {
      const ts = Math.floor(new Date(item.createdAt).getTime() / 1000);
      if (Number.isFinite(ts) && ts > 0) attrs.push(`ADD_DATE="${ts}"`);
    }
    if (item.tags.length > 0) {
      attrs.push(`TAGS="${escapeAttr(item.tags.join(","))}"`);
    }
    attrs.push(`SWUSH_FAVORITE="${item.isFavorite ? "1" : "0"}"`);
    attrs.push(`SWUSH_PUBLIC="${item.isPublic ? "1" : "0"}"`);

    lines.push(
      `  <DT><A ${attrs.join(" ")}>${escapeHtml(item.title || item.url)}</A>`,
    );
    if (item.description) {
      lines.push(`  <DD>${escapeHtml(item.description)}`);
    }
  }

  lines.push("</DL><p>");
  return lines.join("\n");
}

function parseBookmarksFromJson(text: string) {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return parsed
      .map(normalizeForImport)
      .filter(Boolean) as NormalizedImportBookmark[];
  }
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const rows = Array.isArray(obj.bookmarks)
      ? obj.bookmarks
      : Array.isArray(obj.items)
        ? obj.items
        : [];
    return rows
      .map(normalizeForImport)
      .filter(Boolean) as NormalizedImportBookmark[];
  }
  return [];
}

function parseBookmarksFromHtml(text: string) {
  const dom = new JSDOM(text);
  try {
    const anchors = Array.from(
      dom.window.document.querySelectorAll("a[href]"),
    ) as HTMLAnchorElement[];
    const rows: NormalizedImportBookmark[] = [];

    for (const anchor of anchors) {
      const href = asString(anchor.getAttribute("href"));
      if (!href) continue;

      const dt = anchor.closest("dt");
      const nextElement = dt?.nextElementSibling;
      const description =
        nextElement && nextElement.tagName.toLowerCase() === "dd"
          ? toOptionalString(nextElement.textContent)
          : null;

      const tags = normalizeTags(anchor.getAttribute("tags") || "");
      const normalized = normalizeForImport({
        url: href,
        title: asString(anchor.textContent) || href,
        description,
        tags,
        isFavorite: anchor.getAttribute("swush_favorite"),
        isPublic: anchor.getAttribute("swush_public"),
      });
      if (!normalized) continue;
      rows.push(normalized);
    }

    return rows;
  } finally {
    dom.window.close();
  }
}

function detectImportFormat(
  text: string,
  fileName?: string | null,
): BookmarkExportFormat {
  const lowerName = (fileName || "").toLowerCase();
  if (lowerName.endsWith(".html") || lowerName.endsWith(".htm")) return "html";
  if (lowerName.endsWith(".json")) return "json";

  const sample = text.slice(0, 400).toLowerCase();
  if (
    sample.includes("<!doctype netscape-bookmark-file") ||
    sample.includes("<dl") ||
    sample.includes("<a ")
  ) {
    return "html";
  }

  return "json";
}

export async function buildBookmarksExport(
  userId: string,
  format: BookmarkExportFormat,
): Promise<{ fileName: string; contentType: string; body: string }> {
  const rows = await listBookmarksForExport(userId);
  const bookmarksForExport = rows.map(toExportBookmark);
  const datePart = new Date().toISOString().slice(0, 10);

  if (format === "html") {
    return {
      fileName: `swush-bookmarks-${datePart}.html`,
      contentType: "text/html; charset=utf-8",
      body: renderBookmarksHtml(bookmarksForExport),
    };
  }

  return {
    fileName: `swush-bookmarks-${datePart}.json`,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(
      {
        format: "swush-bookmarks/v1",
        exportedAt: new Date().toISOString(),
        total: bookmarksForExport.length,
        bookmarks: bookmarksForExport,
      },
      null,
      2,
    ),
  };
}

export async function importBookmarksFromText(args: {
  userId: string;
  username?: string;
  role?: string;
  text: string;
  fileName?: string | null;
}): Promise<BookmarkImportSummary> {
  const format = detectImportFormat(args.text, args.fileName);
  const parsedRows =
    format === "html"
      ? parseBookmarksFromHtml(args.text)
      : parseBookmarksFromJson(args.text);

  const dedupedRows: NormalizedImportBookmark[] = [];
  const seen = new Set<string>();
  for (const row of parsedRows) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    dedupedRows.push(row);
    if (dedupedRows.length >= MAX_IMPORT_ITEMS) break;
  }

  const existingRows = await db
    .select({ url: bookmarks.url })
    .from(bookmarks)
    .where(eq(bookmarks.userId, args.userId));
  const existingUrlSet = new Set(existingRows.map((row) => row.url));

  const summary: BookmarkImportSummary = {
    total: dedupedRows.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const row of dedupedRows) {
    if (existingUrlSet.has(row.url)) {
      summary.skipped += 1;
      continue;
    }

    const input: CreateBookmarkInput = {
      userId: args.userId,
      url: row.url,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      slug: row.slug,
      isFavorite: row.isFavorite,
      isPublic: row.isPublic,
      tags: row.tags,
      skipMetadataFetch: true,
    };

    try {
      await createBookmark(input, args.username, args.role);
      existingUrlSet.add(row.url);
      summary.imported += 1;
    } catch (error) {
      summary.failed += 1;
      if (summary.errors.length < 25) {
        summary.errors.push((error as Error).message || "Unknown import error");
      }
    }
  }

  return summary;
}
