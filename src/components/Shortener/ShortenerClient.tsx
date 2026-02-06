/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

"use client";
import {
  IconCopy,
  IconTrash,
  IconEdit,
  IconEyeOff,
  IconEye,
  IconLinkPlus,
  IconLoader,
  IconRefresh,
  IconAlertTriangle,
  IconTag,
  IconFilterSpark,
  IconShare,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useUserFeatures } from "@/hooks/use-user-features";
import { PaginationFooter } from "../Shared/PaginationFooter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import PageLayout from "../Common/PageLayout";
import FilterPanel from "@/components/Common/FilterPanel";
import SelectionBar from "@/components/Common/SelectionBar";
import { shareUrl } from "@/lib/api/helpers";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Checkbox } from "../ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import PublicBadge from "../Common/PublicBadge";
import FavoriteBadge from "../Common/FavoriteBadge";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { cn } from "@/lib/utils";
import { apiV1 } from "@/lib/api-path";
import CopyButton from "@/components/Common/CopyButton";
import ShareQrButton from "@/components/Common/ShareQrButton";
import { DBShortLink } from "@/types/schema";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCachedPagedList } from "@/hooks/use-cached-paged-list";
import TagInputWithSuggestions from "@/components/Common/TagInputWithSuggestions";
import ShortlinkTagsDialog from "@/components/Shortener/ShortlinkTagsDialog";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";

const shortenerUrl = (path = "") => apiV1(`/shorten${path}`);

type UTMParams = {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
};

const emptyUtm: UTMParams = {
  source: "",
  medium: "",
  campaign: "",
  term: "",
  content: "",
};

const buildUtmUrl = (baseUrl: string, utm: UTMParams) => {
  if (!baseUrl.trim()) return baseUrl;
  try {
    const url = new URL(baseUrl);
    if (utm.source) url.searchParams.set("utm_source", utm.source);
    if (utm.medium) url.searchParams.set("utm_medium", utm.medium);
    if (utm.campaign) url.searchParams.set("utm_campaign", utm.campaign);
    if (utm.term) url.searchParams.set("utm_term", utm.term);
    if (utm.content) url.searchParams.set("utm_content", utm.content);
    return url.toString();
  } catch {
    return baseUrl;
  }
};

const extractUtmParams = (baseUrl: string): UTMParams => {
  try {
    const url = new URL(baseUrl);
    return {
      source: url.searchParams.get("utm_source") ?? "",
      medium: url.searchParams.get("utm_medium") ?? "",
      campaign: url.searchParams.get("utm_campaign") ?? "",
      term: url.searchParams.get("utm_term") ?? "",
      content: url.searchParams.get("utm_content") ?? "",
    };
  } catch {
    return { ...emptyUtm };
  }
};

