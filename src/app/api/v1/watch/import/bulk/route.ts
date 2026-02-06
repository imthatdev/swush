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

import { NextRequest, NextResponse } from "next/server";
import { addToWatchlist } from "@/lib/api/watchlist";
import { getCurrentUser } from "@/lib/client/user";
import { db } from "@/db/client";
import { watchProgress, watchlistItems } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";

type ImportItem = {
  provider?: string;
  mediaType: "movie" | "tv" | "anime";
  providerId: string;
  title: string;
  posterPath?: string | null;
  overview?: string | null;
  year?: number | null;
  originCountry?: string[];
  genreIds?: number[];
  progress?: number | null;
};

async function ensureEpisodeProgress(itemId: string, progress?: number | null) {
  const count = typeof progress === "number" ? Math.floor(progress) : 0;
  if (!count || count <= 0) return;

  const existing = await db
    .select({ episode: watchProgress.episode, season: watchProgress.season })
    .from(watchProgress)
    .where(eq(watchProgress.itemId, itemId));

  const existingEpisodes = new Set(
    existing.filter((row) => row.season === 1).map((row) => row.episode)
  );

  const toInsert = [] as { itemId: string; season: number; episode: number }[];
  for (let ep = 1; ep <= count; ep += 1) {
    if (!existingEpisodes.has(ep)) {
      toInsert.push({ itemId, season: 1, episode: ep });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(watchProgress).values(toInsert).onConflictDoNothing();
  }
}

export const POST = withApiError(async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { items: ImportItem[] };
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ ok: 0, fail: 0 }, { status: 200 });
    }

    let ok = 0;
    let fail = 0;
    for (const it of items) {
      const res = await addToWatchlist(it);
      let itemId: string | null = null;

      if (res.status === 200 && (res.body as { id?: string })?.id) {
        itemId = (res.body as { id: string }).id;
      } else if (res.status === 409) {
        const provider = (it.provider || "tmdb").toLowerCase();
        const [existing] = await db
          .select({ id: watchlistItems.id })
          .from(watchlistItems)
          .where(
            and(
              eq(watchlistItems.userId, user.id),
              eq(watchlistItems.provider, provider),
              eq(watchlistItems.providerId, it.providerId)
            )
          )
          .limit(1);
        itemId = existing?.id ?? null;
      }

      if (itemId) {
        await ensureEpisodeProgress(itemId, it.progress ?? null);
      }

      if (res.status === 200 || res.status === 409) ok++;
      else fail++;
    }
    return NextResponse.json({ ok, fail }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});
