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
import {
  IconSquareCheck,
  IconCheck,
  IconTrash,
  IconEdit,
  IconEyeOff,
  IconEye,
  IconListCheck,
  IconDeviceImacPlus,
  IconNote,
  IconShare,
  IconStar,
  IconTimeDuration0,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import Image from "next/image";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageLayout from "../Common/PageLayout";
import { shareUrl } from "@/lib/api/helpers";
import { apiV1, apiV1Path } from "@/lib/api-path";
import CopyButton from "@/components/Common/CopyButton";
import ShareQrButton from "@/components/Common/ShareQrButton";
import { PaginationFooter } from "../Shared/PaginationFooter";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "@/lib/utils";
import SelectionBar from "@/components/Common/SelectionBar";
import { useUserFeatures } from "@/hooks/use-user-features";

type SearchItem = {
  provider: "tmdb";
  mediaType: "movie" | "tv";
  providerId: string;
  title: string;
  poster?: string | null;
  year?: number | null;
  rating?: number | null;
  overview?: string | null;
};

type WatchItem = {
  id: string;
  title: string;
  posterPath?: string | null;
  mediaType: "movie" | "tv" | "anime";
  provider?: string | null;
  status: string;
  providerId: string;
  isPublic?: boolean;
  rating?: number | null;
  notes?: string | null;
};

type Tab = "all" | "movie" | "tv" | "anime";

type ProgressMap = Record<string, { season: number; episode: number }[]>;

const watchlistUrl = (...segments: Array<string | number>) =>
  apiV1Path("/watchlist", ...segments);

export default function WatchClient({ username }: { username: string }) {
  const watchUrl = (path = "") => apiV1(`/watch${path}`);
  const PAGE_SIZE_OPTIONS = [9, 18, 24, 32] as const;
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<SearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const cacheRef = useRef(
    new Map<
      string,
      {
        items: WatchItem[];
        progress: ProgressMap;
        total: number;
        ts: number;
      }
    >(),
  );

  const [openTv, setOpenTv] = useState(false);
  const [activeItem, setActiveItem] = useState<WatchItem | null>(null);
  const [seasonEpisodes, setSeasonEpisodes] = useState<
    Record<number, { episode: number; name: string }[]>
  >({});

  const [seasons, setSeasons] = useState<
    { season: number; name: string; episodeCount: number }[]
  >([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonsLoading, setSeasonsLoading] = useState(false);

  const [filterQ, setFilterQ] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [openSearch, setOpenSearch] = useState(false);

  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const { features, loading: featuresLoading } = useUserFeatures();
  const watchlistEnabled = features.watchlist?.isEnabled ?? true;
  const watchlistDisabled = !watchlistEnabled && !featuresLoading;
  const {
    selectedIds,
    isSelected,
    toggleOne,
    togglePage,
    clear: clearSelection,
    count: selectedCount,
    performBulk,
  } = useBulkSelect();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);

  const [episodeSelectMode, setEpisodeSelectMode] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Set<string>>(
    new Set(),
  );
  const [openNotes, setOpenNotes] = useState(false);
  const [notesItem, setNotesItem] = useState<WatchItem | null>(null);
  const [notesText, setNotesText] = useState("");
  const [episodesTotals, setEpisodesTotals] = useState<Record<string, number>>(
    {},
  );
  const [syncing, setSyncing] = useState(false);

  const debouncedQ = useMemo(() => q.trim(), [q]);

  const cacheKey = useMemo(() => {
    const q = filterQ.trim().toLowerCase();
    return `${tab}|${q}|${pageSize}|${page}`;
  }, [tab, filterQ, pageSize, page]);

  useEffect(() => {
    let cancelled = false;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setItems(cached.items);
      setProgress(cached.progress);
      setTotalCount(cached.total);
      const nextTotalPages = Math.max(1, Math.ceil(cached.total / pageSize));
      setTotalPages(nextTotalPages);
      setListLoading(false);
      if (Date.now() - cached.ts < 30_000) {
        return () => {
          cancelled = true;
        };
      }
    }

    (async () => {
      if (!cached) setListLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String((page - 1) * pageSize));
        if (tab !== "all") params.set("mediaType", tab);
        if (filterQ.trim()) params.set("q", filterQ.trim());

        const res = await fetch(`${watchlistUrl()}?${params.toString()}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          if (cancelled) return;
          const nextItems = json.items || [];
          const nextProgress = json.progress || {};
          const total = Number(json.total || 0);
          setItems(nextItems);
          setProgress(nextProgress);
          setTotalCount(total);
          const nextTotalPages = Math.max(1, Math.ceil(total / pageSize));
          setTotalPages(nextTotalPages);
          if (page > nextTotalPages) {
            setPage(nextTotalPages);
          }
          cacheRef.current.set(cacheKey, {
            items: nextItems,
            progress: nextProgress,
            total,
            ts: Date.now(),
          });
        }
      } catch {
        toast.error("Failed to fetch watchlist items");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, page, pageSize, tab, filterQ]);

  useEffect(() => {
    if (!debouncedQ) {
      setSearch([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    fetch(watchUrl(`/search?q=${encodeURIComponent(debouncedQ)}`), {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => setSearch(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debouncedQ]);

  const getShareLink = useCallback(() => {
    if (!username) throw new Error("No username found");
    return shareUrl("l", username);
  }, [username]);

  async function add(it: SearchItem) {
    const res = await fetch(watchlistUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: it.provider,
        mediaType: it.mediaType,
        providerId: it.providerId,
        title: it.title,
        posterPath: it.poster,
        overview: it.overview,
        year: it.year,
      }),
    });

    if (res.status === 409) {
      toast.error("Already in your watchlist");
      return;
    }

    if (res.ok) {
      const created = await res.json();
      if (created?.id) {
        setItems((prev) => [created, ...prev]);
        setTotalCount((prev) => prev + 1);
        cacheRef.current.clear();
      }
      toast.success("Added to watchlist");
    } else {
      const t = await res.text();
      toast.error(t || "Failed to add");
    }
  }

  async function remove(id: string) {
    const res = await fetch(watchlistUrl(id), { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotalCount((prev) => Math.max(0, prev - 1));
      cacheRef.current.clear();
      const p = { ...progress };
      delete p[id];
      setProgress(p);
      toast.success("Removed");
    }
  }

  async function openManage(item: WatchItem) {
    if (item.mediaType !== "tv" && item.mediaType !== "anime") return;
    setSeasons([]);
    setSeasonEpisodes({});
    setSelectedSeason(null);
    setActiveItem(item);
    setOpenTv(true);
    setSeasonsLoading(true);
    try {
      const res = await fetch(
        watchUrl(`/tv/${encodeURIComponent(item.providerId)}`),
        { cache: "no-store" },
      );
      if (res.ok) {
        const data = await res.json();
        const ss: { season: number; name: string; episodeCount: number }[] = (
          data.seasons || []
        ).map((s: { season: number; name: string; episodeCount: number }) => ({
          season: s.season,
          name: s.name,
          episodeCount: s.episodeCount,
        }));

        if (
          (!data.seasons || data.seasons.length === 0) &&
          typeof data.number_of_seasons === "number" &&
          data.number_of_seasons > 0
        ) {
          const synthetic = Array.from(
            { length: data.number_of_seasons },
            (_, i) => ({
              season: i + 1,
              name: `Season ${i + 1}`,
              episodeCount: 0,
            }),
          );
          setSeasons(synthetic);
          setSelectedSeason(1);
          await loadSeasonEpisodes(item.providerId, 1);
          return;
        }
        const filtered = ss.length > 1 ? ss.filter((s) => s.season !== 0) : ss;
        setSeasons(filtered);
        if (filtered.length > 0) {
          setSelectedSeason(filtered[0].season);
          await loadSeasonEpisodes(item.providerId, filtered[0].season);
        }
      }
    } finally {
      setSeasonsLoading(false);
    }
  }

  async function loadSeasonEpisodes(tvProviderId: string, season: number) {
    setSelectedSeason(season);
    if (seasonEpisodes[season]) return;
    const res = await fetch(
      watchUrl(`/tv/${encodeURIComponent(tvProviderId)}/season/${season}`),
    );
    if (res.ok) {
      const data: { episodes: { episode: number; name: string }[] } =
        await res.json();
      setSeasonEpisodes((prev) => ({
        ...prev,
        [season]: (data.episodes || []).map((e) => ({
          episode: e.episode,
          name: e.name,
        })),
      }));
    }
  }

  async function toggleEpisode(
    itemId: string,
    season: number,
    episode: number,
    checked: boolean,
  ) {
    const res = await fetch(watchlistUrl(itemId, "progress"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season, episode, watched: checked }),
    });
    if (res.ok) {
      setProgress((prev) => {
        const arr = prev[itemId] ? [...prev[itemId]] : [];
        const idx = arr.findIndex(
          (e) => e.season === season && e.episode === episode,
        );
        if (checked && idx === -1) arr.push({ season, episode });
        if (!checked && idx !== -1) arr.splice(idx, 1);
        return { ...prev, [itemId]: arr };
      });
    }
  }

  function isWatched(itemId: string, s: number, e: number) {
    return !!progress[itemId]?.some((x) => x.season === s && x.episode === e);
  }

  const paginatedItems = items;

  useEffect(() => {
    clearSelection();
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filterQ, pageSize, setPage]);

  useEffect(() => {
    clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const nextTotalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    setTotalPages(nextTotalPages);
    if (page > nextTotalPages) {
      setPage(nextTotalPages);
    }
  }, [totalCount, pageSize, page]);

  const toggleAllOnPage = () => togglePage(paginatedItems.map((x) => x.id));

  async function bulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    const toDelete = [...selectedIds];
    const { ok, fail } = await performBulk(toDelete, async (id) =>
      fetch(watchlistUrl(id), { method: "DELETE" }),
    );
    setItems((prev) => prev.filter((x) => !toDelete.includes(x.id)));
    if (ok > 0) {
      setTotalCount((prev) => Math.max(0, prev - ok));
    }
    if (toDelete.length > 0) {
      cacheRef.current.clear();
    }
    setProgress((prev) => {
      const next = { ...prev };
      toDelete.forEach((id) => delete next[id]);
      return next;
    });
    clearSelection();
    if (fail.length) {
      toast.error(`Deleted ${ok}/${toDelete.length}.`, {
        description: fail[0]?.error || "Some deletions failed.",
      });
    } else {
      toast.success(`Deleted ${ok} item${ok === 1 ? "" : "s"}.`);
    }
  }

  async function setItemVisibility(id: string, visible: boolean) {
    const res = await fetch(watchlistUrl(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: visible }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, isPublic: updated.isPublic } : x,
        ),
      );
      toast.success(visible ? "Made public" : "Made private");
    } else {
      toast.error("Failed to update visibility");
    }
  }

  async function bulkSetVisibility(visible: boolean) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const reqs = ids.map((id) =>
      fetch(watchlistUrl(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: visible }),
      }),
    );
    const results = await Promise.allSettled(reqs);
    const ok = results.filter(
      (r) =>
        r.status === "fulfilled" &&
        (r as PromiseFulfilledResult<Response>).value.ok,
    ).length;
    if (ok > 0) {
      setItems((prev) =>
        prev.map((x) => (ids.includes(x.id) ? { ...x, isPublic: visible } : x)),
      );
      toast.success(
        `${visible ? "Made public" : "Made private"} ${ok} item(s)`,
      );
    } else {
      toast.error("No items updated");
    }
  }

  function openNotesEditor(item: WatchItem) {
    setNotesItem(item);
    setNotesText(item.notes || "");
    setOpenNotes(true);
  }

  async function saveNotes() {
    if (!notesItem) return;
    const res = await fetch(watchlistUrl(notesItem.id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesText }),
    });
    if (res.ok) {
      const updated = await res.json();
      setItems((prev) =>
        prev.map((x) =>
          x.id === notesItem.id ? { ...x, notes: updated.notes } : x,
        ),
      );
      toast.success("Details saved");
      setOpenNotes(false);
      setNotesItem(null);
    } else {
      toast.error("Failed to save details");
    }
  }

  function epKey(s: number, e: number) {
    return `${s}:${e}`;
  }
  function toggleEpisodeSelected(s: number, e: number) {
    const key = epKey(s, e);
    setSelectedEpisodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function clearEpisodeSelection() {
    setSelectedEpisodes(new Set());
  }
  function selectAllEpisodesInSeason(s: number) {
    const eps = seasonEpisodes[s] || [];
    setSelectedEpisodes(new Set(eps.map((e) => epKey(s, e.episode))));
  }
  async function bulkMarkEpisodes(watched: boolean) {
    if (!activeItem || selectedEpisodes.size === 0) return;
    const ops = Array.from(selectedEpisodes).map((key) => {
      const [sStr, eStr] = key.split(":");
      const s = Number(sStr),
        e = Number(eStr);
      return fetch(watchlistUrl(activeItem.id, "progress"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season: s, episode: e, watched }),
      });
    });
    await Promise.allSettled(ops);
    setProgress((prev) => {
      if (!activeItem) return prev;
      const arr = prev[activeItem.id]
        ? new Set(prev[activeItem.id].map((p) => epKey(p.season, p.episode)))
        : new Set<string>();
      selectedEpisodes.forEach((key) => {
        const [sStr, eStr] = key.split(":");
        const s = Number(sStr),
          e = Number(eStr);
        const k = epKey(s, e);
        if (watched) arr.add(k);
        else arr.delete(k);
      });
      const nextArr = Array.from(arr).map((k) => {
        const [sStr, eStr] = k.split(":");
        return { season: Number(sStr), episode: Number(eStr) };
      });
      return { ...prev, [activeItem.id]: nextArr };
    });
    clearEpisodeSelection();
    setEpisodeSelectMode(false);
    toast.success(watched ? "Marked selected as watched" : "Cleared selected");
  }

  useEffect(() => {
    const toFetch = paginatedItems.filter(
      (it) =>
        it.provider === "tmdb" &&
        (it.mediaType === "tv" || it.mediaType === "anime") &&
        episodesTotals[it.id] === undefined,
    );
    if (toFetch.length === 0) return;

    (async () => {
      await Promise.all(
        toFetch.map(async (it) => {
          try {
            const res = await fetch(
              watchUrl(`/tv/${encodeURIComponent(it.providerId)}`),
              { cache: "no-store" },
            );
            if (!res.ok) return;
            const data = await res.json();
            let total = 0;
            if (Array.isArray(data.seasons) && data.seasons.length > 0) {
              total = data.seasons.reduce(
                (acc: number, s: { episodeCount?: number }) =>
                  acc + (s.episodeCount || 0),
                0,
              );
            } else if (typeof data.number_of_episodes === "number") {
              total = data.number_of_episodes;
            }
            setEpisodesTotals((prev) => ({ ...prev, [it.id]: total }));
          } catch {
            toast.error(`Failed to fetch episodes total for ${it.title}`);
          }
        }),
      );
    })();
  }, [paginatedItems, episodesTotals]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(apiV1("/anilist/sync"), { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("AniList sync complete");
      } else {
        toast.error("AniList sync failed", {
          description: data?.message || "Unknown error",
        });
      }
    } catch (e) {
      toast.error("AniList sync failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <PageLayout
      title="Your Watchlist"
      subtitle="Manage your watchlist and track your progress"
      headerActions={
        <>
          <Button onClick={handleSync} disabled={syncing} variant="secondary">
            {syncing ? "Syncing AniList..." : "Sync AniList"}
            <IconTimeDuration0 />
          </Button>
          <CopyButton
            variant="outline"
            successMessage="Share link copied"
            getText={getShareLink}
            disabled={!username}
          >
            <IconShare />
            <span>Share List</span>
          </CopyButton>
          <ShareQrButton url={getShareLink()} label="Share QR" />
        </>
      }
      toolbar={
        <>
          <Tabs value={tab} onValueChange={(v: string) => setTab(v as Tab)}>
            <TabsList className="flex-wrap-reverse md:flex-row-reverse h-full">
              <TabsTrigger value="movie">Movies</TabsTrigger>
              <TabsTrigger value="tv">Shows</TabsTrigger>
              <TabsTrigger value="anime">Anime</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1" />
          <Input
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            placeholder="Search in your list…"
            className="md:max-w-sm"
          />
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="rounded-md border text-sm px-2 min-w-30">
              <SelectValue placeholder="Select page size" />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} items
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => setOpenSearch(true)}
            disabled={watchlistDisabled}
            title={
              watchlistDisabled
                ? "Manage this in Settings → Features. If disabled by an admin, contact them."
                : undefined
            }
          >
            <IconDeviceImacPlus />
            New
          </Button>
        </>
      }
    >
      {watchlistDisabled ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Watchlist is disabled. You can manage this in Settings → Features. If
          it was disabled by an admin, contact them.
        </div>
      ) : null}
      <Card>
        <CardContent>
          <SelectionBar count={selectedCount} className="mb-3">
            <Button variant="outline" onClick={toggleAllOnPage} size="sm">
              Select Page ({paginatedItems.length})
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button variant="outline" onClick={() => bulkSetVisibility(true)}>
              <IconEye /> Make public
            </Button>
            <Button variant="outline" onClick={() => bulkSetVisibility(false)}>
              <IconEyeOff /> Make private
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmBulkOpen(true)}
            >
              Remove Selected
            </Button>
          </SelectionBar>
          {listLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="border rounded-md p-3 flex gap-3 bg-card"
                >
                  <Skeleton className="w-20 h-30 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginatedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Search above and add some titles!
            </p>
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
                {paginatedItems.map((it) => (
                  <div
                    key={it.id}
                    className={cn(
                      "border rounded-md p-3 flex gap-3 bg-card relative group animate-fade-in-up",
                      isSelected(it.id) && "border-2 border-primary",
                    )}
                    onClick={
                      selectedIds.length > 0
                        ? () => toggleOne(it.id)
                        : undefined
                    }
                  >
                    <div className="absolute top-3 left-3 flex items-center gap-2 text-xs text-muted-foreground md:opacity-0 group-hover:opacity-100">
                      <Checkbox
                        checked={isSelected(it.id)}
                        onCheckedChange={() => toggleOne(it.id)}
                      />
                    </div>

                    {it.posterPath && (
                      <Image
                        unoptimized
                        src={it.posterPath}
                        alt={it.title}
                        width={80}
                        height={120}
                        className="rounded object-cover w-20 h-30"
                        onError={() => {}}
                      />
                    )}
                    <div className="flex-1 min-w-0 relative">
                      <div className="font-medium truncate">{it.title}</div>
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                        <span>{it.mediaType.toUpperCase()}</span>
                        {(it.mediaType === "tv" || it.mediaType === "anime") &&
                          (() => {
                            const watched = progress[it.id]?.length || 0;
                            const total = episodesTotals[it.id];
                            return (
                              <span
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px]"
                                title="Episodes watched"
                              >
                                {watched}
                                {typeof total === "number" && total > 0
                                  ? `/${total}`
                                  : ""}{" "}
                                eps
                              </span>
                            );
                          })()}
                        {typeof it.rating === "number" && (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 border text-[10px]">
                            <IconStar size={12} /> {it.rating}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 border text-[10px] ${
                            it.isPublic ? "" : "opacity-60"
                          }`}
                        >
                          {it.isPublic ? "Public" : "Private"}
                        </span>
                      </div>
                      {it.notes && (
                        <div className="text-xs text-muted-foreground line-clamp-2 mb-6">
                          {it.notes}
                        </div>
                      )}

                      <div className="flex gap-2 absolute bottom-1 right-1 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        {(it.mediaType === "tv" || it.mediaType === "anime") &&
                          it.provider !== "anilist" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="backdrop-blur-md"
                              onClick={() => openManage(it)}
                            >
                              <IconEdit />
                            </Button>
                          )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="backdrop-blur-md"
                          onClick={() => setItemVisibility(it.id, !it.isPublic)}
                        >
                          {it.isPublic ? <IconEyeOff /> : <IconEye />}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="backdrop-blur-md"
                          onClick={() => openNotesEditor(it)}
                          title="Edit details"
                        >
                          <IconNote />
                        </Button>
                        <Button
                          size="sm"
                          className="backdrop-blur-md"
                          variant="destructive"
                          onClick={() => setConfirmDeleteId(it.id)}
                        >
                          <IconTrash />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={openTv}
        onOpenChange={(v) => {
          setOpenTv(v);
          if (!v) {
            setActiveItem(null);
            setSeasons([]);
            setSeasonEpisodes({});
            setSelectedSeason(null);
            setSeasonsLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage Episodes{activeItem ? ` ꕀ ${activeItem.title}` : ""}
            </DialogTitle>
          </DialogHeader>

          {activeItem && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Load a season and tick episodes you have watched.
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!seasonsLoading && seasons.length === 0 ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      No seasons metadata yet.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => activeItem && openManage(activeItem)}
                    >
                      Retry
                    </Button>
                  </>
                ) : (
                  seasons.map((s) => {
                    const watched = activeItem
                      ? (progress[activeItem.id] || []).filter(
                          (p) => p.season === s.season,
                        ).length
                      : 0;
                    return (
                      <Button
                        key={s.season}
                        size="sm"
                        variant={
                          selectedSeason === s.season ? "secondary" : "outline"
                        }
                        onClick={() =>
                          loadSeasonEpisodes(activeItem!.providerId, s.season)
                        }
                        title={`${s.name} ꕀ ${watched}/${
                          s.episodeCount || "?"
                        } watched`}
                      >
                        S{s.season}
                      </Button>
                    );
                  })
                )}
                {seasonsLoading && (
                  <span className="text-xs text-muted-foreground">
                    Loading seasons…
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedSeason && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant={episodeSelectMode ? "secondary" : "outline"}
                      onClick={() => {
                        setEpisodeSelectMode((v) => !v);
                        clearEpisodeSelection();
                      }}
                    >
                      <IconListCheck />{" "}
                      {episodeSelectMode ? "Done selecting" : "Select episodes"}
                    </Button>
                    {episodeSelectMode && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            selectAllEpisodesInSeason(selectedSeason!)
                          }
                        >
                          <IconSquareCheck /> Select all in season
                        </Button>
                        <Button
                          variant="outline"
                          onClick={clearEpisodeSelection}
                        >
                          Clear selection
                        </Button>
                        <Button
                          variant="default"
                          onClick={() => bulkMarkEpisodes(true)}
                          disabled={selectedEpisodes.size === 0}
                        >
                          <IconCheck /> Mark watched ({selectedEpisodes.size})
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => bulkMarkEpisodes(false)}
                          disabled={selectedEpisodes.size === 0}
                        >
                          Clear watched ({selectedEpisodes.size})
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-4 max-h-[50vh] overflow-auto pr-2">
                {selectedSeason && seasonEpisodes[selectedSeason] ? (
                  <div className="border rounded p-3">
                    <div className="font-medium mb-2">
                      Season {selectedSeason}
                      {(() => {
                        if (!activeItem) return null;
                        const watched = (progress[activeItem.id] || []).filter(
                          (p) => p.season === selectedSeason,
                        ).length;
                        const total =
                          seasons.find((s) => s.season === selectedSeason)
                            ?.episodeCount ?? undefined;
                        return (
                          <span className="text-xs text-muted-foreground ml-2">
                            {watched}
                            {typeof total === "number" && total > 0
                              ? `/${total}`
                              : ""}{" "}
                            watched
                          </span>
                        );
                      })()}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {seasonEpisodes[selectedSeason].map((e) => (
                        <label
                          key={e.episode}
                          className="flex items-center gap-2 text-sm"
                        >
                          {episodeSelectMode ? (
                            <Checkbox
                              checked={selectedEpisodes.has(
                                `${selectedSeason}:${e.episode}`,
                              )}
                              onCheckedChange={() =>
                                toggleEpisodeSelected(
                                  selectedSeason!,
                                  e.episode,
                                )
                              }
                            />
                          ) : (
                            <Checkbox
                              checked={isWatched(
                                activeItem.id,
                                selectedSeason!,
                                e.episode,
                              )}
                              onCheckedChange={(v) =>
                                toggleEpisode(
                                  activeItem.id,
                                  selectedSeason!,
                                  e.episode,
                                  Boolean(v),
                                )
                              }
                            />
                          )}
                          <span className="truncate">
                            E{e.episode}: {e.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a season to view episodes.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openSearch} onOpenChange={setOpenSearch}>
        <DialogContent className="w-6xl h-[80svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Search titles</DialogTitle>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search movies, shows…"
            />
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {search.map((r) => {
                const exists = items.some(
                  (it) => it.providerId === r.providerId,
                );
                return (
                  <div
                    key={`${r.mediaType}-${r.providerId}`}
                    className="border rounded-md overflow-hidden bg-card"
                  >
                    {r.poster && (
                      <Image
                        unoptimized
                        src={r.poster}
                        alt={r.title}
                        width={300}
                        height={450}
                        className="w-full h-40 object-cover"
                        onError={() => {}}
                      />
                    )}
                    <div className="p-2 space-y-1">
                      <div className="text-sm font-medium leading-tight line-clamp-2">
                        {r.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.mediaType.toUpperCase()}{" "}
                        {r.year ? `• ${r.year}` : ""}
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-1"
                        onClick={() => add(r)}
                        disabled={loading || exists}
                      >
                        {exists ? "Already added" : "Add"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(v) => {
          if (!v) setConfirmDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this item?</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (confirmDeleteId) {
                  await remove(confirmDeleteId);
                  setConfirmDeleteId(null);
                }
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} selected item(s)?</DialogTitle>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await bulkDeleteSelected();
                setConfirmBulkOpen(false);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openNotes}
        onOpenChange={(v) => {
          setOpenNotes(v);
          if (!v) setNotesItem(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Details{notesItem ? ` ꕀ ${notesItem.title}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              rows={6}
              placeholder="Your thoughts…"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenNotes(false)}>
                Cancel
              </Button>
              <Button onClick={saveNotes}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </PageLayout>
  );
}
