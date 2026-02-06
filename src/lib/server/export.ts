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

import archiver from "archiver";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { files, shortLinks } from "@/db/schemas";
import { getDefaultStorageDriver, readFromStorage } from "@/lib/storage";

function toCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsv(value: string) {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    const cells = headers.map((h) => escapeCsv(toCell(row[h])));
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

export type ExportOptions = {
  includeFiles?: boolean;
  includeFileBinaries?: boolean;
  includeNotes?: boolean;
  includeBookmarks?: boolean;
  includeSnippets?: boolean;
  includeRecipes?: boolean;
  includeShortLinks?: boolean;
};

function normalizeOptions(options?: ExportOptions | null) {
  const normalized = options ?? {};
  return {
    includeFiles: normalized.includeFiles !== false,
    includeFileBinaries:
      normalized.includeFiles === false
        ? false
        : normalized.includeFileBinaries !== false,
    includeNotes: normalized.includeNotes !== false,
    includeBookmarks: normalized.includeBookmarks !== false,
    includeSnippets: normalized.includeSnippets !== false,
    includeRecipes: normalized.includeRecipes !== false,
    includeShortLinks: normalized.includeShortLinks !== false,
  };
}

function safeFileName(name: string) {
  const base = path.basename(name);
  return base.replace(/[\\/:*?"<>|]/g, "_");
}

export async function appendExportData(
  archive: archiver.Archiver,
  userId: string,
  options?: ExportOptions | null,
) {
  const opts = normalizeOptions(options);
  const [shortLinkRows, fileRows] = await Promise.all([
    opts.includeShortLinks
      ? db.select().from(shortLinks).where(eq(shortLinks.userId, userId))
      : [],
    opts.includeFiles || opts.includeFileBinaries
      ? db.select().from(files).where(eq(files.userId, userId))
      : [],
  ]);

  const now = new Date().toISOString();
  archive.append(
    JSON.stringify(
      {
        exportedAt: now,
        options: opts,
        counts: {
          shortLinks: shortLinkRows.length,
          files: fileRows.length,
        },
      },
      null,
      2,
    ),
    { name: "manifest.json" },
  );

  if (opts.includeShortLinks) {
    archive.append(
      toCsv(
        [
          "id",
          "originalUrl",
          "slug",
          "description",
          "isFavorite",
          "isPublic",
          "maxClicks",
          "clickCount",
          "maxViewsAction",
          "maxViewsTriggeredAt",
          "expiresAt",
          "createdAt",
        ],
        shortLinkRows,
      ),
      { name: "shortlinks.csv" },
    );
  }

  if (opts.includeFiles) {
    archive.append(
      toCsv(
        [
          "id",
          "slug",
          "originalName",
          "storedName",
          "mimeType",
          "size",
          "description",
          "isPublic",
          "isFavorite",
          "views",
          "maxViews",
          "maxViewsAction",
          "maxViewsTriggeredAt",
          "createdAt",
        ],
        fileRows,
      ),
      { name: "files.csv" },
    );
  }

  if (opts.includeFileBinaries) {
    for (const f of fileRows) {
      if (!f.storedName) continue;
      const read = await readFromStorage(
        { userId, storedName: f.storedName },
        {
          driver: (f.storageDriver || (await getDefaultStorageDriver())) as
            | "local"
            | "s3",
        },
      );
      if (!read) continue;
      const fileName = safeFileName(f.originalName || f.storedName);
      const entryName = `files/${f.slug || f.id}-${fileName}`;
      archive.append(read.stream, { name: entryName });
    }
  }

  return {
    exportedAt: now,
    options: opts,
    counts: {
      shortLinks: shortLinkRows.length,
      files: fileRows.length,
    },
  };
}
