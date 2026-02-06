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
  inArray,
  sql,
} from "drizzle-orm";
import { shortLinks, shortLinkTags } from "@/db/schemas/core-schema";
import { user, userInfo } from "@/db/schemas";
import { hashPassword } from "./password";
import { resolveVanitySlug } from "./slug";
import type { DBShortLink, NewDBShortLink } from "@/types/schema";
import { normalizeTagName } from "@/lib/tag-names";
import { normalizeMaxViewsAction } from "@/lib/server/max-views";

async function resolveExistingShortlinkTags(userId: string, tags: string[]) {
  const unique = Array.from(
    new Set(tags.map((tag) => normalizeTagName(tag)).filter(Boolean)),
  );
  if (!unique.length) return [];
  const rows = await db
    .select({ name: shortLinkTags.name })
    .from(shortLinkTags)
    .where(
      and(
        eq(shortLinkTags.userId, userId),
        inArray(shortLinkTags.name, unique),
      ),
    );
  return rows.map((row) => row.name);
}

export type CreateShortLinkInput = {
  userId: string;
  originalUrl: string;
  slug?: string | null;
  isPublic?: boolean;
  isFavorite?: boolean;
  description?: string | null;
  password?: string | null;
  maxClicks?: number | null;
  maxViewsAction?: string | null;
  expiresAt?: Date | null;
  clickCount?: number | null;
  tags?: string[] | null;
};

export async function createShortLink(
  input: CreateShortLinkInput,
  username?: string,
  role?: string,
): Promise<DBShortLink> {
  if (Array.isArray(input.tags)) {
    input.tags = Array.from(
      new Set(input.tags.map((tag) => normalizeTagName(tag)).filter(Boolean)),
    );
    input.tags = await resolveExistingShortlinkTags(input.userId, input.tags);
  }
  const slug = await resolveVanitySlug({
    desired: input.slug,
    username,
    role,
    kind: "shortLinks",
  });

  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;
  const maxViewsAction =
    typeof input.maxClicks === "number" && input.maxClicks > 0
      ? normalizeMaxViewsAction(input.maxViewsAction)
      : null;
  const value: NewDBShortLink = {
    userId: input.userId,
    description: input.description ?? null,
    originalUrl: input.originalUrl,
    isFavorite: input.isFavorite ?? false,
    isPublic: input.isPublic ?? false,
    maxClicks: input.maxClicks ?? null,
    expiresAt: input.expiresAt ?? null,
    clickCount: input.clickCount ?? null,
    tags: input.tags ?? null,
    slug,
    password: passwordHash,
    maxViewsAction,
    maxViewsTriggeredAt: null,
  };
  const [row] = await db.insert(shortLinks).values(value).returning();
  return row as DBShortLink;
}

export type UpdateShortLinkInput = Partial<
  Pick<
    NewDBShortLink,
    | "originalUrl"
    | "description"
    | "isPublic"
    | "isFavorite"
    | "anonymousShareEnabled"
    | "maxClicks"
    | "expiresAt"
    | "slug"
    | "clickCount"
    | "tags"
    | "maxViewsAction"
  >
> & { password?: string | null };

export async function updateShortLink(
  userId: string,
  id: string,
  patch: UpdateShortLinkInput,
  username?: string,
  role?: string,
) {
  const existing = await db.query.shortLinks.findFirst({
    where: and(eq(shortLinks.id, id), eq(shortLinks.userId, userId)),
  });
  if (!existing) throw new Error("Not found or not yours");

  let passwordHash = existing.password;
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
        kind: "shortLinks",
      });
    } else {
      patch.slug = await resolveVanitySlug({
        desired,
        username,
        role,
        existingSlug: existing.slug,
        kind: "shortLinks",
      });
    }
  }

  if (Array.isArray(patch.tags)) {
    patch.tags = Array.from(
      new Set(patch.tags.map((tag) => normalizeTagName(tag)).filter(Boolean)),
    );
    patch.tags = await resolveExistingShortlinkTags(userId, patch.tags);
  }

  const resolvedMaxClicks =
    patch.maxClicks !== undefined ? patch.maxClicks : existing.maxClicks;
  const resolvedMaxViewsAction =
    patch.maxViewsAction !== undefined
      ? normalizeMaxViewsAction(patch.maxViewsAction)
      : (existing.maxViewsAction as string | null);
  const nextMaxViewsAction =
    typeof resolvedMaxClicks === "number" && resolvedMaxClicks > 0
      ? resolvedMaxViewsAction
      : null;
  const resetMaxViewsTrigger =
    patch.maxClicks !== undefined || patch.maxViewsAction !== undefined;

  const next = {
    originalUrl: patch.originalUrl ?? existing.originalUrl,
    description: patch.description ?? existing.description,
    slug:
      patch.slug !== undefined
        ? patch.slug?.trim() || existing.slug
        : existing.slug,
    isFavorite: patch.isFavorite ?? existing.isFavorite,
    isPublic: patch.isPublic ?? existing.isPublic,
    anonymousShareEnabled:
      patch.anonymousShareEnabled ?? existing.anonymousShareEnabled,
    maxClicks: resolvedMaxClicks,
    expiresAt:
      patch.expiresAt !== undefined ? patch.expiresAt : existing.expiresAt,
    clickCount:
      patch.clickCount !== undefined ? patch.clickCount : existing.clickCount,
    tags: patch.tags ?? existing.tags,
    password: passwordHash,
    maxViewsAction: nextMaxViewsAction,
    maxViewsTriggeredAt: resetMaxViewsTrigger
      ? null
      : existing.maxViewsTriggeredAt,
  } as Partial<typeof shortLinks.$inferInsert>;

  const [row] = await db
    .update(shortLinks)
    .set(next)
    .where(and(eq(shortLinks.id, id), eq(shortLinks.userId, userId)))
    .returning();
  return row as DBShortLink;
}