export default function ShortenerClient({
  currentUsername = "",
}: {
  currentUsername?: string;
}) {
  const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagColors, setTagColors] = useState<Record<string, string | null>>({});
  const [visibilityLoading, setVisibilityLoading] = useState<
    Record<string, boolean>
  >({});
  const [favoriteLoading, setFavoriteLoading] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);
  const seq = useRef(0);
  const { features, loading: featuresLoading } = useUserFeatures();
  const shortlinksEnabled = features.shortlinks?.isEnabled ?? true;
  const shortlinksDisabled = !shortlinksEnabled && !featuresLoading;
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQ = searchParams.get("q");
  const initialFav = searchParams.get("favorite");
  const initialPub = searchParams.get("public");
  const initialTagParam = searchParams.get("tag") || searchParams.get("tags");
  const didInitFromUrl = useRef(false);

  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;
    if (initialQ) setQ(initialQ);
    if (initialFav === "1") setShowFavoriteOnly(true);
    if (initialPub === "1") setShowPublicOnly(true);
    if (initialTagParam) {
      const parsed = initialTagParam
        .split(",")
        .map((t) => normalizeTagName(t))
        .filter(Boolean);
      if (parsed.length) setSelectedTags(parsed);
    }
  }, [initialQ, initialFav, initialPub, initialTagParam]);

  const debouncedQ = useDebouncedValue(q, 300);

  const cacheKey = useMemo(() => {
    const qKey = debouncedQ.trim().toLowerCase();
    const tagsKey = selectedTags.join(",");
    return `${qKey}|${tagsKey}|${showFavoriteOnly}|${showPublicOnly}|${pageSize}|${page}`;
  }, [
    debouncedQ,
    selectedTags,
    showFavoriteOnly,
    showPublicOnly,
    pageSize,
    page,
  ]);

  const fetchShortLinks = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("offset", String((page - 1) * pageSize));
    if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
    if (showFavoriteOnly) qs.set("favorite", "1");
    if (showPublicOnly) qs.set("public", "1");
    if (selectedTags.length) qs.set("tags", selectedTags.join(","));
    const res = await fetch(
      shortenerUrl(qs.toString() ? `?${qs.toString()}` : ""),
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return {
      items: json.data ?? [],
      total: Number(json.total || 0),
    };
  }, [
    pageSize,
    page,
    debouncedQ,
    showFavoriteOnly,
    showPublicOnly,
    selectedTags,
  ]);

  const loadShortlinkTags = useCallback(async () => {
    try {
      const res = await fetch(apiV1("/shortlink-tags"), { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        name: string;
        color?: string | null;
      }[];
      const names = data.map((t) => t.name);
      const colors: Record<string, string | null> = {};
      for (const item of data) {
        const key = normalizeTagName(item.name);
        if (key) colors[key] = item.color ?? null;
      }
      setAvailableTags(names);
      setTagColors((prev) => ({ ...prev, ...colors }));
    } catch {
      toast.error("Failed to load shortlink tags");
    }
  }, []);

  const { items, setItems, totalPages, listLoading, clearCache } =
    useCachedPagedList<DBShortLink>({
      cacheKey,
      page,
      pageSize,
      reloadTick,
      setPage,
      setReloadTick,
      fetcher: fetchShortLinks,
    });

  const {
    selectedIds,
    isSelected,
    toggleOne,
    togglePage,
    clear,
    count,
    performBulk,
  } = useBulkSelect();

  const selectedCount = count;
  const clearSelection = clear;
  const toggleAllOnPage = () => togglePage(paginatedItems.map((x) => x.id));

  useEffect(() => {
    setRefreshing(listLoading);
  }, [listLoading]);

  useEffect(() => {
    loadShortlinkTags();
  }, [loadShortlinkTags]);

  useEffect(() => {
    setPage(1);
    clearSelection();
  }, [
    showFavoriteOnly,
    showPublicOnly,
    selectedTags,
    debouncedQ,
    pageSize,
    clearSelection,
    setPage,
  ]);

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const toDelete = [...selectedIds];
    try {
      const { ok, fail } = await performBulk(toDelete, async (id) =>
        fetch(shortenerUrl(`/${id}`), { method: "DELETE" }),
      );
      if (fail.length) {
        toast.error(`Deleted ${ok}/${toDelete.length}.`, {
          description: fail[0]?.error || "Some deletions failed.",
        });
      } else {
        toast.success(`Deleted ${ok} link${ok === 1 ? "" : "s"}.`);
      }
    } finally {
      clearSelection();
      await refresh();
    }
  };

  const paginatedItems = items;

  const bulkSetVisibility = async (value: boolean) => {
    if (selectedIds.length === 0) return;
    const toUpdate = [...selectedIds];
    try {
      const { ok, fail } = await performBulk(toUpdate, async (id) =>
        fetch(shortenerUrl(`/${id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: value }),
        }),
      );
      if (fail.length) {
        toast.error(`Updated ${ok}/${toUpdate.length}.`, {
          description: fail[0]?.error || "Some updates failed.",
        });
      } else {
        toast.success(
          `${value ? "Made public" : "Made private"} ${ok} bookmark${
            ok === 1 ? "" : "s"
          }.`,
        );
      }
    } finally {
      clearSelection();
      await refresh();
    }
  };

  const bulkMakePublic = async () => bulkSetVisibility(true);
  const bulkMakePrivate = async () => bulkSetVisibility(false);

  const refresh = async () => {
    clearCache();
    setPage(1);
    const thisSeq = ++seq.current;
    setRefreshing(true);
    try {
      const sp = new URLSearchParams();
      if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
      if (selectedTags.length) sp.set("tags", selectedTags.join(","));
      if (showFavoriteOnly) sp.set("favorite", "1");
      if (showPublicOnly) sp.set("public", "1");
      router.replace(`/shortener${sp.toString() ? `?${sp.toString()}` : ""}`);
      setReloadTick((t) => t + 1);
    } catch {
      if (thisSeq === seq.current) toast.error("Failed to load");
    }
  };

  const fmtDate = (v: string | Date | null | undefined) => {
    if (!v) return "ꕀ";
    const d = typeof v === "string" ? new Date(v) : v;
    if (!(d instanceof Date) || isNaN(d.getTime())) return "ꕀ";
    return d.toLocaleString();
  };

  const displayUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname !== "/" ? u.pathname : "");
    } catch {
      return url;
    }
  };

  const patchItem = useCallback(
    (id: string, patch: Partial<DBShortLink>) => {
      setItems((prev) =>
        prev.flatMap((item) => {
          if (item.id !== id) return [item];
          const updated = { ...item, ...patch };
          if (showFavoriteOnly && updated.isFavorite === false) return [];
          if (showPublicOnly && updated.isPublic === false) return [];
          return [updated];
        }),
      );
    },
    [setItems, showFavoriteOnly, showPublicOnly],
  );

  const toggleFavorite = async (row: DBShortLink) => {
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      const res = await fetch(shortenerUrl(`/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !row.isFavorite }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to update favorite");
      toast.success(
        !row.isFavorite ? "Added to favorites" : "Removed from favorites",
      );
      patchItem(row.id, { isFavorite: !row.isFavorite });
    } catch (e) {
      toast.error((e as Error).message || "Failed to update favorite");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const toggleVisibility = async (row: DBShortLink) => {
    if (visibilityLoading[row.id]) return;
    setVisibilityLoading((prev) => ({ ...prev, [row.id]: true }));
    try {
      const res = await fetch(shortenerUrl(`/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !row.isPublic }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to update visibility");
      toast.success(`Link is now ${!row.isPublic ? "public" : "private"}`);
      patchItem(row.id, { isPublic: !row.isPublic });
    } catch (e) {
      toast.error((e as Error).message || "Failed to update visibility");
    } finally {
      setVisibilityLoading((prev) => ({ ...prev, [row.id]: false }));
    }
  };

  return (
    <PageLayout
      title="Short Links"
      subtitle="Create and share your short links"
      toolbar={
        <>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search short links..."
            className="w-full"
          />

          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters((v) => !v)}
            className="whitespace-nowrap"
            aria-expanded={showFilters}
            aria-controls="shortlinks-filters"
          >
            <IconFilterSpark />
          </Button>
          <Button
            variant={refreshing ? "ghost" : "outline"}
            onClick={refresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <IconLoader className="h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="h-4 w-4" />
            )}
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
          {currentUsername && !shortlinksDisabled && (
            <ShortlinkTagsDialog
              username={currentUsername}
              onChanged={() => {
                loadShortlinkTags();
                refresh();
              }}
            />
          )}
          <CreateShortLinkDialog
            onCreated={() => refresh()}
            availableTags={availableTags}
            tagColors={tagColors}
            disabled={shortlinksDisabled}
            disabledReason="Manage this in Settings → Features. If it was disabled by an admin, contact them."
          />
        </>
      }
    >
      {shortlinksDisabled ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Short links are disabled. You can manage this in Settings → Features.
          If it was disabled by an admin, contact them.
        </div>
      ) : null}
      {showFilters && (
        <FilterPanel id="shortlinks-filters">
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
            variant={showFavoriteOnly ? "default" : "outline"}
            onClick={() => setShowFavoriteOnly((prev) => !prev)}
          >
            {showFavoriteOnly ? "Showing Favorites" : "Show Favorites"}
          </Button>
          <Button
            variant={showPublicOnly ? "default" : "outline"}
            onClick={() => setShowPublicOnly((prev) => !prev)}
          >
            {showPublicOnly ? "Showing Public" : "Show Public"}
          </Button>
          <Select
            value={selectedTags[0] ?? ""}
            onValueChange={(value) => setSelectedTags(value ? [value] : [])}
          >
            <SelectTrigger className="rounded-md border text-sm min-w-50">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              {availableTags.map((t) => (
                <SelectItem key={t} value={t}>
                  {formatTagName(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedTags.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setSelectedTags([])}>
                Clear Tags
              </Button>
              {currentUsername && selectedTags.length === 1 && (
                <CopyButton
                  variant="outline"
                  successMessage="Copied tag list link"
                  getText={() =>
                    shareUrl(
                      "st",
                      `${encodeURIComponent(currentUsername)}/${encodeURIComponent(
                        selectedTags[0],
                      )}`,
                    )
                  }
                >
                  <IconShare className="h-4 w-4" />
                  <span>Share Tag List</span>
                </CopyButton>
              )}
            </>
          )}
        </FilterPanel>
      )}

      {listLoading ? (
        <ShortenerSkeleton count={pageSize} />
      ) : paginatedItems.length === 0 ? (
        <div className="text-sm text-muted-foreground">No short links yet.</div>
      ) : (
        <div className="p-4 bg-secondary rounded-lg border border-border">
          <SelectionBar
            count={selectedCount}
            summary={
              <>
                <strong>{selectedCount}</strong> selected out of {items.length}
              </>
            }
            className="mb-3"
          >
            <Button
              variant="outline"
              onClick={() => toggleAllOnPage()}
              disabled={paginatedItems.length === 0}
              size="sm"
            >
              Select Page ({paginatedItems.length})
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={bulkMakePublic}>
              <IconEye /> Make Public
            </Button>
            <Button variant="outline" size="sm" onClick={bulkMakePrivate}>
              <IconEyeOff /> Make Private
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  Remove Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selectedCount} selected link
                    {selectedCount === 1 ? "" : "s"}?
                  </AlertDialogTitle>
                  <p className="text-sm text-muted-foreground">
                    This action cannot be undone.
                  </p>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={bulkDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SelectionBar>

          <Table key={seq.current} className="overflow-hidden">
            <TableHeader>
              <TableRow className="text-muted-foreground">
                <TableHead className="">
                  <Checkbox
                    checked={
                      paginatedItems.length > 0 &&
                      paginatedItems.every((x) => isSelected(x.id))
                    }
                    onCheckedChange={() => toggleAllOnPage()}
                    aria-label="Select all on page"
                  />
                </TableHead>
                <TableHead className="w-2/12">Slug</TableHead>
                <TableHead className="w-3/12">Destination</TableHead>
                <TableHead className="w-1/12">Clicks</TableHead>
                <TableHead className="w-2/12">Visibility</TableHead>
                <TableHead className="w-2/12">Created</TableHead>
                <TableHead className="text-right w-2/12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((r, i) => (
                <TableRow
                  key={r.id ?? i}
                  className="hover:bg-muted/40 transition-colors"
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.slug}`}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-mono text-xs",
                      selectedCount > 0 && "cursor-pointer",
                    )}
                    onClick={
                      selectedCount > 0 ? () => toggleOne(r.id) : undefined
                    }
                  >
                    <div className="flex items-center gap-1">
                      <FavoriteBadge
                        isFavorite={r.isFavorite!}
                        toggleFavorite={() => toggleFavorite(r)}
                        loading={favoriteLoading}
                      />

                      <span className="truncate max-w-30">{r.slug}</span>
                    </div>
                  </TableCell>

                  <TableCell className="max-w-5">
                    <Link
                      href={r.originalUrl}
                      target="_blank"
                      className="text-primary underline underline-offset-2 break-all line-clamp-1"
                    >
                      {displayUrl(r.originalUrl)}
                    </Link>
                    {r.description ? (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        {r.description}
                      </div>
                    ) : null}
                    {Array.isArray(r.tags) && r.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {r.tags.map((t: string) => {
                          const key = normalizeTagName(t);
                          const styles = getBadgeColorStyles(tagColors?.[key]);
                          return (
                            <Badge
                              key={t}
                              variant="outline"
                              className={cn("text-[10px]", styles?.className)}
                              style={styles?.style}
                            >
                              <IconTag className="h-3 w-3" />
                              {formatTagName(t)}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </TableCell>

                  <TableCell
                    className="cursor-pointer"
                    onClick={() => {
                      if (r.clickCount === r.maxClicks && r.maxClicks) {
                        toast.warning("Max clicks reached", {
                          description:
                            "Your link has reached the maximum number of clicks.",
                        });
                      }
                    }}
                  >
                    <span className="inline-flex gap-1 items-center rounded-md border px-2 py-0.5 text-xs">
                      {r.clickCount ?? 0}
                      {r.clickCount === r.maxClicks && r.maxClicks && (
                        <IconAlertTriangle className="text-yellow-500 h-3 w-3" />
                      )}
                    </span>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PublicBadge
                        isPublic={r.isPublic!}
                        toggleVisibility={() => toggleVisibility(r)}
                        loading={!!visibilityLoading[r.id]}
                      />
                    </div>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {fmtDate(r.createdAt)}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EditShortLinkDialog
                        row={r}
                        onSaved={() => refresh()}
                        availableTags={availableTags}
                        tagColors={tagColors}
                      />

                      {r.isPublic && (
                        <CopyButton
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          successMessage="Copied share link"
                          getText={() => shareUrl("s", r.slug)}
                          aria-label="Copy link"
                        >
                          <IconCopy className="h-4 w-4" />
                        </CopyButton>
                      )}
                      {r.isPublic && (
                        <ShareQrButton
                          url={shareUrl("s", r.slug)}
                          label=""
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                        />
                      )}

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Short Link
                            </AlertDialogTitle>
                            <p>
                              Are you sure you want to delete this short link?
                            </p>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                const res = await fetch(
                                  shortenerUrl(`/${r.id}`),
                                  {
                                    method: "DELETE",
                                  },
                                );
                                if (!res.ok) {
                                  const j = await res.json().catch(() => ({}));
                                  toast.error(j?.error || "Delete failed");
                                } else {
                                  toast.success("Deleted");
                                  refresh();
                                }
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </PageLayout>
  );
}

function ShortenerSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="p-4 bg-secondary rounded-lg border border-border">
      <Table className="overflow-hidden">
        <TableHeader>
          <TableRow className="text-muted-foreground">
            <TableHead className="">
              <Skeleton className="h-6 w-6" />
            </TableHead>
            <TableHead className="w-2/12">Slug</TableHead>
            <TableHead className="w-3/12">Destination</TableHead>
            <TableHead className="w-1/12">Clicks</TableHead>
            <TableHead className="w-2/12">Visibility</TableHead>
            <TableHead className="w-2/12">Created</TableHead>
            <TableHead className="text-right w-2/12">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: count }).map((_, i) => (
            <TableRow key={i} className="hover:bg-muted/40 transition-colors">
              <TableCell>
                <Skeleton className="h-6 w-6" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-16" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-6 w-28" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CreateShortLinkDialog({
  onCreated,
  availableTags,
  tagColors,
  disabled,
  disabledReason,
}: {
  onCreated: () => void;
  availableTags: string[];
  tagColors?: Record<string, string | null>;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [originalUrl, setOriginalUrl] = useState("");
  const [description, setDescription] = useState("");
  const [maxClicks, setMaxClicks] = useState<number | "">("");
  const [maxViewsAction, setMaxViewsAction] = useState<
    "make_private" | "delete" | ""
  >("");
  const [expiresAt, setExpiresAt] = useState("");
  const [slug, setSlug] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [password, setPassword] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [utm, setUtm] = useState<UTMParams>({ ...emptyUtm });
  const { prefs, loading: prefsLoading } = useUserPreferences();

  useEffect(() => {
    if (prefsLoading) return;
    setIsPublic(prefs.defaultShortlinkVisibility === "public");
    setMaxClicks(
      typeof prefs.defaultShortlinkMaxClicks === "number"
        ? prefs.defaultShortlinkMaxClicks
        : "",
    );
    if (typeof prefs.defaultShortlinkExpireDays === "number") {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + prefs.defaultShortlinkExpireDays);
      setExpiresAt(nextDate.toISOString().slice(0, 10));
    } else {
      setExpiresAt("");
    }
    setSlug(prefs.defaultShortlinkSlugPrefix || "");
  }, [prefs, prefsLoading]);

  useEffect(() => {
    if (!originalUrl) return;
    setUtm((prev) => ({ ...prev, ...extractUtmParams(originalUrl) }));
  }, [originalUrl]);

  const save = async () => {
    setSaving(true);
    try {
      const tags = Array.from(
        new Set(
          tagsText
            .split(",")
            .map((t) => normalizeTagName(t))
            .filter(Boolean),
        ),
      );
      const res = await fetch(shortenerUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          originalUrl,
          description: description || null,
          maxClicks: maxClicks === "" ? undefined : Number(maxClicks),
          maxViewsAction: maxViewsAction || null,
          expiresAt: expiresAt || null,
          slug: slug || null,
          isFavorite,
          isPublic,
          password: password || null,
          tags: tags.length ? tags : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Create failed");
      toast.success("Short link created");
      setOpen(false);
      onCreated();
      setDescription("");
      setTagsText("");
      setMaxClicks(
        typeof prefs.defaultShortlinkMaxClicks === "number"
          ? prefs.defaultShortlinkMaxClicks
          : "",
      );
      if (typeof prefs.defaultShortlinkExpireDays === "number") {
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + prefs.defaultShortlinkExpireDays);
        setExpiresAt(nextDate.toISOString().slice(0, 10));
      } else {
        setExpiresAt("");
      }
      setSlug(prefs.defaultShortlinkSlugPrefix || "");
      setIsPublic(prefs.defaultShortlinkVisibility === "public");
      setPassword("");
      setMaxViewsAction("");
      setUtm({ ...emptyUtm });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          <IconLinkPlus className="h-4 w-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Bookmark</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[70vh] overflow-auto">
          <Label>URL to shorten</Label>
          <Input
            value={originalUrl}
            required
            onChange={(e) => setOriginalUrl(e.target.value)}
            placeholder="https://iconical.dev"
          />

          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-sm font-medium">UTM Builder</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={utm.source}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, source: e.target.value }))
                }
                placeholder="utm_source"
              />
              <Input
                value={utm.medium}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, medium: e.target.value }))
                }
                placeholder="utm_medium"
              />
              <Input
                value={utm.campaign}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, campaign: e.target.value }))
                }
                placeholder="utm_campaign"
              />
              <Input
                value={utm.term}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, term: e.target.value }))
                }
                placeholder="utm_term"
              />
              <Input
                value={utm.content}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="utm_content"
              />
            </div>
            <div className="grid items-center gap-2 overflow-hidden">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setOriginalUrl(buildUtmUrl(originalUrl, utm))}
                disabled={!originalUrl.trim()}
              >
                Apply UTM
              </Button>
              <span className="text-xs text-muted-foreground break-all">
                {originalUrl ? buildUtmUrl(originalUrl, utm) : ""}
              </span>
            </div>
          </div>

          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The best guy out there"
          />

          <Label>Tags</Label>
          <TagInputWithSuggestions
            value={tagsText}
            onChange={setTagsText}
            tagColors={tagColors}
            availableTags={availableTags}
          />

          <Label>Max Clicks</Label>
          <Input
            type="number"
            value={maxClicks}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "") {
                setMaxClicks("");
                setMaxViewsAction("");
              } else {
                const nextValue = Number(next);
                setMaxClicks(nextValue);
                if (nextValue <= 0) setMaxViewsAction("");
              }
            }}
            placeholder="Unlimited"
          />

          <Label>When max clicks reached</Label>
          <Select
            value={maxViewsAction || "none"}
            onValueChange={(value) =>
              setMaxViewsAction(
                value === "none" ? "" : (value as "make_private" | "delete"),
              )
            }
            disabled={maxClicks === "" || Number(maxClicks) <= 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="No action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No action</SelectItem>
              <SelectItem value="make_private">
                Make private (remove password)
              </SelectItem>
              <SelectItem value="delete">Delete item</SelectItem>
            </SelectContent>
          </Select>

          <Label>Expires At</Label>
          <Input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />

          <Label>Favorite</Label>
          <Switch checked={isFavorite} onCheckedChange={setIsFavorite} />

          <div className="flex flex-col justify-between gap-2">
            <Label>Public</Label>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            {isPublic && (
              <>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Optional"
                />
              </>
            )}
          </div>

          <Label>Custom Slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Leave empty to auto-generate"
          />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditShortLinkDialog({
  row,
  onSaved,
  availableTags,
  tagColors,
}: {
  row: DBShortLink;
  onSaved: () => void;
  availableTags: string[];
  tagColors?: Record<string, string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [originalUrl, setOriginalUrl] = useState<string>(row.originalUrl ?? "");
  const [description, setDescription] = useState<string>(row.description ?? "");
  const [slug, setSlug] = useState<string>(row.slug ?? "");
  const [maxClicks, setMaxClicks] = useState<number | "">(row.maxClicks ?? "");
  const [maxViewsAction, setMaxViewsAction] = useState<
    "make_private" | "delete" | ""
  >((row.maxViewsAction as "make_private" | "delete" | null) ?? "");
  const [expiresAt, setExpiresAt] = useState<string>(
    row.expiresAt
      ? typeof row.expiresAt === "string"
        ? row.expiresAt
        : (row.expiresAt as Date).toISOString()
      : "",
  );
  const [isFavorite, setIsFavorite] = useState<boolean>(
    row.isFavorite ?? false,
  );
  const [isPublic, setIsPublic] = useState<boolean>(row.isPublic ?? false);
  const [password, setPassword] = useState<string>("");
  const [tagsText, setTagsText] = useState<string>(row.tags?.join(", ") ?? "");
  const [utm, setUtm] = useState<UTMParams>(() =>
    extractUtmParams(row.originalUrl ?? ""),
  );

  useEffect(() => {
    (async () => {
      const res = await fetch(shortenerUrl(`/${row.id}`), {
        cache: "no-store",
      });
      if (!res.ok) return;
    })();
  }, [row.id]);

  useEffect(() => {
    if (!originalUrl) return;
    setUtm((prev) => ({ ...prev, ...extractUtmParams(originalUrl) }));
  }, [originalUrl]);

  const save = async () => {
    setSaving(true);
    try {
      const tags = Array.from(
        new Set(
          tagsText
            .split(",")
            .map((t) => normalizeTagName(t))
            .filter(Boolean),
        ),
      );
      const res = await fetch(shortenerUrl(`/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          originalUrl: originalUrl.trim(),
          description: description || null,
          maxClicks: maxClicks === "" ? undefined : Number(maxClicks),
          maxViewsAction: maxViewsAction || null,
          expiresAt: expiresAt || null,
          slug: slug || null,
          isFavorite,
          isPublic,
          password: password === "" ? undefined : password,
          tags: tags.length ? tags : undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Update failed");
      toast.success("Short Link updated");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removePassword = async () => {
    setSaving(true);
    try {
      const res = await fetch(shortenerUrl(`/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to remove password");
      toast.success("Password removed");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={(e) => {
            e.preventDefault();
            setOpen((prev) => !prev);
          }}
        >
          <IconEdit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Short Link</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[70vh] overflow-auto pr-1">
          <Label>Original URL</Label>
          <Input
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.target.value)}
          />

          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-sm font-medium">UTM Builder</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={utm.source}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, source: e.target.value }))
                }
                placeholder="utm_source"
              />
              <Input
                value={utm.medium}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, medium: e.target.value }))
                }
                placeholder="utm_medium"
              />
              <Input
                value={utm.campaign}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, campaign: e.target.value }))
                }
                placeholder="utm_campaign"
              />
              <Input
                value={utm.term}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, term: e.target.value }))
                }
                placeholder="utm_term"
              />
              <Input
                value={utm.content}
                onChange={(e) =>
                  setUtm((prev) => ({ ...prev, content: e.target.value }))
                }
                placeholder="utm_content"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setOriginalUrl(buildUtmUrl(originalUrl, utm))}
                disabled={!originalUrl.trim()}
              >
                Apply UTM
              </Button>
              <span className="text-xs text-muted-foreground truncate">
                {originalUrl ? buildUtmUrl(originalUrl, utm) : ""}
              </span>
            </div>
          </div>

          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Label>Tags</Label>
          <TagInputWithSuggestions
            value={tagsText}
            onChange={setTagsText}
            tagColors={tagColors}
            availableTags={availableTags}
          />

          <Label>Max clicks (optional)</Label>
          <Input
            type="number"
            min={0}
            value={maxClicks}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                setMaxClicks("");
                setMaxViewsAction("");
              } else {
                const nextValue = Math.max(0, Number(v));
                setMaxClicks(nextValue);
                if (nextValue <= 0) setMaxViewsAction("");
              }
            }}
            placeholder="e.g. 100"
          />

          <Label>When max clicks reached</Label>
          <Select
            value={maxViewsAction || "none"}
            onValueChange={(value) =>
              setMaxViewsAction(
                value === "none" ? "" : (value as "make_private" | "delete"),
              )
            }
            disabled={maxClicks === "" || Number(maxClicks) <= 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="No action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No action</SelectItem>
              <SelectItem value="make_private">
                Make private (remove password)
              </SelectItem>
              <SelectItem value="delete">Delete item</SelectItem>
            </SelectContent>
          </Select>

          <Label>Expires at (optional)</Label>
          <Input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />

          <Label>Favorite</Label>
          <Switch checked={isFavorite} onCheckedChange={setIsFavorite} />

          <div className="flex flex-col justify-between gap-2">
            <Label>Public</Label>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            {isPublic && (
              <div className="flex flex-col gap-2">
                <Label>Set Password</Label>
                <div className="flex gap-1">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave empty to not change"
                  />
                  <Button variant="outline" onClick={removePassword}>
                    Remove
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Label>Custom Slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Leave empty to auto-generate"
          />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
