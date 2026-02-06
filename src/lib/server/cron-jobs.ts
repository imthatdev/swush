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
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { anilistLink, watchProgress, watchlistItems } from "@/db/schemas";
import { anilistFetchViewerWatching } from "@/lib/providers/anilist";
import { createNotification } from "@/lib/server/notifications";
import { runMediaJobs } from "@/lib/server/media-jobs";
import { runPreviewJobs } from "@/lib/server/preview-jobs";
import { runStreamJobs } from "@/lib/server/stream-jobs";
import { runStorageCleanupJobs } from "@/lib/server/storage-cleanup-jobs";

export async function runMediaOptimizationJob(limit = 3) {
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 3;
  return runMediaJobs(count);
}

export async function runPreviewGenerationJob(limit = 3) {
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 3;
  return runPreviewJobs(count);
}

export async function runStreamGenerationJob(limit = 1) {
  const count = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1;
  return runStreamJobs(count);
}

export async function runStorageCleanupJob(limit = 3) {
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 3;
  return runStorageCleanupJobs(count);
}

export async function syncAnilistForUser(userId: string) {
  const links = await db
    .select({
      userId: anilistLink.userId,
      accessToken: anilistLink.accessToken,
      expiresAt: anilistLink.expiresAt,
    })
    .from(anilistLink)
    .where(eq(anilistLink.userId, userId));
  if (!links.length)
    return {
      added: 0,
      updated: 0,
      episodesAdded: 0,
      skippedExpired: 1,
      message: "No AniList link found.",
    };
  const link = links[0];
  if (link.expiresAt && link.expiresAt < new Date()) {
    return {
      added: 0,
      updated: 0,
      episodesAdded: 0,
      skippedExpired: 1,
      message: "AniList link expired.",
    };
  }

  const ensureEpisodeProgress = async (
    itemId: string,
    progress?: number | null,
  ) => {
    const count = typeof progress === "number" ? Math.floor(progress) : 0;
    if (!count || count <= 0) return 0;
    const existing = await db
      .select({ episode: watchProgress.episode, season: watchProgress.season })
      .from(watchProgress)
      .where(eq(watchProgress.itemId, itemId));
    const existingEpisodes = new Set(
      existing.filter((row) => row.season === 1).map((row) => row.episode),
    );
    const toInsert = [] as {
      itemId: string;
      season: number;
      episode: number;
    }[];
    for (let ep = 1; ep <= count; ep += 1) {
      if (!existingEpisodes.has(ep)) {
        toInsert.push({ itemId, season: 1, episode: ep });
      }
    }
    if (toInsert.length > 0) {
      await db.insert(watchProgress).values(toInsert).onConflictDoNothing();
    }
    return toInsert.length;
  };

  const watching = await anilistFetchViewerWatching(link.accessToken);
  const existing = await db
    .select({
      id: watchlistItems.id,
      providerId: watchlistItems.providerId,
      status: watchlistItems.status,
      rating: watchlistItems.rating,
      title: watchlistItems.title,
      posterPath: watchlistItems.posterPath,
      year: watchlistItems.year,
    })
    .from(watchlistItems)
    .where(
      and(
        eq(watchlistItems.userId, userId),
        eq(watchlistItems.provider, "anilist"),
      ),
    );
  const map = new Map(existing.map((row) => [row.providerId, row] as const));
  let userAdded = 0;
  let userUpdated = 0;
  let userEpisodesAdded = 0;
  for (const item of watching) {
    const row = map.get(item.providerId);
    if (!row) {
      const [inserted] = await db
        .insert(watchlistItems)
        .values({
          userId,
          provider: "anilist",
          providerId: item.providerId,
          status: item.status ?? "watching",
          rating: item.rating ?? null,
          title: item.titleEnglish ?? item.titleRomaji ?? item.title ?? "",
          posterPath: item.posterPath ?? null,
          year: item.year ?? null,
          mediaType: "anime",
        })
        .returning({ id: watchlistItems.id });
      userAdded += 1;
      userEpisodesAdded += await ensureEpisodeProgress(
        inserted.id,
        item.progress,
      );
      continue;
    }
    const incomingStatus = item.status ?? row.status;
    const incomingRating = item.rating ?? row.rating;
    const incomingTitle =
      item.titleEnglish ?? item.titleRomaji ?? item.title ?? row.title;
    const incomingPoster = item.posterPath ?? row.posterPath;
    const incomingYear = item.year ?? row.year;
    const shouldUpdate =
      row.status !== incomingStatus ||
      row.rating !== incomingRating ||
      row.title !== incomingTitle ||
      row.posterPath !== incomingPoster ||
      row.year !== incomingYear;
    if (shouldUpdate) {
      await db
        .update(watchlistItems)
        .set({
          status: incomingStatus,
          rating: incomingRating,
          title: incomingTitle,
          posterPath: incomingPoster,
          year: incomingYear,
          updatedAt: new Date(),
        })
        .where(eq(watchlistItems.id, row.id));
      userUpdated += 1;
    }
    const eps = await ensureEpisodeProgress(row.id, item.progress);
    userEpisodesAdded += eps;
  }
  if (userAdded > 0 || userUpdated > 0 || userEpisodesAdded > 0) {
    const summary = [
      userAdded ? `${userAdded} added` : null,
      userUpdated ? `${userUpdated} updated` : null,
      userEpisodesAdded ? `${userEpisodesAdded} eps` : null,
    ]
      .filter(Boolean)
      .join(", ");
    await createNotification({
      userId,
      title: "AniList sync completed",
      message: summary || "Sync completed.",
      type: "anilist",
      data: {
        added: userAdded,
        updated: userUpdated,
        episodesAdded: userEpisodesAdded,
      },
    });
  }
  return {
    added: userAdded,
    updated: userUpdated,
    episodesAdded: userEpisodesAdded,
    skippedExpired: 0,
    message: "AniList sync complete.",
  };
}

