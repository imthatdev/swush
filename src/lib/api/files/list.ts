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

import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import { files, filesToTags, folders, tags } from "@/db/schemas/core-schema";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  not,
  or,
  sql,
} from "drizzle-orm";
import { count } from "drizzle-orm/sql/functions";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { getCached, setCached } from "@/lib/server/ttl-cache";
import {
  enqueuePreviewJob,
  kickPreviewRunner,
} from "@/lib/server/preview-jobs";
import {
  enqueueAudioMetadataJob,
  kickAudioMetadataRunner,
} from "@/lib/server/audio-metadata-jobs";
import { isMedia } from "@/lib/mime-types";

export type FileListQuery = {
  q?: string;
  folder?: string | null;
  tags?: string[];
  favorites?: boolean;
  kind?: string;
  visibility?: "public" | "private" | null;
  page?: number;
  pageSize?: number;
  sort?: string;
  fields?: "full" | "summary";
  warm?: boolean;
};

export type FileListResult = {
  items: {
    id: string;
    userId: string;
    originalName: string;
    customName: string;
    description: string | null;
    mimeType: string;
    size: number;
    slug: string;
    isPublic: boolean;
    isFavorite: boolean;
    contentHash: string | null;
    maxViews: number | null;
    maxViewsAction: string | null;
    createdAt: Date;
    folder: { name: string; color: string | null } | null;
    tags: { name: string; color: string | null }[];
    hasPassword: boolean;
    audioMeta: {
      title?: string;
      artist?: string;
      album?: string;
      pictureDataUrl?: string;
      gradient?: string;
    } | null;
  }[];
  page: number;
  pageSize: number;
  total: number;
};

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 200;
const LIST_CACHE_TTL_MS = 8_000;
const WARM_LIMIT = 24;
const warmSeen = new Map<string, number>();

const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"];
const videoExts = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".mpeg", ".mpg"];
const audioExts = [".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus"];
const textExts = [
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".ts",
];

function clampPageSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function normalizeTags(input?: string[]) {
  return (input ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean);
}

function buildCacheKey(params: {
  userId: string;
  q?: string;
  folder?: string | null;
  tags?: string[];
  favorites?: boolean;
  kind?: string;
  visibility?: string | null;
  page: number;
  pageSize: number;
  sort?: string;
  fields: "full" | "summary";
}) {
  const tagKey = (params.tags ?? [])
    .map((t) => t.trim().toLowerCase())
    .sort()
    .join(",");
  return [
    "files:v1",
    params.userId,
    params.fields,
    params.q ?? "",
    params.folder ?? "",
    tagKey,
    params.favorites ? "1" : "0",
    params.kind ?? "",
    params.visibility ?? "",
    params.sort ?? "",
    String(params.page),
    String(params.pageSize),
  ].join("|");
}

function shouldWarmFile(fileId: string) {
  const now = Date.now();
  const prev = warmSeen.get(fileId);
  if (prev && now - prev < 60_000) return false;
  warmSeen.set(fileId, now);
  return true;
}

function scheduleWarmup(items: FileListResult["items"]) {
  const slice = items.slice(0, WARM_LIMIT);
  let previewQueued = false;
  let audioQueued = false;

  for (const item of slice) {
    if (!shouldWarmFile(item.id)) continue;
    if (
      item.mimeType?.startsWith("video/") ||
      (item.mimeType?.startsWith("image/") && item.mimeType !== "image/svg+xml")
    ) {
      void enqueuePreviewJob({ userId: item.userId, fileId: item.id });
      previewQueued = true;
    }
    if (isMedia("audio", item.mimeType, item.originalName)) {
      enqueueAudioMetadataJob({ userId: item.userId, fileId: item.id });
      audioQueued = true;
    }
  }

  if (previewQueued) {
    setImmediate(() => {
      void kickPreviewRunner({ limit: 6 }).catch(() => {});
    });
  }
  if (audioQueued) {
    setImmediate(() => {
      void kickAudioMetadataRunner(4).catch(() => {});
    });
  }
}

