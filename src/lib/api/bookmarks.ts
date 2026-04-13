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

import "server-only";
import { db } from "@/db/client";
import {
  and,
  desc,
  ilike,
  eq,
  SQL,
  or,
  count,
  sql,
  inArray,
} from "drizzle-orm";
import { bookmarks, bookmarkTags } from "@/db/schemas/core-schema";
import { user, userInfo } from "@/db/schemas";
import { fetchPageMeta } from "./helpers";
import { hashPassword } from "./password";
import { resolveVanitySlug } from "./slug";
import type { DBBookmark, NewDBBookmark } from "@/types/schema";
import { normalizeTagName } from "@/lib/tag-names";
import {
  handleBookmarkMaxViews,
  MaxViewsAction,
  normalizeMaxViews,
  normalizeMaxViewsAction,
} from "@/lib/server/max-views";

async function resolveExistingBookmarkTags(userId: string, tags: string[]) {
  const unique = Array.from(
    new Set(tags.map((tag) => normalizeTagName(tag)).filter(Boolean)),
  );
  if (!unique.length) return [];
  const rows = await db
    .select({ name: bookmarkTags.name })
    .from(bookmarkTags)
    .where(
      and(eq(bookmarkTags.userId, userId), inArray(bookmarkTags.name, unique)),
    );
  return rows.map((row) => row.name);
}

export type CreateBookmarkInput = {
  userId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  slug?: string | null;
  url: string;
  isFavorite?: boolean;
  isPublic?: boolean;
  password?: string | null;
  tags?: string[];
  maxViews?: number | null;
  maxViewsAction?: string | null;
  skipMetadataFetch?: boolean;
};

export async function createBookmark(
  input: CreateBookmarkInput,
  username?: string,
  role?: string,
): Promise<DBBookmark> {
  const slug = await resolveVanitySlug({
    desired: input.slug,
    username,
    role,
    kind: "bookmarks",
  });

  if (
    !input.skipMetadataFetch &&
    (!input.title || !input.imageUrl || !input.description)
  ) {
    const meta = await fetchPageMeta(input.url);
    if (meta) {
      input.title = meta.title ?? "";
      input.description = meta.description ?? null;
      input.imageUrl = meta.imageUrl ?? null;
    }
  }

  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;
  const maxViews = normalizeMaxViews(input.maxViews);
  const maxViewsAction = maxViews
    ? normalizeMaxViewsAction(input.maxViewsAction)
    : null;
  if (Array.isArray(input.tags) && input.tags.length > 0) {
    input.tags = Array.from(
      new Set(input.tags.map((tag) => normalizeTagName(tag)).filter(Boolean)),
    );
    input.tags = await resolveExistingBookmarkTags(input.userId, input.tags);
  }
  const value: NewDBBookmark = {
    userId: input.userId,
    title: input.title,
    description: input.description ?? null,
    imageUrl: input.imageUrl ?? null,
    url: input.url,
    slug,
    isFavorite: input.isFavorite ?? false,
    isPublic: input.isPublic ?? false,
    passwordHash,
    tags: input.tags && input.tags.length ? input.tags : null,
    maxViews,
    maxViewsAction,
    maxViewsTriggeredAt: null,
  };
  const [row] = await db.insert(bookmarks).values(value).returning();
  return row as DBBookmark;
}

export type UpdateBookmarkInput = Partial<
  Pick<
    NewDBBookmark,
    | "title"
    | "description"
    | "imageUrl"
    | "slug"
    | "url"
    | "isFavorite"
    | "isPublic"
    | "anonymousShareEnabled"
    | "tags"
    | "maxViews"
    | "maxViewsAction"
  >
> & { password?: string | null };

