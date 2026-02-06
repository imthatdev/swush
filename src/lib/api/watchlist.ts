/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   You may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { db } from "@/db/client";
import { watchlistItems, watchProgress } from "@/db/schemas/core-schema";
import { and, desc, eq, ilike, count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/client/user";
import { user, userInfo } from "@/db/schemas";
import { tmdbGetTitle } from "@/lib/providers/tmdb";

async function requireUser() {
  const user = await getCurrentUser();
  return user ?? null;
}

export async function listMyWatchlist(params?: {
  limit?: number;
  offset?: number;
  mediaType?: "movie" | "tv" | "anime" | "all";
  q?: string;
}) {
  const user = await requireUser();
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  const limit = Math.min(Math.max(params?.limit ?? 0, 0), 100);
  const offset = Math.max(params?.offset ?? 0, 0);
  const mediaType =
    params?.mediaType && params.mediaType !== "all" ? params.mediaType : null;
  const q = params?.q?.trim();

  const conditions = [eq(watchlistItems.userId, user.id)];
  if (mediaType) {
    conditions.push(eq(watchlistItems.mediaType, mediaType));
  }
  if (q) {
    conditions.push(ilike(watchlistItems.title, `%${q}%`));
  }
  const whereClause = and(...conditions);

  const [totalRow] = await db
    .select({ total: count() })
    .from(watchlistItems)
    .where(whereClause);

  const query = db
    .select()
    .from(watchlistItems)
    .where(whereClause)
    .orderBy(desc(watchlistItems.updatedAt));

  const items =
    limit > 0
      ? await query.limit(limit).offset(offset)
      : await query.offset(offset);

  const progressAll: Record<string, { season: number; episode: number }[]> = {};
  for (const item of items) {
    const rows = await db
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.itemId, item.id));
    progressAll[item.id] = rows.map((r) => ({
      season: r.season,
      episode: r.episode,
    }));
  }

  return {
    status: 200 as const,
    body: {
      items,
      progress: progressAll,
      total: totalRow?.total ?? items.length,
    },
  };
}

export async function addToWatchlist(input: {
  provider?: string;
  mediaType: "movie" | "tv" | "anime";
  providerId: string;
  title: string;
  rating?: number;
  genreIds?: number[];
  posterPath?: string | null;
  overview?: string | null;
  year?: number | null;
  notes?: string | null;
}) {
  const user = await requireUser();
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  const provider = (input.provider || "tmdb").toLowerCase();
  try {
    const existing = await db
      .select({ id: watchlistItems.id })
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, user.id),
          eq(watchlistItems.provider, provider),
          eq(watchlistItems.providerId, input.providerId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return {
        status: 409 as const,
        body: { message: "Already in watchlist" },
      };
    }

    let mediaType: "movie" | "tv" | "anime" = input.mediaType;
    let genreIds = input.genreIds;

    let meta: Awaited<ReturnType<typeof tmdbGetTitle>> | null = null;
    const needsGenre =
      input.mediaType === "tv" &&
      (!genreIds || genreIds.length === 0) &&
      provider === "tmdb";
    const needsRating =
      provider === "tmdb" &&
      (input.rating === undefined || input.rating === null);

    if (needsGenre || needsRating) {
      const lookupType = input.mediaType === "movie" ? "movie" : "tv";
      try {
        meta = await tmdbGetTitle(lookupType, input.providerId);
      } catch {
        meta = null;
      }
    }

    if (needsGenre && meta) {
      genreIds = (meta.genreIds as number[] | undefined) ?? genreIds;
    }

    const hasAnimationGenre = Array.isArray(genreIds) && genreIds.includes(16);
    if (input.mediaType === "tv" && hasAnimationGenre) {
      mediaType = "anime";
    }

    let ratingValue: number | null = null;
    if (input.rating !== undefined && input.rating !== null) {
      ratingValue = Math.round(Number(input.rating));
    } else if (meta && typeof meta.rating === "number") {
      ratingValue = Math.round(meta.rating);
    }

    const cleanNotes =
      typeof input.notes === "string"
        ? input.notes.trim().slice(0, 4000)
        : null;

    const [row] = await db
      .insert(watchlistItems)
      .values({
        userId: user.id,
        provider,
        mediaType,
        providerId: input.providerId,
        title: input.title,
        rating: ratingValue,
        posterPath: input.posterPath || null,
        overview: input.overview || null,
        year: input.year ?? null,
        notes: cleanNotes,
      })
      .returning();

    return {
      status: 200 as const,
      body: row,
    };
  } catch (e) {
    return {
      status: 400 as const,
      body: { message: (e as Error).message || "Failed to add" },
    };
  }
}