function buildKindCondition(kind?: string) {
  if (!kind || kind === "all") return null;

  const nameMatches = (exts: string[]) =>
    or(...exts.map((ext) => ilike(files.originalName, `%${ext}`)));

  const imageCond = or(
    ilike(files.mimeType, "image/%"),
    nameMatches(imageExts),
  );
  const videoCond = or(
    ilike(files.mimeType, "video/%"),
    nameMatches(videoExts),
  );
  const audioCond = or(
    ilike(files.mimeType, "audio/%"),
    nameMatches(audioExts),
  );
  const pdfCond = or(
    eq(files.mimeType, "application/pdf"),
    ilike(files.originalName, "%.pdf"),
  );
  const textCond = or(
    ilike(files.mimeType, "text/%"),
    eq(files.mimeType, "application/json"),
    eq(files.mimeType, "application/xml"),
    eq(files.mimeType, "application/javascript"),
    nameMatches(textExts),
  );

  switch (kind) {
    case "media":
      return or(imageCond, videoCond, audioCond);
    case "image":
      return imageCond;
    case "video":
      return videoCond;
    case "audio":
      return audioCond;
    case "pdf":
      return pdfCond;
    case "text":
      return textCond;
    case "other": {
      const conds = [imageCond, videoCond, audioCond, pdfCond, textCond]
        .filter(
          (cond): cond is Exclude<typeof cond, undefined> => cond !== undefined,
        )
        .map((cond) => not(cond));
      return conds.length ? and(...conds) : undefined;
    }
    default:
      return null;
  }
}

function parseListQuery(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim() || undefined;
  const folder = params.get("folder")?.trim() || undefined;
  const tagsParam =
    params
      .get("tags")
      ?.split(",")
      .map((t) => t.trim()) ?? [];
  const tagParams = params.getAll("tag");
  const tags = [...tagsParam, ...tagParams].filter(Boolean);
  const favorites = params.get("favorite") === "1";
  const kind = params.get("kind")?.trim() || undefined;
  const visibilityRaw = params.get("visibility")?.trim() || undefined;
  const visibility =
    visibilityRaw === "public" || visibilityRaw === "private"
      ? visibilityRaw
      : null;
  const page = Number(params.get("page") || "");
  const pageSize = Number(params.get("pageSize") || "");
  const sort = params.get("sort")?.trim() || undefined;
  const fieldsRaw = params.get("fields")?.trim() || undefined;
  const fields = fieldsRaw === "summary" ? "summary" : "full";
  const warm = params.get("warm") === "1";
  const paged =
    params.get("paged") === "1" || params.has("page") || params.has("pageSize");

  return {
    query: {
      q,
      folder: folder ?? null,
      tags,
      favorites,
      kind,
      visibility,
      page: Number.isFinite(page) ? page : undefined,
      pageSize: Number.isFinite(pageSize) ? pageSize : undefined,
      sort,
      fields,
      warm,
    } satisfies FileListQuery,
    paged,
  };
}

