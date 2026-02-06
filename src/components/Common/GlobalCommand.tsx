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

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  IconBookmarkPlus,
  IconCode,
  IconCopy,
  IconHash,
  IconLoader2,
  IconNote,
  IconPin,
  IconPinFilled,
  IconStar,
  IconStarFilled,
  IconUpload,
} from "@tabler/icons-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { apiV1 } from "@/lib/api-path";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type SearchItem = {
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  slug?: string;
  type: string;
  isFavorite?: boolean;
  sections?: { id: string; title: string; href: string }[];
};

type SearchGroup = {
  label: string;
  items: SearchItem[];
};

function useDebounced<T>(value: T, delay = 200) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const RECENT_KEY = "globalSearch.recent";
const RECENT_ITEMS_KEY = "globalSearch.recentItems";
const ANALYTICS_KEY = "globalSearch.analytics";
const PINNED_KEY = "globalSearch.pins";
const MAX_RECENTS = 6;
const MAX_RECENT_ITEMS = 12;
const MIN_QUERY_LENGTH = 2;

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((q) => typeof q === "string" && q.trim())
      : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  if (typeof window === "undefined") return;
  const normalized = query.trim();
  if (!normalized) return;
  const prev = loadRecents();
  const next = [normalized, ...prev.filter((q) => q !== normalized)].slice(
    0,
    MAX_RECENTS,
  );
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

function clearRecents() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {}
}

function loadRecentItems(): SearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_ITEMS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SearchItem[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((it) => it?.id && it?.title && it?.type)
      : [];
  } catch {
    return [];
  }
}

function saveRecentItem(item: SearchItem) {
  if (typeof window === "undefined") return;
  try {
    const prev = loadRecentItems();
    const key = `${item.type}:${item.id}`;
    const next = [
      item,
      ...prev.filter((it) => `${it.type}:${it.id}` !== key),
    ].slice(0, MAX_RECENT_ITEMS);
    window.localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(next));
  } catch {}
}

function loadAnalytics(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ANALYTICS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveAnalytics(term: string) {
  if (typeof window === "undefined") return;
  const normalized = term.trim().toLowerCase();
  if (!normalized) return;
  try {
    const prev = loadAnalytics();
    const next = {
      ...prev,
      [normalized]: (prev[normalized] || 0) + 1,
    };
    window.localStorage.setItem(ANALYTICS_KEY, JSON.stringify(next));
  } catch {}
}

function loadPins(): Record<string, SearchItem> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PINNED_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, SearchItem>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function savePins(next: Record<string, SearchItem>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  } catch {}
}

function normalizeTypeToken(raw: string) {
  const token = raw.toLowerCase();
  if (token.startsWith("note")) return "note";
  if (token.startsWith("file")) return "file";
  if (token.startsWith("recipe")) return "recipe";
  if (token.startsWith("snippet")) return "snippet";
  if (token.startsWith("bookmark")) return "bookmark";
  return "";
}

function parseQuery(raw: string) {
  const tokens: string[] = [];
  const cleaned = raw
    .replace(/\btype:([\w-]+)/gi, (_match, token) => {
      const normalized = normalizeTypeToken(token);
      if (normalized) tokens.push(normalized);
      return "";
    })
    .replace(/\s+/g, " ")
    .trim();
  return { query: cleaned, tokens };
}

function getMatchRanges(text: string, query: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return ranges;
  const lower = text.toLowerCase();
  words.forEach((word) => {
    let idx = 0;
    while (idx < lower.length) {
      const found = lower.indexOf(word, idx);
      if (found === -1) break;
      ranges.push({ start: found, end: found + word.length });
      idx = found + word.length;
    }
  });
  return ranges.sort((a, b) => a.start - b.start);
}

function getFuzzyRanges(text: string, query: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return ranges;
  let idx = 0;
  for (let i = 0; i < q.length; i += 1) {
    const found = lower.indexOf(q[i], idx);
    if (found === -1) return [];
    ranges.push({ start: found, end: found + 1 });
    idx = found + 1;
  }
  return ranges;
}

function mergeRanges(ranges: Array<{ start: number; end: number }>) {
  if (!ranges.length) return [];
  const merged: Array<{ start: number; end: number }> = [ranges[0]];
  for (let i = 1; i < ranges.length; i += 1) {
    const last = merged[merged.length - 1];
    const next = ranges[i];
    if (next.start <= last.end) {
      last.end = Math.max(last.end, next.end);
    } else {
      merged.push({ ...next });
    }
  }
  return merged;
}