export async function updateBookmark(
  userId: string,
  id: string,
  patch: UpdateBookmarkInput,
  username?: string,
  role?: string,
) {
  const existing = await db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)),
  });
  if (!existing) throw new Error("Not found or not yours");

  let passwordHash = existing.passwordHash;
  if (patch.password !== undefined)
    passwordHash = patch.password ? await hashPassword(patch.password) : null;

  if (patch.slug !== undefined) {
    const desired = typeof patch.slug === "string" ? patch.slug.trim() : "";
    if (!desired) {
      patch.slug = await resolveVanitySlug({
        desired: null,
        username,
        role,
        existingSlug: existing.slug,
        kind: "bookmarks",
      });
    } else {
      patch.slug = await resolveVanitySlug({
        desired,
        username,
        role,
        existingSlug: existing.slug,
        kind: "bookmarks",
      });
    }
  }
  if (Array.isArray(patch.tags)) {
    patch.tags = Array.from(
      new Set(patch.tags.map((tag) => normalizeTagName(tag)).filter(Boolean)),
    );
    patch.tags = await resolveExistingBookmarkTags(userId, patch.tags);
  }

  const resolvedMaxViews =
    patch.maxViews !== undefined
      ? normalizeMaxViews(patch.maxViews)
      : (existing.maxViews ?? null);
  const resolvedMaxViewsAction =
    patch.maxViewsAction !== undefined
      ? normalizeMaxViewsAction(patch.maxViewsAction)
      : (existing.maxViewsAction as string | null);
  const nextMaxViewsAction = resolvedMaxViews ? resolvedMaxViewsAction : null;
  const resetMaxViewsTrigger =
    patch.maxViews !== undefined || patch.maxViewsAction !== undefined;

  const next = {
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    imageUrl: patch.imageUrl ?? existing.imageUrl,
    slug:
      patch.slug !== undefined
        ? patch.slug?.trim() || existing.slug
        : existing.slug,
    isFavorite: patch.isFavorite ?? existing.isFavorite,
    isPublic: patch.isPublic ?? existing.isPublic,
    anonymousShareEnabled:
      patch.anonymousShareEnabled ?? existing.anonymousShareEnabled,
    passwordHash,
    tags: patch.tags ?? existing.tags,
    views: existing.views ?? 0,
    maxViews: resolvedMaxViews,
    maxViewsAction: nextMaxViewsAction as MaxViewsAction,
    maxViewsTriggeredAt: resetMaxViewsTrigger
      ? null
      : existing.maxViewsTriggeredAt,
  };
  const [row] = await db
    .update(bookmarks)
    .set(next)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning();
  return row as DBBookmark;
}

export async function deleteBookmark(userId: string, id: string) {
  await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
}

export async function getBookmarkById(userId: string, id: string) {
  return db.query.bookmarks.findFirst({
    where: and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)),
  });
}

export async function listBookmarksForExport(userId: string) {
  const rows = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));

  return rows as DBBookmark[];
}