export async function updateWatchlistItem(
  id: string,
  patch: Partial<{
    status: string;
    rating: number | null;
    notes: string | null;
    isPublic: boolean;
  }>,
) {
  const user = await requireUser();
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  const [existing] = await db
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.id, id));
  if (!existing || existing.userId !== user.id)
    return { status: 404 as const, body: { message: "Not found" } };

  const [row] = await db
    .update(watchlistItems)
    .set({
      status: patch.status ?? existing.status,
      rating: patch.rating === undefined ? existing.rating : patch.rating,
      notes: patch.notes === undefined ? existing.notes : patch.notes,
      isPublic:
        patch.isPublic === undefined ? existing.isPublic : patch.isPublic,
      updatedAt: new Date(),
    })
    .where(eq(watchlistItems.id, id))
    .returning();

  return { status: 200 as const, body: row };
}

export async function removeWatchlistItem(id: string) {
  const user = await requireUser();
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  const [existing] = await db
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.id, id));
  if (!existing || existing.userId !== user.id)
    return { status: 404 as const, body: { message: "Not found" } };

  await db.delete(watchProgress).where(eq(watchProgress.itemId, id));
  await db.delete(watchlistItems).where(eq(watchlistItems.id, id));
  return { status: 200 as const, body: { message: "Removed" } };
}

export async function setEpisodeProgress(
  itemId: string,
  season: number,
  episode: number,
  watched: boolean,
) {
  const user = await requireUser();
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  const [existing] = await db
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.id, itemId));
  if (!existing || existing.userId !== user.id)
    return { status: 404 as const, body: { message: "Not found" } };

  if (watched) {
    await db
      .insert(watchProgress)
      .values({ itemId, season, episode })
      .onConflictDoNothing();
  } else {
    const rows = await db
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.itemId, itemId));
    const target = rows.find(
      (r) => r.season === season && r.episode === episode,
    );
    if (target) {
      await db.delete(watchProgress).where(eq(watchProgress.id, target.id));
    }
  }
  return { status: 200 as const, body: { message: "ok" } };
}

export async function listPublicWatchlistByUsername(username: string) {
  const [u] = await db
    .select({
      id: user.id,
      username: user.username,
      displayUsername: user.displayUsername,
      name: user.name,
      image: user.image,
      bio: userInfo.bio,
      verified: userInfo.verified,
    })
    .from(user)
    .leftJoin(userInfo, eq(userInfo.userId, user.id))
    .where(eq(user.username, username))
    .limit(1);
  if (!u) return { status: 404 as const, body: { message: "User not found" } };

  const items = await db
    .select()
    .from(watchlistItems)
    .where(
      and(eq(watchlistItems.userId, u.id), eq(watchlistItems.isPublic, true)),
    )
    .orderBy(desc(watchlistItems.updatedAt));

  const progressAll: Record<string, { season: number; episode: number }[]> = {};
  for (const item of items) {
    const rows = await db
      .select()
      .from(watchProgress)
      .where(eq(watchProgress.itemId, item.id));
    progressAll[item.id] = rows.map((r) => ({
      season: r.season,
      episode: r.episode,
    }));
  }

  return {
    status: 200 as const,
    body: {
      items,
      progress: progressAll,
      user: {
        id: u.id,
        username: u.username,
        displayName: u.name || u.displayUsername,
        image: u.image,
        bio: u.bio,
        verified: u.verified,
      },
    },
  };
}

export async function updateWatchlistNotes(id: string, notes: string | null) {
  const user = await requireUser();
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  const [existing] = await db
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.id, id));
  if (!existing || existing.userId !== user.id)
    return { status: 404 as const, body: { message: "Not found" } };

  const cleanNotes =
    typeof notes === "string" ? notes.trim().slice(0, 4000) : null;

  const [row] = await db
    .update(watchlistItems)
    .set({
      notes: cleanNotes,
      updatedAt: new Date(),
    })
    .where(eq(watchlistItems.id, id))
    .returning();

  return { status: 200 as const, body: row };
}