export async function listFilesForUser(
  userId: string,
  query: FileListQuery,
): Promise<FileListResult> {
  const fields = query.fields === "summary" ? "summary" : "full";
  const summary = fields === "summary";
  const conditions = [eq(files.userId, userId)];
  const q = query.q?.trim();
  const folderName = query.folder?.trim();
  const folderKey = folderName ? folderName.toLowerCase() : null;
  const tagNames = normalizeTags(query.tags);
  const pageSize = clampPageSize(query.pageSize ?? DEFAULT_PAGE_SIZE);
  const page = Math.max(1, Math.floor(query.page ?? 1));

  const cacheKey = buildCacheKey({
    userId,
    q,
    folder: folderKey,
    tags: tagNames,
    favorites: query.favorites,
    kind: query.kind,
    visibility: query.visibility,
    page,
    pageSize,
    sort: query.sort,
    fields,
  });
  const cached = getCached<FileListResult>(cacheKey);
  if (cached) {
    if (query.warm && page === 1) {
      setImmediate(() => scheduleWarmup(cached.items));
    }
    return cached;
  }

  if (q) {
    const searchConds = [
      ilike(files.originalName, `%${q}%`),
      ilike(files.slug, `%${q}%`),
      ilike(files.description, `%${q}%`),
    ].filter(
      (cond): cond is Exclude<typeof cond, undefined> => cond !== undefined,
    );

    if (searchConds.length > 0) {
      const orCond = or(...searchConds);
      if (orCond) {
        conditions.push(orCond);
      }
    }
  }

  if (query.favorites) {
    conditions.push(eq(files.isFavorite, true));
  }

  if (query.visibility === "public") {
    conditions.push(eq(files.isPublic, true));
  } else if (query.visibility === "private") {
    conditions.push(eq(files.isPublic, false));
  }

  const kindCondition = buildKindCondition(query.kind);
  if (kindCondition) conditions.push(kindCondition);

  if (folderName) {
    if (folderKey === "unfiled") {
      conditions.push(isNull(files.folderId));
    } else {
      const folderRows = await db
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.userId, userId),
            sql`lower(${folders.name}) = ${folderKey}`,
          ),
        )
        .limit(1);
      if (folderRows.length === 0) {
        const empty = { items: [], page: 1, pageSize, total: 0 };
        setCached(cacheKey, empty, LIST_CACHE_TTL_MS);
        return empty;
      }
      conditions.push(eq(files.folderId, folderRows[0].id));
    }
  }

  if (tagNames.length) {
    const tagNameConditions = tagNames.map(
      (name) => sql`lower(${tags.name}) = ${name}`,
    );
    const tagSubquery = db
      .select({ fileId: filesToTags.fileId })
      .from(filesToTags)
      .innerJoin(tags, eq(filesToTags.tagId, tags.id))
      .where(and(eq(tags.userId, userId), or(...tagNameConditions)));
    conditions.push(inArray(files.id, tagSubquery));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0]!;

  const offset = (page - 1) * pageSize;

  const [countRow] = await db
    .select({ count: count(files.id).mapWith(Number) })
    .from(files)
    .where(where);
  const total = countRow?.count ?? 0;

  const orderBy = (
    f: typeof files,
    helpers: { desc: typeof desc; asc: typeof asc },
  ) => {
    switch (query.sort) {
      case "oldest":
        return [helpers.asc(f.createdAt)];
      case "name-asc":
        return [helpers.asc(f.originalName)];
      case "name-desc":
        return [helpers.desc(f.originalName)];
      case "size-asc":
        return [helpers.asc(f.size)];
      case "size-desc":
        return [helpers.desc(f.size)];
      default:
        return [helpers.desc(f.createdAt)];
    }
  };

  const baseWith = {
    folder: true,
    tags: { with: { tag: true } },
  } as const;

  const mapped = summary
    ? (
        await db.query.files.findMany({
          where,
          orderBy: orderBy(files, { desc, asc }),
          limit: pageSize,
          offset,
          columns: {
            id: true,
            userId: true,
            originalName: true,
            description: true,
            mimeType: true,
            size: true,
            slug: true,
            isPublic: true,
            isFavorite: true,
            createdAt: true,
            password: true,
          },
          with: baseWith,
        })
      ).map((f) => ({
        id: f.id,
        userId: f.userId,
        originalName: f.originalName,
        customName: f.originalName,
        description: f.description ?? null,
        mimeType: f.mimeType,
        size: f.size,
        slug: f.slug,
        isPublic: Boolean(f.isPublic),
        isFavorite: Boolean(f.isFavorite),
        contentHash: null,
        maxViews: null,
        maxViewsAction: null,
        createdAt: f.createdAt ?? new Date(0),
        folder: f.folder
          ? { name: f.folder.name, color: f.folder.color ?? null }
          : null,
        tags: (f.tags ?? [])
          .map((ft) =>
            ft.tag?.name
              ? { name: ft.tag.name, color: ft.tag.color ?? null }
              : null,
          )
          .filter(
            (tag): tag is { name: string; color: string | null } => !!tag,
          ),
        hasPassword: Boolean(f.password),
        audioMeta: null,
      }))
    : (
        await db.query.files.findMany({
          where,
          orderBy: orderBy(files, { desc, asc }),
          limit: pageSize,
          offset,
          with: { ...baseWith, audioMeta: true },
        })
      ).map((f) => ({
        id: f.id,
        userId: f.userId,
        originalName: f.originalName,
        customName: f.originalName,
        description: f.description ?? null,
        mimeType: f.mimeType,
        size: f.size,
        slug: f.slug,
        isPublic: Boolean(f.isPublic),
        isFavorite: Boolean(f.isFavorite),
        contentHash: f.contentHash ?? null,
        maxViews: f.maxViews ?? null,
        maxViewsAction: f.maxViewsAction ?? null,
        createdAt: f.createdAt ?? new Date(0),
        folder: f.folder
          ? { name: f.folder.name, color: f.folder.color ?? null }
          : null,
        tags: (f.tags ?? [])
          .map((ft) =>
            ft.tag?.name
              ? { name: ft.tag.name, color: ft.tag.color ?? null }
              : null,
          )
          .filter(
            (tag): tag is { name: string; color: string | null } => !!tag,
          ),
        hasPassword: Boolean(f.password),
        audioMeta: f.audioMeta
          ? {
              title: f.audioMeta.title ?? undefined,
              artist: f.audioMeta.artist ?? undefined,
              album: f.audioMeta.album ?? undefined,
              pictureDataUrl: f.audioMeta.pictureDataUrl ?? undefined,
              gradient: f.audioMeta.gradient ?? undefined,
            }
          : null,
      }));

  const result = { items: mapped, page, pageSize, total };
  setCached(cacheKey, result, LIST_CACHE_TTL_MS);
  if (query.warm && page === 1) {
    setImmediate(() => scheduleWarmup(mapped));
  }
  return result;
}

export async function listFiles(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  try {
    const { query, paged } = parseListQuery(req);
    const result = await listFilesForUser(user.id, query);
    return {
      status: 200 as const,
      body: paged ? result : result.items,
    };
  } catch {
    return { status: 500 as const, body: { message: "Failed to list files" } };
  }
}