export async function listBookmarks(params: {
  userId: string;
  q?: string;
  favoriteOnly?: boolean;
  publicOnly?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
}) {
  const whereParts: (SQL<unknown> | undefined)[] = [
    eq(bookmarks.userId, params.userId),
  ];

  if (params.favoriteOnly) {
    whereParts.push(eq(bookmarks.isFavorite, true));
  }
  if (params.publicOnly) {
    whereParts.push(eq(bookmarks.isPublic, true));
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    whereParts.push(
      or(
        ilike(bookmarks.title, pattern),
        ilike(bookmarks.description, pattern),
        ilike(bookmarks.url, pattern),
        sql`array_to_string(${bookmarks.tags}, ',') ILIKE ${pattern}`,
      ),
    );
  }

  const baseWhere = and(...whereParts);

  if (params.tags && params.tags.length > 0) {
    const normalizedTags = params.tags
      .map((tag) => normalizeTagName(tag))
      .filter(Boolean);
    if (normalizedTags.length) {
      whereParts.push(
        sql`${bookmarks.tags} @> ${sql`ARRAY[${sql.join(normalizedTags)}]`}`,
      );
    }
  }

  const whereClause = and(...whereParts);

  const [totalRow] = await db
    .select({ total: count() })
    .from(bookmarks)
    .where(whereClause);

  const limit = Math.min(Math.max(params.limit ?? 0, 0), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const query = db
    .select()
    .from(bookmarks)
    .where(whereClause)
    .orderBy(desc(bookmarks.createdAt));

  const rows =
    limit > 0
      ? await query.limit(limit).offset(offset)
      : await query.offset(offset);
  const items = rows.map((row) => ({
    ...row,
    tags: Array.isArray(row.tags)
      ? Array.from(
          new Set(row.tags.map((t) => normalizeTagName(t)).filter(Boolean)),
        )
      : row.tags,
  })) as DBBookmark[];

  const tagRows = await db
    .select({ tags: bookmarks.tags })
    .from(bookmarks)
    .where(baseWhere);

  const tagSet = new Set<string>();
  for (const row of tagRows) {
    for (const t of row.tags ?? []) {
      const normalized = normalizeTagName(t);
      if (normalized) tagSet.add(normalized);
    }
  }
  const tagList = Array.from(tagSet);
  const tagColorsRows =
    tagList.length > 0
      ? await db
          .select({ name: bookmarkTags.name, color: bookmarkTags.color })
          .from(bookmarkTags)
          .where(
            and(
              eq(bookmarkTags.userId, params.userId),
              inArray(bookmarkTags.name, tagList),
            ),
          )
      : [];
  const tagColors: Record<string, string | null> = {};
  for (const row of tagColorsRows) tagColors[row.name] = row.color ?? null;

  return {
    items,
    total: totalRow?.total ?? items.length,
    tags: tagList.sort((a, b) => a.localeCompare(b)),
    tagColors,
  };
}

export async function getPublicBookmarkBySlug(slug: string) {
  const [row] = await db
    .select({
      bookmark: bookmarks,
      ownerUsername: user.username,
      ownerDisplayName: user.displayUsername,
      ownerName: user.name,
      ownerImage: user.image,
      ownerBio: userInfo.bio,
      ownerVerified: userInfo.verified,
    })
    .from(bookmarks)
    .leftJoin(user, eq(bookmarks.userId, user.id))
    .leftJoin(userInfo, eq(userInfo.userId, user.id))
    .where(and(eq(bookmarks.slug, slug), eq(bookmarks.isPublic, true)))
    .limit(1);
  if (!row) return null;
  const tagNames = (row.bookmark.tags ?? [])
    .map((tag) => normalizeTagName(tag))
    .filter(Boolean);
  const tagColorsRows =
    tagNames.length > 0
      ? await db
          .select({ name: bookmarkTags.name, color: bookmarkTags.color })
          .from(bookmarkTags)
          .where(
            and(
              eq(bookmarkTags.userId, row.bookmark.userId),
              inArray(bookmarkTags.name, tagNames),
            ),
          )
      : [];
  const tagColors: Record<string, string | null> = {};
  for (const tagRow of tagColorsRows)
    tagColors[tagRow.name] = tagRow.color ?? null;

  return {
    ...row.bookmark,
    tags: Array.isArray(row.bookmark.tags)
      ? Array.from(
          new Set(
            row.bookmark.tags.map((t) => normalizeTagName(t)).filter(Boolean),
          ),
        )
      : row.bookmark.tags,
    ownerUsername: row.ownerUsername,
    ownerDisplayName: row.ownerName || row.ownerDisplayName,
    ownerImage: row.ownerImage,
    ownerBio: row.ownerBio,
    ownerVerified: row.ownerVerified,
    tagColors,
  };
}

export async function getPublicBookmarksByTag(
  username: string,
  tag: string,
  params: { q?: string; limit?: number; offset?: number } = {},
): Promise<{
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    image?: string | null;
    bio?: string | null;
    verified?: boolean | null;
  };
  items: DBBookmark[];
  tagColors: Record<string, string | null>;
  total: number;
} | null> {
  const [owner] = await db
    .select({
      id: user.id,
      username: user.username,
      displayName: user.displayUsername,
      image: user.image,
      bio: userInfo.bio,
      verified: userInfo.verified,
    })
    .from(user)
    .leftJoin(userInfo, eq(userInfo.userId, user.id))
    .where(eq(user.username, username))
    .limit(1);
  if (!owner || !owner.username) return null;

  const normalizedTag = normalizeTagName(tag);
  if (!normalizedTag) return null;

  const whereParts: (SQL<unknown> | undefined)[] = [
    eq(bookmarks.userId, owner.id),
    eq(bookmarks.isPublic, true),
    sql`${bookmarks.tags} @> ${sql`ARRAY[${normalizedTag}]`}`,
  ];
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    whereParts.push(
      or(
        ilike(bookmarks.title, pattern),
        ilike(bookmarks.description, pattern),
        ilike(bookmarks.url, pattern),
      ),
    );
  }
  const whereClause = and(...whereParts);

  const [totalRow] = await db
    .select({ total: count() })
    .from(bookmarks)
    .where(whereClause);

  const limit = Math.min(Math.max(params.limit ?? 12, 0), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const query = db
    .select()
    .from(bookmarks)
    .where(whereClause)
    .orderBy(desc(bookmarks.createdAt));

  const rows =
    limit > 0 ? await query.limit(limit).offset(offset) : await query;

  const tagSet = new Set<string>();
  for (const row of rows) {
    for (const t of row.tags ?? []) {
      const normalized = normalizeTagName(t);
      if (normalized) tagSet.add(normalized);
    }
  }
  const tagList = Array.from(tagSet);
  const tagColorsRows =
    tagList.length > 0
      ? await db
          .select({ name: bookmarkTags.name, color: bookmarkTags.color })
          .from(bookmarkTags)
          .where(
            and(
              eq(bookmarkTags.userId, owner.id),
              inArray(bookmarkTags.name, tagList),
            ),
          )
      : [];
  const tagColors: Record<string, string | null> = {};
  for (const row of tagColorsRows) tagColors[row.name] = row.color ?? null;

  const normalizedItems = rows.map((row) => ({
    ...row,
    tags: Array.isArray(row.tags)
      ? Array.from(
          new Set(row.tags.map((t) => normalizeTagName(t)).filter(Boolean)),
        )
      : row.tags,
  })) as DBBookmark[];

  return {
    user: {
      id: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      image: owner.image,
      bio: owner.bio,
    },
    items: normalizedItems,
    tagColors,
    total: totalRow?.total ?? normalizedItems.length,
  };
}

export async function incrementBookmarkViews(id: string) {
  const [row] = await db
    .update(bookmarks)
    .set({ views: sql`${bookmarks.views} + 1` })
    .where(eq(bookmarks.id, id))
    .returning();

  if (row) {
    await handleBookmarkMaxViews(row);
  }
}
