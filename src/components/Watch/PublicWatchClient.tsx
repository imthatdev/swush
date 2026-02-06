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

"use client";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationFooter } from "@/components/Shared/PaginationFooter";
import { apiV1 } from "@/lib/api-path";
import {
  ProgressMap,
  PublicWatchItem,
} from "../../app/(files)/l/[username]/page";

function formatProgressCount(
  itemId: string,
  progress: ProgressMap,
  totals?: Record<string, number>,
) {
  const watched = (progress[itemId] || []).length;
  const total = totals?.[itemId];
  if (typeof total === "number" && total > 0) {
    return `${watched}/${total} eps`;
  }
  return `${watched} ep${watched === 1 ? "" : "s"}`;
}

type Tab = "all" | "movie" | "tv" | "anime";

export default function PublicWatchClient({
  initialItems,
  initialProgress,
}: {
  initialItems: PublicWatchItem[];
  initialProgress: ProgressMap;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const [totals, setTotals] = useState<Record<string, number>>({});

  function getProviderId(it: PublicWatchItem): string | undefined {
    return (it as unknown as { providerId?: string }).providerId;
  }

  const items = initialItems;
  const progress = initialProgress;

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return items.filter((it) => {
      const byTab = tab === "all" ? true : it.mediaType === tab;
      const byText = text ? it.title.toLowerCase().includes(text) : true;
      return byTab && byText;
    });
  }, [items, q, tab]);

  const { page, setPage, totalPages, paginatedItems } = usePagination(
    filtered,
    24,
  );

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab]);

  useEffect(() => {
    const toFetch = paginatedItems.filter(
      (it) =>
        (it.mediaType === "tv" || it.mediaType === "anime") && !totals[it.id],
    );
    if (toFetch.length === 0) return;

    let aborted = false;
    (async () => {
      for (const it of toFetch) {
        try {
          const pid = getProviderId(it);
          if (!pid) continue;
          const res = await fetch(
            apiV1(`/watch/tv/${encodeURIComponent(pid)}`),
            {
              cache: "no-store",
            },
          );
          if (!res.ok) continue;
          const data: {
            seasons?: { season: number; episodeCount: number }[];
            number_of_seasons?: number;
          } = await res.json();
          let total = 0;
          if (Array.isArray(data.seasons) && data.seasons.length > 0) {
            total = data.seasons
              .filter((s) => typeof s.season === "number" && s.season !== 0)
              .reduce((acc, s) => acc + (s.episodeCount || 0), 0);
          }
          if (!aborted) {
            setTotals((prev) => ({ ...prev, [it.id]: total > 0 ? total : 0 }));
          }
        } catch {}
      }
    })();

    return () => {
      aborted = true;
    };
  }, [paginatedItems, totals]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="flex-wrap-reverse md:flex-row-reverse h-full">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="movie">Movies</TabsTrigger>
            <TabsTrigger value="tv">Shows</TabsTrigger>
            <TabsTrigger value="anime">Anime</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search in this list…"
          className="md:max-w-sm"
        />
      </div>

      {!filtered || filtered.length === 0 ? (
        <p className="text-muted-foreground">No public items yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in-up">
            {paginatedItems.map((it) => (
              <div
                key={it.id}
                className="border rounded-md overflow-hidden bg-card animate-fade-in-up"
              >
                {it.posterPath && (
                  <Image
                    src={it.posterPath}
                    alt={it.title}
                    width={300}
                    height={450}
                    className="w-full h-48 object-cover"
                  />
                )}
                <div className="p-2">
                  <div className="text-sm font-medium leading-tight line-clamp-2">
                    {it.title}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                    <span>{it.mediaType.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      {typeof it.rating === "number" && (
                        <span
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px]"
                          title="Rating"
                        >
                          <span aria-hidden>★</span>
                          {it.rating}
                        </span>
                      )}
                      {(it.mediaType === "tv" || it.mediaType === "anime") && (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 border text-[10px]"
                          title="Episodes watched"
                        >
                          {formatProgressCount(it.id, progress, totals)}
                        </span>
                      )}
                    </div>
                  </div>
                  {Boolean(it.notes) && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {it.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <PaginationFooter
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