export async function deleteShortLink(userId: string, id: string) {
  await db
    .delete(shortLinks)
    .where(and(eq(shortLinks.id, id), eq(shortLinks.userId, userId)));
}

export async function getShortLinkById(userId: string, id: string) {
  return db.query.shortLinks.findFirst({
    where: and(eq(shortLinks.id, id), eq(shortLinks.userId, userId)),
  });
}

export async function listShortLinks(params: {
  userId: string;
  q?: string;
  tagFilter?: string[] | null;
  favoriteOnly?: boolean;
  publicOnly?: boolean;
  limit?: number;
  offset?: number;
}) {
  const whereParts: (SQL<unknown> | undefined)[] = [
    eq(shortLinks.userId, params.userId),
  ];

  if (params.favoriteOnly) {
    whereParts.push(eq(shortLinks.isFavorite, true));
  }
  if (params.publicOnly) {
    whereParts.push(eq(shortLinks.isPublic, true));
  }

  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    whereParts.push(
      or(
        ilike(shortLinks.description, pattern),
        ilike(shortLinks.originalUrl, pattern),
      ),
    );
  }
  if (params.tagFilter && params.tagFilter.length > 0) {
    const normalizedTags = params.tagFilter
      .map((tag) => normalizeTagName(tag))
      .filter(Boolean);
    if (normalizedTags.length > 0) {
      whereParts.push(
        sql`ARRAY[${sql.join(normalizedTags)}] && ${shortLinks.tags}`,
      );
    }
  }

  const whereClause = and(...whereParts);
  const baseWhere = and(eq(shortLinks.userId, params.userId));

  const [totalRow] = await db
    .select({ total: count() })
    .from(shortLinks)
    .where(whereClause);

  const limit = Math.min(Math.max(params.limit ?? 0, 0), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const query = db
    .select()
    .from(shortLinks)
    .where(whereClause)
    .orderBy(desc(shortLinks.createdAt));

  const items =
    limit > 0
      ? await query.limit(limit).offset(offset)
      : await query.offset(offset);

  const normalizedItems = items.map((row) => ({
    ...row,
    tags: Array.isArray(row.tags)
      ? Array.from(
          new Set(row.tags.map((t) => normalizeTagName(t)).filter(Boolean)),
        )
      : row.tags,
  })) as DBShortLink[];

  const tagRows = await db
    .select({ tags: shortLinks.tags })
    .from(shortLinks)
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
          .select({ name: shortLinkTags.name, color: shortLinkTags.color })
          .from(shortLinkTags)
          .where(
            and(
              eq(shortLinkTags.userId, params.userId),
              inArray(shortLinkTags.name, tagList),
            ),
          )
      : [];
  const tagColors: Record<string, string | null> = {};
  for (const row of tagColorsRows) tagColors[row.name] = row.color ?? null;

  return {
    items: normalizedItems,
    total: totalRow?.total ?? normalizedItems.length,
    tags: tagList.sort((a, b) => a.localeCompare(b)),
    tagColors,
  };
}

export async function getPublicShortLinkBySlug(slug: string) {
  return db.query.shortLinks.findFirst({
    where: and(eq(shortLinks.slug, slug), eq(shortLinks.isPublic, true)),
  });
}

export async function getPublicShortLinksByTag(
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
  items: DBShortLink[];
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
    eq(shortLinks.userId, owner.id),
    eq(shortLinks.isPublic, true),
    sql`${shortLinks.tags} @> ${sql`ARRAY[${normalizedTag}]`}`,
  ];
  if (params.q && params.q.trim()) {
    const pattern = `%${params.q.trim()}%`;
    whereParts.push(
      or(
        ilike(shortLinks.description, pattern),
        ilike(shortLinks.originalUrl, pattern),
        ilike(shortLinks.slug, pattern),
      ),
    );
  }
  const whereClause = and(...whereParts);

  const [totalRow] = await db
    .select({ total: count() })
    .from(shortLinks)
    .where(whereClause);

  const limit = Math.min(Math.max(params.limit ?? 12, 0), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  const query = db
    .select()
    .from(shortLinks)
    .where(whereClause)
    .orderBy(desc(shortLinks.createdAt));

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
          .select({ name: shortLinkTags.name, color: shortLinkTags.color })
          .from(shortLinkTags)
          .where(
            and(
              eq(shortLinkTags.userId, owner.id),
              inArray(shortLinkTags.name, tagList),
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
  })) as DBShortLink[];

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