export async function runAnilistWatchingJob() {
  const ensureEpisodeProgress = async (
    itemId: string,
    progress?: number | null,
  ) => {
    const count = typeof progress === "number" ? Math.floor(progress) : 0;
    if (!count || count <= 0) return 0;

    const existing = await db
      .select({ episode: watchProgress.episode, season: watchProgress.season })
      .from(watchProgress)
      .where(eq(watchProgress.itemId, itemId));

    const existingEpisodes = new Set(
      existing.filter((row) => row.season === 1).map((row) => row.episode),
    );

    const toInsert = [] as {
      itemId: string;
      season: number;
      episode: number;
    }[];
    for (let ep = 1; ep <= count; ep += 1) {
      if (!existingEpisodes.has(ep)) {
        toInsert.push({ itemId, season: 1, episode: ep });
      }
    }

    if (toInsert.length > 0) {
      await db.insert(watchProgress).values(toInsert).onConflictDoNothing();
    }
    return toInsert.length;
  };

  const links = await db
    .select({
      userId: anilistLink.userId,
      accessToken: anilistLink.accessToken,
      expiresAt: anilistLink.expiresAt,
    })
    .from(anilistLink);

  let users = 0;
  let added = 0;
  let updated = 0;
  let skippedExpired = 0;
  let episodesAdded = 0;

  const perUserSummaries: {
    userId: string;
    added: number;
    updated: number;
    episodesAdded: number;
  }[] = [];

  for (const link of links) {
    if (link.expiresAt && link.expiresAt < new Date()) {
      skippedExpired += 1;
      continue;
    }

    users += 1;

    const watching = await anilistFetchViewerWatching(link.accessToken);

    const existing = await db
      .select({
        id: watchlistItems.id,
        providerId: watchlistItems.providerId,
        status: watchlistItems.status,
        rating: watchlistItems.rating,
        title: watchlistItems.title,
        posterPath: watchlistItems.posterPath,
        year: watchlistItems.year,
      })
      .from(watchlistItems)
      .where(
        and(
          eq(watchlistItems.userId, link.userId),
          eq(watchlistItems.provider, "anilist"),
        ),
      );

    const map = new Map(existing.map((row) => [row.providerId, row] as const));

    let userAdded = 0;
    let userUpdated = 0;
    let userEpisodesAdded = 0;

    for (const item of watching) {
      const row = map.get(item.providerId);
      if (!row) {
        const [inserted] = await db
          .insert(watchlistItems)
          .values({
            userId: link.userId,
            provider: "anilist",
            providerId: item.providerId,
            status: item.status ?? "watching",
            rating: item.rating ?? null,
            title: item.titleEnglish ?? item.titleRomaji ?? item.title ?? "",
            posterPath: item.posterPath ?? null,
            year: item.year ?? null,
            mediaType: "anime",
          })
          .returning({ id: watchlistItems.id });
        added += 1;
        userAdded += 1;
        userEpisodesAdded += await ensureEpisodeProgress(
          inserted.id,
          item.progress,
        );
        continue;
      }

      const incomingStatus = item.status ?? row.status;
      const incomingRating = item.rating ?? row.rating;
      const incomingTitle =
        item.titleEnglish ?? item.titleRomaji ?? item.title ?? row.title;
      const incomingPoster = item.posterPath ?? row.posterPath;
      const incomingYear = item.year ?? row.year;

      const shouldUpdate =
        row.status !== incomingStatus ||
        row.rating !== incomingRating ||
        row.title !== incomingTitle ||
        row.posterPath !== incomingPoster ||
        row.year !== incomingYear;

      if (shouldUpdate) {
        await db
          .update(watchlistItems)
          .set({
            status: incomingStatus,
            rating: incomingRating,
            title: incomingTitle,
            posterPath: incomingPoster,
            year: incomingYear,
            updatedAt: new Date(),
          })
          .where(eq(watchlistItems.id, row.id));
        updated += 1;
        userUpdated += 1;
      }

      const eps = await ensureEpisodeProgress(row.id, item.progress);
      episodesAdded += eps;
      userEpisodesAdded += eps;
    }

    if (userAdded > 0 || userUpdated > 0 || userEpisodesAdded > 0) {
      const summary = [
        userAdded ? `${userAdded} added` : null,
        userUpdated ? `${userUpdated} updated` : null,
        userEpisodesAdded ? `${userEpisodesAdded} eps` : null,
      ]
        .filter(Boolean)
        .join(", ");

      await createNotification({
        userId: link.userId,
        title: "AniList sync completed",
        message: summary || "Sync completed.",
        type: "anilist",
        data: {
          added: userAdded,
          updated: userUpdated,
          episodesAdded: userEpisodesAdded,
        },
      });

      perUserSummaries.push({
        userId: link.userId,
        added: userAdded,
        updated: userUpdated,
        episodesAdded: userEpisodesAdded,
      });
    }
  }

  return {
    users,
    added,
    updated,
    skippedExpired,
    episodesAdded,
    perUser: perUserSummaries,
  };
}