function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const exactRanges = getMatchRanges(text, q);
  const ranges = exactRanges.length
    ? mergeRanges(exactRanges)
    : mergeRanges(getFuzzyRanges(text, q));
  if (!ranges.length) return text;
  const nodes: React.ReactNode[] = [];
  let lastIdx = 0;
  ranges.forEach((range, idx) => {
    if (range.start > lastIdx) {
      nodes.push(
        <span key={`text-${idx}-${lastIdx}`}>
          {text.slice(lastIdx, range.start)}
        </span>,
      );
    }
    nodes.push(
      <mark
        key={`mark-${idx}-${range.start}`}
        className="rounded bg-primary px-1 py-0.5 text-primary-foreground"
      >
        {text.slice(range.start, range.end)}
      </mark>,
    );
    lastIdx = range.end;
  });
  if (lastIdx < text.length) {
    nodes.push(<span key={`tail-${lastIdx}`}>{text.slice(lastIdx)}</span>);
  }
  return nodes;
}

export default function GlobalCommand() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const { query: cleanedQuery, tokens: typeTokens } = React.useMemo(
    () => parseQuery(q),
    [q],
  );
  const debouncedQ = useDebounced(cleanedQuery, 150);
  const [loading, setLoading] = React.useState(false);
  const [groups, setGroups] = React.useState<SearchGroup[]>([]);
  const [typeFilters, setTypeFilters] = React.useState<string[]>([]);
  const [recents, setRecents] = React.useState<string[]>([]);
  const [recentItems, setRecentItems] = React.useState<SearchItem[]>([]);
  const [analytics, setAnalytics] = React.useState<Record<string, number>>({});
  const [favoriteOverrides, setFavoriteOverrides] = React.useState<
    Record<string, boolean>
  >({});
  const [actionLoading, setActionLoading] = React.useState<
    Record<string, boolean>
  >({});
  const [typing, setTyping] = React.useState(false);
  const [pins, setPins] = React.useState<Record<string, SearchItem>>({});
  const abortRef = React.useRef<AbortController | null>(null);
  const cacheRef = React.useRef(
    new Map<string, { groups: SearchGroup[]; ts: number }>(),
  );
  const CACHE_TTL_MS = 30_000;

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      const metaK = e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey);
      if (metaK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (isEditable) return;
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setRecents(loadRecents());
    setRecentItems(loadRecentItems());
    setAnalytics(loadAnalytics());
    setPins(loadPins());
  }, [open]);

  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isInput) return;
      const text = e.clipboardData?.getData("text")?.trim();
      if (!text) return;
      setOpen(true);
      setQ(text);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (!q.trim()) {
      setTyping(false);
      return;
    }
    setTyping(true);
    const t = setTimeout(() => setTyping(false), 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const filterOptions = React.useMemo(
    () =>
      groups
        .map((g) => ({
          label: g.label,
          type: g.items[0]?.type || g.label.toLowerCase(),
        }))
        .filter((opt) => opt.type),
    [groups],
  );

  const activeTypes = typeTokens.length ? typeTokens : typeFilters;

  const filteredGroups = React.useMemo(() => {
    if (!activeTypes.length) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => activeTypes.includes(it.type)),
      }))
      .filter((g) => g.items.length);
  }, [groups, activeTypes]);

  React.useEffect(() => {
    if (!open) return;
    const query = debouncedQ?.trim();
    if (!query || query.length < MIN_QUERY_LENGTH) {
      setGroups([]);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(query);
    const isFresh = cached && Date.now() - cached.ts < CACHE_TTL_MS;
    if (cached) setGroups(cached.groups);
    if (isFresh) {
      setLoading(false);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(!cached);
    fetch(apiV1(`/search?q=${encodeURIComponent(query)}`), {
      signal: ac.signal,
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error((await r.json())?.message || "Search failed");
        return r.json();
      })
      .then((json) => {
        const nextGroups = json.groups || [];
        cacheRef.current.set(query, { groups: nextGroups, ts: Date.now() });
        setGroups(nextGroups);
        saveRecent(query);
        saveAnalytics(query);
        setRecents(loadRecents());
        setAnalytics(loadAnalytics());
      })
      .catch((err) => {
        if (err.name !== "AbortError") toast.error("global search error");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [debouncedQ, open]);

  function go(item: SearchItem) {
    if (item.href) {
      router.push(item.href);
      setOpen(false);
      saveRecentItem(item);
      setRecentItems(loadRecentItems());
    } else {
      setQ(item.title);
    }
  }

  const togglePin = (item: SearchItem) => {
    const key = `${item.type}:${item.id}`;
    setActionLoading((prev) => ({ ...prev, [`pin:${key}`]: true }));
    setPins((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = item;
      }
      savePins(next);
      return next;
    });
    setTimeout(
      () => setActionLoading((prev) => ({ ...prev, [`pin:${key}`]: false })),
      350,
    );
  };

  const getIsFavorite = (item: SearchItem) => {
    const key = `${item.type}:${item.id}`;
    if (key in favoriteOverrides) return favoriteOverrides[key];
    return Boolean(item.isFavorite);
  };

  const toggleFavorite = async (item: SearchItem) => {
    const nextValue = !getIsFavorite(item);
    const key = `${item.type}:${item.id}`;
    setActionLoading((prev) => ({ ...prev, [`fav:${key}`]: true }));
    setFavoriteOverrides((prev) => ({ ...prev, [key]: nextValue }));
    try {
      if (item.type === "file") {
        if (!item.slug) throw new Error("Missing file slug");
        const res = await fetch(apiV1(`/files/${item.slug}/favorite`), {
          method: "PATCH",
        });
        if (!res.ok) throw new Error("Failed to update favorite");
      } else {
        const res = await fetch(apiV1(`/${item.type}s/${item.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFavorite: nextValue }),
        });
        if (!res.ok) throw new Error("Failed to update favorite");
      }
    } catch {
      setFavoriteOverrides((prev) => ({ ...prev, [key]: !nextValue }));
      toast.error("Failed to update favorite");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`fav:${key}`]: false }));
    }
  };

  const copyLink = async (item: SearchItem) => {
    if (!item.href) return;
    try {
      const url = new URL(item.href, window.location.origin).toString();
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const recentItemsByType = React.useMemo(() => {
    const grouped: Record<string, SearchItem[]> = {};
    recentItems.forEach((item) => {
      grouped[item.type] = grouped[item.type] || [];
      grouped[item.type].push(item);
    });
    return grouped;
  }, [recentItems]);

  const popularSearches = React.useMemo(() => {
    return Object.entries(analytics)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([term]) => term);
  }, [analytics]);

  const toggleTypeFilter = (type: string) => {
    if (typeTokens.length) {
      const token = `type:${type}`;
      const regex = new RegExp(`\\btype:${type}s?\\b`, "i");
      const next = regex.test(q)
        ? q.replace(regex, " ").replace(/\s+/g, " ").trim()
        : `${q} ${token}`.trim();
      setQ(next);
      return;
    }
    setTypeFilters((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      className="max-w-180 border-0 bg-background/95 shadow-2xl backdrop-blur-xl"
    >
      <CommandInput
        value={q}
        onValueChange={setQ}
        placeholder="Search files, notes, recipes… (⌘K)"
        autoFocus
        className={cn((loading || typing) && "animate-pulse")}
      />
      <CommandList className="max-h-[60vh] px-2 pb-2">
        <CommandEmpty>
          {loading
            ? "Searching…"
            : q && q.length >= MIN_QUERY_LENGTH
              ? "No results"
              : "Type at least 2 characters"}
        </CommandEmpty>

        {!q && (
          <CommandGroup heading="Quick add">
            <CommandItem
              value="Upload file"
              onSelect={() => {
                router.push("/upload");
                setOpen(false);
              }}
            >
              <span className="truncate w-full flex gap-2 items-center">
                <IconUpload />
                Upload a file
              </span>
            </CommandItem>
            <CommandItem
              value="Quick add note"
              onSelect={() => {
                router.push("/notes?new=1");
                setOpen(false);
              }}
            >
              <span className="truncate w-full flex gap-2 items-center">
                <IconNote />
                Write a note
              </span>
            </CommandItem>
            <CommandItem
              value="Quick add snippet"
              onSelect={() => {
                router.push("/snippets?new=1");
                setOpen(false);
              }}
            >
              <span className="truncate w-full flex gap-2 items-center">
                <IconCode />
                Save a snippet
              </span>
            </CommandItem>
            <CommandItem
              value="Quick add bookmark"
              onSelect={() => {
                router.push("/bookmarks?new=1");
                setOpen(false);
              }}
            >
              <span className="truncate w-full flex gap-2 items-center">
                <IconBookmarkPlus />
                Add a bookmark
              </span>
            </CommandItem>
          </CommandGroup>
        )}

        {(loading || typing) && cleanedQuery.length >= 1 && (
          <div className="px-2 pt-2">
            <div className="h-1 w-full rounded-full bg-linear-to-r from-muted via-primary/40 to-muted animate-pulse" />
            <div className="mt-2 space-y-2">
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
            </div>
          </div>
        )}

        {filteredGroups.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pt-2">
            <button
              type="button"
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition",
                activeTypes.length === 0
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
              onClick={() => {
                if (typeTokens.length) {
                  setQ(
                    q
                      .replace(/\btype:[\w-]+\b/gi, " ")
                      .replace(/\s+/g, " ")
                      .trim(),
                  );
                } else {
                  setTypeFilters([]);
                }
              }}
              aria-pressed={activeTypes.length === 0}
            >
              All
            </button>
            {filterOptions.map((opt) => {
              const active = activeTypes.includes(opt.type);
              return (
                <button
                  key={`filter:${opt.type}`}
                  type="button"
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                  onClick={() => toggleTypeFilter(opt.type)}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {!q && popularSearches.length > 0 && (
          <CommandGroup heading="Popular searches">
            {popularSearches.map((term) => (
              <CommandItem
                key={`popular:${term}`}
                value={term}
                onSelect={() => setQ(term)}
              >
                <span className="truncate w-full">{term}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!q && recents.length > 0 && (
          <>
            <div className="flex items-center justify-between px-2 pt-2 text-xs text-muted-foreground">
              <span>Recent searches</span>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  clearRecents();
                  setRecents([]);
                }}
              >
                Clear
              </button>
            </div>
            <CommandGroup>
              {recents.map((term) => (
                <CommandItem
                  key={`recent:${term}`}
                  value={term}
                  onSelect={() => setQ(term)}
                >
                  <span className="truncate w-full">{term}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!q && Object.keys(recentItemsByType).length > 0 && (
          <>
            {Object.entries(recentItemsByType).map(([type, items]) => (
              <CommandGroup
                key={`recent-items:${type}`}
                heading={`Recent ${type}${items.length > 1 ? "s" : ""}`}
              >
                {items.map((it) => (
                  <CommandItem
                    key={`recent-item:${type}:${it.id}`}
                    value={`${it.title} ${it.subtitle ?? ""}`.trim()}
                    onSelect={() => go(it)}
                    className="items-start gap-1 py-2"
                  >
                    <div className="flex w-full items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {highlight(it.title, cleanedQuery)}
                        </div>
                        {it.subtitle ? (
                          <div className="text-xs text-muted-foreground truncate">
                            {highlight(it.subtitle, cleanedQuery)}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {it.type}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </>
        )}

        {filteredGroups.map((g) =>
          g.items.length ? (
            <CommandGroup
              key={g.label}
              heading={`${g.label} · ${g.items.length}`}
            >
              {g.items.map((it) => (
                <CommandItem
                  key={`${g.label}:${it.id}`}
                  value={`${it.title} ${it.subtitle ?? ""}`.trim()}
                  onSelect={() => go(it)}
                  className="items-start gap-1 py-2"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {highlight(it.title, cleanedQuery)}
                      </div>
                      {it.subtitle ? (
                        <div className="text-xs text-muted-foreground truncate">
                          {highlight(it.subtitle, cleanedQuery)}
                        </div>
                      ) : null}
                      {it.sections?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {it.sections.map((section) => (
                            <button
                              key={`${it.id}-section-${section.id}`}
                              type="button"
                              className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.stopPropagation();
                                go({ ...it, href: section.href });
                              }}
                            >
                              <IconHash className="h-3 w-3" />
                              <span className="truncate max-w-35">
                                {section.title}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(it);
                        }}
                        aria-label="Pin"
                      >
                        {actionLoading[`pin:${it.type}:${it.id}`] ? (
                          <IconLoader2 className="h-4 w-4 animate-spin" />
                        ) : pins[`${it.type}:${it.id}`] ? (
                          <IconPinFilled className="h-4 w-4" />
                        ) : (
                          <IconPin className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(it);
                        }}
                        aria-label="Favorite"
                      >
                        {actionLoading[`fav:${it.type}:${it.id}`] ? (
                          <IconLoader2 className="h-4 w-4 animate-spin" />
                        ) : getIsFavorite(it) ? (
                          <IconStarFilled className="h-4 w-4" />
                        ) : (
                          <IconStar className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyLink(it);
                        }}
                        aria-label="Copy link"
                      >
                        <IconCopy className="h-4 w-4" />
                      </button>
                      <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {it.type}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null,
        )}

        {!!groups.length && <CommandSeparator className="mt-1" />}
      </CommandList>
    </CommandDialog>
  );
}
