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
  IconBrightnessAutoFilled,
  IconSearch,
  IconPlus,
  IconCirclesRelation,
  IconLanguageHiragana,
  IconTimeDuration0,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type ImportItem = {
  provider: "anilist";
  providerId: string;
  title?: string;
  titleEnglish?: string | null;
  titleRomaji?: string | null;
  mediaType: "anime";
  posterPath?: string | null;
  year?: number | null;
  progress?: number | null;
};

export default function ImportWatchlist() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkNeeded, setLinkNeeded] = useState(false);
  const [anilistLinked, setAnilistLinked] = useState(false);
  const linkNeededNotifiedRef = useRef(false);
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addingProcessed, setAddingProcessed] = useState(0);
  const [addingTotal, setAddingTotal] = useState(0);
  const [titlePref, setTitlePref] = useState<"english" | "romaji">("romaji");
  const [hideLinking, setHideLinking] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((i) => {
      const s = (
        i.titleEnglish ??
        i.titleRomaji ??
        i.title ??
        ""
      ).toLowerCase();
      return s.includes(t);
    });
  }, [items, q]);

  const uniqueSelectedCount = useMemo(() => {
    const seen = new Set<string>();
    for (const i of filtered) {
      const key = `${i.provider}:${i.providerId}`;
      if (selected.has(key)) seen.add(key);
    }
    return seen.size;
  }, [filtered, selected]);
  const pageSize = 12;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [q, items]);

  useEffect(() => {
    if (!open) linkNeededNotifiedRef.current = false;
  }, [open]);

  useEffect(() => {
    if (anilistLinked) linkNeededNotifiedRef.current = false;
  }, [anilistLinked]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function fetchAniList() {
    if (!username.trim()) {
      toast.error("Enter AniList username");
      return;
    }
    setLinkNeeded(false);
    setAnilistLinked(false);
    setLoading(true);
    try {
      const res = await fetch(
        apiV1(
          `/watch/import/anilist?user=${encodeURIComponent(username.trim())}`,
        ),
        { cache: "no-store" },
      );
      const json = await res.json();
      if (res.ok) {
        setItems((json.items as ImportItem[]) || []);
        setSelected(new Set());
        setPage(1);
      } else {
        toast.error("AniList fetch failed", { description: json.error || "" });
      }
    } catch (e: unknown) {
      toast.error("AniList fetch failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }

  const fetchAniListLinked = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiV1("/watch/import/anilist"), {
        cache: "no-store",
      });
      const json = await res.json();
      if (res.status === 401) {
        setLinkNeeded(true);
        setAnilistLinked(false);
        if (!linkNeededNotifiedRef.current) {
          linkNeededNotifiedRef.current = true;
          toast.error("AniList not linked", {
            description: json.error || "Link your AniList account to continue.",
          });
        }
        return;
      }
      if (res.ok) {
        setItems((json.items as ImportItem[]) || []);
        setSelected(new Set());
        setPage(1);
        setLinkNeeded(false);
        setAnilistLinked(true);
      } else {
        toast.error("AniList fetch failed", { description: json.error || "" });
      }
    } catch (e: unknown) {
      toast.error("AniList fetch failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  function toggle(key: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) {
        n.delete(key);
      } else {
        n.add(key);
      }
      return n;
    });
  }

  async function addSelected() {
    const seen = new Set<string>();
    const payload: {
      provider?: string;
      mediaType: "movie" | "tv" | "anime";
      providerId: string;
      title: string;
      posterPath?: string | null;
      year?: number | null;
      progress?: number | null;
    }[] = [];

    for (const r of filtered) {
      const key = `${r.provider}:${r.providerId}`;
      if (!selected.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      const chosenTitle =
        titlePref === "english"
          ? (r.titleEnglish ?? r.titleRomaji ?? r.title ?? "Untitled")
          : (r.titleRomaji ?? r.titleEnglish ?? r.title ?? "Untitled");

      payload.push({
        provider: r.provider,
        mediaType: r.mediaType,
        providerId: r.providerId,
        title: chosenTitle,
        posterPath: r.posterPath ?? null,
        year: r.year ?? null,
        progress: r.progress ?? null,
      });
    }

    if (payload.length === 0) return;

    const BATCH_SIZE = 25;
    const chunks: (typeof payload)[] = [];
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      chunks.push(payload.slice(i, i + BATCH_SIZE));
    }

    setAdding(true);
    setAddingTotal(payload.length);
    setAddingProcessed(0);

    let okTotal = 0;
    let failTotal = 0;

    try {
      for (const chunk of chunks) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        try {
          const res = await fetch(apiV1("/watch/import/bulk"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: chunk }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const j = await res.json().catch(() => ({}));
          if (res.ok) {
            okTotal += j.ok ?? 0;
            failTotal += j.fail ?? 0;
          } else {
            failTotal += chunk.length;
          }
        } catch (e) {
          toast.error("Import failed", {
            description: e instanceof Error ? e.message : String(e),
          });
          failTotal += chunk.length;
        } finally {
          setAddingProcessed((p) => p + chunk.length);
        }
      }

      if (okTotal > 0) {
        toast.success(`Imported ${okTotal} item(s)`);
      }
      if (failTotal > 0) {
        toast.error(`${failTotal} item(s) failed to import`);
      }

      setOpen(false);
      setSelected(new Set());
    } finally {
      setAdding(false);
      setAddingProcessed(0);
      setAddingTotal(0);
    }
  }

  const startAniListLink = useCallback(() => {
    setLinking(true);
    const w = 700,
      h = 760;
    const y = (window.top?.outerHeight || 800 - h) / 2;
    const x = (window.top?.outerWidth || 1200 - w) / 2;
    window.open(
      apiV1("/watch/import/anilist/start"),
      "anilist_link",
      `width=${w},height=${h},left=${x},top=${y}`,
    );
  }, []);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (!ev?.data || ev.origin !== window.location.origin) return;
      if (ev.data.type === "anilistLinked") {
        setLinking(false);
        if (ev.data.success) {
          setAnilistLinked(true);
          void fetchAniListLinked();
        }
      }
    }

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [fetchAniListLinked]);

  useEffect(() => {
    if (!open) return;
    if (items.length > 0 || loading) return;
    if (!username.trim()) {
      void fetchAniListLinked();
    }
  }, [open, items.length, loading, username, fetchAniListLinked]);

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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">AniList</h3>
          <p className="text-xs text-muted-foreground">
            Import your anime watchlist using your AniList username.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSync} disabled={syncing} variant="secondary">
            {syncing ? "Syncing AniList..." : "Sync AniList"}
            <IconTimeDuration0 />
          </Button>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Import from AniList
            <IconBrightnessAutoFilled />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[90svh] overflow-hidden flex flex-col">
          <DialogHeader className="space-y-1 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DialogTitle>Import from AniList</DialogTitle>
              <div className="flex items-center gap-2 mr-3">
                {anilistLinked && !linkNeeded && (
                  <Badge variant="default">Linked</Badge>
                )}
                <Badge variant="secondary">
                  {filtered.length} result{filtered.length === 1 ? "" : "s"}
                </Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Fetch your list, then search, select, and import in bulk.
            </p>

            {linkNeeded && (
              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Link AniList to import your private list without a username.
              </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="flex items-center gap-2 w-full md:max-w-md">
                <div className="relative w-full">
                  <span className="absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                    <IconSearch />
                  </span>
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search results…"
                    className="pl-10"
                  />
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      linkNeeded
                        ? "destructive"
                        : titlePref === "english"
                          ? "default"
                          : "outline"
                    }
                    onClick={() =>
                      setTitlePref(
                        titlePref === "english" ? "romaji" : "english",
                      )
                    }
                    title="Toggle title preference"
                  >
                    <IconLanguageHiragana />
                  </Button>

                  <Button
                    variant={!hideLinking ? "default" : "outline"}
                    onClick={() => setHideLinking((prev) => !prev)}
                  >
                    <IconCirclesRelation />
                  </Button>

                  <Button
                    onClick={addSelected}
                    disabled={uniqueSelectedCount === 0 || adding}
                    aria-busy={adding}
                  >
                    {adding ? (
                      `Adding (${addingProcessed}/${addingTotal})`
                    ) : (
                      <IconPlus />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {adding && (
              <div className="mt-2">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${Math.round((addingProcessed / Math.max(addingTotal, 1)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Processing {addingProcessed} of {addingTotal}
                </div>
              </div>
            )}

            {!hideLinking && (
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-secondary p-1 rounded-md">
                <div className="flex items-center gap-2 w-full md:max-w-sm">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="AniList username"
                  />
                  <Button onClick={fetchAniList} disabled={loading}>
                    {loading ? "Loading…" : "Fetch"}
                  </Button>
                </div>
                <div className="flex items-center gap-2 w-full md:max-w-sm">
                  <Button
                    variant="outline"
                    onClick={fetchAniListLinked}
                    disabled={loading}
                  >
                    {anilistLinked ? "Refresh my AniList" : "Import my AniList"}
                  </Button>
                  {!anilistLinked && (
                    <Button
                      variant="outline"
                      onClick={startAniListLink}
                      disabled={linking}
                    >
                      {linking ? "Linking…" : "Link AniList"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {selected.size > 0 && (
              <div className="flex items-center gap-2 bg-secondary p-1 rounded-md">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(
                      new Set(
                        pagedItems.map((i) => `${i.provider}:${i.providerId}`),
                      ),
                    );
                  }}
                >
                  Select page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(
                      new Set(
                        filtered.map((i) => `${i.provider}:${i.providerId}`),
                      ),
                    );
                  }}
                >
                  Select all
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelected(new Set());
                  }}
                >
                  Clear
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Page {page} of {totalPages}
              </span>
              <span>Selected {selected.size}</span>
            </div>
          </DialogHeader>

          <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="border rounded-lg overflow-hidden bg-card"
                  >
                    <Skeleton className="h-44 w-full" />
                    <div className="p-3 space-y-2">
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
                {pagedItems.map((r) => {
                  const key = `${r.provider}:${r.providerId}`;
                  const picked = selected.has(key);
                  return (
                    <div
                      key={key}
                      className={`border rounded-lg overflow-hidden bg-card cursor-pointer transition-shadow hover:shadow-md ${
                        picked ? "border-2 border-primary" : ""
                      }`}
                      onClick={() => toggle(key)}
                    >
                      {r.posterPath && (
                        <Image
                          src={r.posterPath}
                          alt={r.title || "Poster"}
                          width={300}
                          height={450}
                          className="w-full h-44 object-cover"
                        />
                      )}
                      <div className="p-3 space-y-1">
                        <div className="text-sm font-medium leading-tight line-clamp-2">
                          {titlePref === "english"
                            ? (r.titleEnglish ?? r.titleRomaji ?? r.title)
                            : (r.titleRomaji ?? r.titleEnglish ?? r.title)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Anime{r.year ? ` • ${r.year}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
