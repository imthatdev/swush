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
  IconBookmarkPlus,
  IconCopy,
  IconTrash,
  IconEdit,
  IconEyeOff,
  IconEye,
  IconAdjustments,
  IconLoader,
  IconRefresh,
  IconShare,
  IconTag,
  IconPin,
  IconPinFilled,
  IconFilterSpark,
  IconDownload,
  IconUpload,
  IconArchive,
  IconRss,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { PaginationFooter } from "../Shared/PaginationFooter";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useUserFeatures } from "@/hooks/use-user-features";
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
import { MaxViewsFields } from "@/components/Common/MaxViewsFields";
import { shareUrl } from "@/lib/api/helpers";
import CopyButton from "@/components/Common/CopyButton";
import ShareQrButton from "@/components/Common/ShareQrButton";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import PublicBadge from "../Common/PublicBadge";
import FavoriteBadge from "../Common/FavoriteBadge";
import { Skeleton } from "../ui/skeleton";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { Checkbox } from "../ui/checkbox";
import Image from "next/image";
import { Badge } from "../ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiV1 } from "@/lib/api-path";
import { DBBookmark } from "@/types/schema";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useCachedPagedList } from "@/hooks/use-cached-paged-list";
import { useLocalStorageString } from "@/hooks/use-local-storage";
import TagInputWithSuggestions from "@/components/Common/TagInputWithSuggestions";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";
import BookmarkTagsDialog from "@/components/Bookmarks/BookmarkTagsDialog";
import { Separator } from "../ui/separator";
import { HelpTip } from "../Admin/Docs/HelpTip";

const bookmarksUrl = (path = "") => apiV1(`/bookmarks${path}`);
const bookmarkRssFeedsUrl = (path = "") => apiV1(`/bookmark-rss-feeds${path}`);

function parseFileNameFromDisposition(
  contentDisposition: string | null,
  fallback: string,
) {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallback;
    }
  }
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || fallback;
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 2500);
}

function openSnapshotHtmlInNewTab(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

type WaybackAvailabilityResponse = {
  archived_snapshots?: {
    closest?: {
      available?: boolean;
      url?: string | null;
    };
  };
};

async function fetchWaybackSnapshotUrl(url: string) {
  try {
    const response = await fetch(
      `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
      {
        cache: "no-store",
      },
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as WaybackAvailabilityResponse;
    const closest = payload.archived_snapshots?.closest;
    if (closest?.available && typeof closest.url === "string") {
      const snapshotUrl = closest.url.trim();
      return snapshotUrl ? snapshotUrl : null;
    }
    return null;
  } catch {
    return null;
  }
}

function getWaybackCalendarUrl(url: string) {
  return `https://web.archive.org/web/*/${encodeURIComponent(url)}`;
}

type BookmarkArchiveData = {
  archiveTitle: string | null;
  archiveExcerpt: string | null;
  archiveByline: string | null;
  archiveSiteName: string | null;
  archiveLang: string | null;
  archiveText: string | null;
  archiveHtml: string | null;
  archivedAt: string | null;
};

function escapeSnapshotText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getArchiveStringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function getArchiveDateValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function getBookmarkArchiveData(row: DBBookmark): BookmarkArchiveData {
  const record = row as unknown as Record<string, unknown>;

  return {
    archiveTitle: getArchiveStringValue(record, "archiveTitle"),
    archiveExcerpt: getArchiveStringValue(record, "archiveExcerpt"),
    archiveByline: getArchiveStringValue(record, "archiveByline"),
    archiveSiteName: getArchiveStringValue(record, "archiveSiteName"),
    archiveLang: getArchiveStringValue(record, "archiveLang"),
    archiveText: getArchiveStringValue(record, "archiveText"),
    archiveHtml: getArchiveStringValue(record, "archiveHtml"),
    archivedAt: getArchiveDateValue(record, "archivedAt"),
  };
}

function formatArchiveDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

function buildLocalSnapshotReaderHtml(options: {
  archive: BookmarkArchiveData;
  sourceUrl: string;
  fallbackTitle: string;
}) {
  const { archive, sourceUrl, fallbackTitle } = options;
  const title = archive.archiveTitle || fallbackTitle;
  const excerpt = archive.archiveExcerpt || "";
  const bodyText = archive.archiveText || archive.archiveExcerpt || "";
  const archivedAt = formatArchiveDate(archive.archivedAt);
  const escapedBodyText = escapeSnapshotText(
    bodyText || "No extracted text available.",
  );

  return `<!doctype html>
<html lang="${escapeSnapshotText(archive.archiveLang || "en")}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeSnapshotText(title)}</title>
    <style>
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.6;
        background: #f4f5f7;
        color: #101418;
      }
      .wrap {
        max-width: 860px;
        margin: 28px auto;
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
      }
      .meta {
        padding: 22px 24px;
        border-bottom: 1px solid #eef0f3;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.5rem;
        line-height: 1.25;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }
      .chip {
        font-size: 12px;
        padding: 4px 10px;
        border-radius: 999px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        color: #374151;
      }
      .excerpt {
        margin: 0;
        color: #4b5563;
        font-size: 0.95rem;
      }
      .source {
        margin-top: 12px;
        font-size: 0.85rem;
        color: #6b7280;
        word-break: break-all;
      }
      .source a {
        color: #0f4c81;
      }
      .body {
        margin: 0;
        padding: 22px 24px;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 0.96rem;
        color: #1f2937;
        background: #fff;
      }
      .foot {
        padding: 14px 24px 20px;
        border-top: 1px solid #eef0f3;
        font-size: 12px;
        color: #6b7280;
        background: #fafbfc;
      }
      @media (max-width: 700px) {
        .wrap {
          margin: 0;
          border-radius: 0;
          border-left: 0;
          border-right: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <header class="meta">
        <h1>${escapeSnapshotText(title)}</h1>
        <div class="chips">
          ${archive.archiveSiteName ? `<span class="chip">Site: ${escapeSnapshotText(archive.archiveSiteName)}</span>` : ""}
          ${archive.archiveByline ? `<span class="chip">By: ${escapeSnapshotText(archive.archiveByline)}</span>` : ""}
          ${archivedAt ? `<span class="chip">Archived: ${escapeSnapshotText(archivedAt)}</span>` : ""}
        </div>
        ${excerpt ? `<p class="excerpt">${escapeSnapshotText(excerpt)}</p>` : ""}
        <div class="source">Source: <a href="${escapeSnapshotText(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeSnapshotText(sourceUrl)}</a></div>
      </header>
      <pre class="body">${escapedBodyText}</pre>
      <footer class="foot">
        Reader snapshot generated from stored local archive data.${archive.archiveHtml ? " Raw HTML is available in storage." : ""}
      </footer>
    </main>
  </body>
</html>`;
}

type BookmarkViewMode = "editorial" | "masonry" | "rows" | "minimal";

type BookmarkContentView = "bookmarks" | "tags";

type BookmarkSnapshotMode = "none" | "local" | "internet_archive" | "both";

type BookmarkTagFolderItem = {
  tag: string;
  key: string;
  count: number;
  color: string | null;
};

type BookmarkRssFeed = {
  id: string;
  userId: string;
  feedUrl: string;
  feedTitle: string | null;
  isEnabled: boolean;
  intervalMinutes: number;
  maxItemsPerFetch: number;
  defaultTags: string[] | null;
  snapshotMode: BookmarkSnapshotMode;
  lastFetchedAt: string | null;
  nextFetchAt: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type WaybackStatus = "idle" | "checking" | "success" | "pending";

function normalizeBookmarkViewMode(value: string | null | undefined) {
  if (value === "masonry" || value === "compact") return "masonry";
  if (value === "rows" || value === "list") return "rows";
  if (value === "minimal") return "minimal";
  return "rows";
}

function getBookmarksLayoutClassName(viewMode: BookmarkViewMode) {
  if (viewMode === "masonry")
    return "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3";
  if (viewMode === "rows") return "grid grid-cols-1 gap-2";
  if (viewMode === "minimal") return "grid grid-cols-1 gap-2";
  return "grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4";
}

function normalizeBookmarkContentView(value: string | null | undefined) {
  return value === "tags" ? "tags" : "bookmarks";
}

function normalizeBookmarkSnapshotMode(value: string | null | undefined) {
  if (value === "local") return "local";
  if (value === "internet_archive") return "internet_archive";
  if (value === "both") return "both";
  return "none";
}

function formatFeedDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

export default function BookmarksClient({
  currentUsername = "",
}: {
  currentUsername?: string;
}) {
  const PAGE_SIZE_OPTIONS = [6, 12, 24, 32] as const;
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(true);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [showFavoriteOnly, setShowFavoriteOnly] = useState(false);
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pinnedIdsRaw, setPinnedIdsRaw] = useLocalStorageString(
    "bookmarks:pinned",
    "",
  );
  const [bookmarkViewModeRaw, setBookmarkViewModeRaw] = useLocalStorageString(
    "bookmarks:view-mode",
    "rows",
  );
  const bookmarkViewMode = normalizeBookmarkViewMode(bookmarkViewModeRaw);
  const [bookmarkContentViewRaw, setBookmarkContentViewRaw] =
    useLocalStorageString("bookmarks:content-view", "bookmarks");
  const bookmarkContentView = normalizeBookmarkContentView(
    bookmarkContentViewRaw,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagColors, setTagColors] = useState<Record<string, string | null>>({});
  const [tagBookmarkCounts, setTagBookmarkCounts] = useState<
    Record<string, number>
  >({});
  const [page, setPage] = useState(1);
  const [reloadTick, setReloadTick] = useState(0);
  const [pinFlashId, setPinFlashId] = useState<string | null>(null);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkAddTagOpen, setBulkAddTagOpen] = useState(false);
  const [bulkTagValue, setBulkTagValue] = useState("");
  const [bulkAddTagLoading, setBulkAddTagLoading] = useState(false);
  const seq = useRef(0);
  const { features, loading: featuresLoading } = useUserFeatures();
  const bookmarksEnabled = features.bookmarks?.isEnabled ?? true;
  const bookmarksDisabled = !bookmarksEnabled && !featuresLoading;
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusIdParam = searchParams.get("focusId");
  const initialQ = searchParams.get("q");
  const initialFav = searchParams.get("favorite");
  const initialPub = searchParams.get("public");
  const initialTag = searchParams.get("tag");
  const initialNew = searchParams.get("new");
  const [createOpen, setCreateOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [rssDialogOpen, setRssDialogOpen] = useState(false);
  const didInitFromUrl = useRef(false);

  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;
    if (initialQ) setQ(initialQ);
    if (initialFav === "1") setShowFavoriteOnly(true);
    if (initialPub === "1") setShowPublicOnly(true);
    if (initialTag) setSelectedTags([normalizeTagName(initialTag)]);
    if (initialNew === "1") {
      if (bookmarksDisabled) {
        toast.error(
          "Bookmarks are disabled. Manage this in Settings → Features. If disabled by an admin, contact them.",
        );
      } else {
        setCreateOpen(true);
      }
      const sp = new URLSearchParams(searchParams.toString());
      sp.delete("new");
      router.replace(`/bookmarks${sp.toString() ? `?${sp.toString()}` : ""}`);
    }
  }, [
    initialQ,
    initialFav,
    initialPub,
    initialTag,
    initialNew,
    bookmarksDisabled,
    router,
    searchParams,
  ]);

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

  const bulkDelete = async () => {
    if (selectedIds.length === 0 || bulkDeleteLoading) return;
    setBulkDeleteLoading(true);
    const toDelete = [...selectedIds];
    try {
      const { ok, fail } = await performBulk(toDelete, async (id) =>
        fetch(bookmarksUrl(`/${id}`), { method: "DELETE" }),
      );
      if (fail.length) {
        toast.error(`Deleted ${ok}/${toDelete.length}.`, {
          description: fail[0]?.error || "Some deletions failed.",
        });
      } else {
        toast.success(`Deleted ${ok} bookmark${ok === 1 ? "" : "s"}.`);
      }
    } finally {
      clearSelection();
      await refresh();
      setBulkDeleteLoading(false);
    }
  };

  const bulkSetVisibility = async (value: boolean) => {
    if (selectedIds.length === 0) return;
    const toUpdate = [...selectedIds];
    try {
      const { ok, fail } = await performBulk(toUpdate, async (id) =>
        fetch(bookmarksUrl(`/${id}`), {
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

  const bulkAddTag = async () => {
    if (selectedIds.length === 0 || bulkAddTagLoading) return;
    const normalizedTag = normalizeTagName(bulkTagValue);
    if (!normalizedTag) {
      toast.error("Select a tag to add");
      return;
    }
    setBulkAddTagLoading(true);
    const toUpdate = [...selectedIds];
    const tagsById = new Map(
      items.map((item) => [
        item.id,
        Array.isArray(item.tags) ? item.tags : ([] as string[]),
      ]),
    );
    try {
      const { ok, fail } = await performBulk(toUpdate, async (id) => {
        let existingTags = tagsById.get(id);
        if (!existingTags) {
          const rowRes = await fetch(bookmarksUrl(`/${id}`), {
            cache: "no-store",
          });
          if (!rowRes.ok) return rowRes;
          const payload = (await rowRes.json().catch(() => ({}))) as {
            data?: Partial<DBBookmark>;
          };
          existingTags = Array.isArray(payload.data?.tags)
            ? (payload.data.tags as string[])
            : [];
        }
        const mergedTags = Array.from(
          new Set(
            [...existingTags, normalizedTag]
              .map((tag) => normalizeTagName(tag))
              .filter(Boolean),
          ),
        );
        return fetch(bookmarksUrl(`/${id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: mergedTags }),
        });
      });
      if (fail.length) {
        toast.error(`Tagged ${ok}/${toUpdate.length}.`, {
          description: fail[0]?.error || "Some updates failed.",
        });
      } else {
        toast.success(`Added tag to ${ok} bookmark${ok === 1 ? "" : "s"}.`);
      }
    } finally {
      setBulkAddTagLoading(false);
      setBulkAddTagOpen(false);
      setBulkTagValue("");
      clearSelection();
      await refresh();
    }
  };

  const refresh = async () => {
    clearCache();
    setPage(1);
    const thisSeq = ++seq.current;
    setRefreshing(true);
    try {
      loadBookmarkTags();
      const sp = new URLSearchParams();
      if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
      if (showFavoriteOnly) sp.set("favorite", "1");
      if (showPublicOnly) sp.set("public", "1");
      if (selectedTags.length) sp.set("tags", selectedTags.join(","));
      if (focusIdParam) sp.set("focusId", focusIdParam);
      router.replace(`/bookmarks${sp.toString() ? `?${sp.toString()}` : ""}`);
      setReloadTick((t) => t + 1);
    } catch {
      if (thisSeq === seq.current) toast.error("Failed to load");
    }
  };

  const debouncedQ = useDebouncedValue(q, 300);

  const cacheKey = useMemo(() => {
    const qKey = debouncedQ.trim().toLowerCase();
    const tagsKey = selectedTags.join(",");
    return `${qKey}|${showFavoriteOnly}|${showPublicOnly}|${tagsKey}|${pageSize}|${page}`;
  }, [
    debouncedQ,
    showFavoriteOnly,
    showPublicOnly,
    selectedTags,
    pageSize,
    page,
  ]);

  const fetchBookmarks = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("offset", String((page - 1) * pageSize));
    if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
    if (showFavoriteOnly) qs.set("favorite", "1");
    if (showPublicOnly) qs.set("public", "1");
    if (selectedTags.length) qs.set("tags", selectedTags.join(","));

    const res = await fetch(
      bookmarksUrl(qs.toString() ? `?${qs.toString()}` : ""),
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const js = await res.json();
    return {
      items: js.data ?? [],
      total: Number(js.total || 0),
      extra: {
        tags: Array.isArray(js.tags) ? js.tags : [],
        tagColors:
          js.tagColors && typeof js.tagColors === "object" ? js.tagColors : {},
      },
    };
  }, [
    pageSize,
    page,
    debouncedQ,
    showFavoriteOnly,
    showPublicOnly,
    selectedTags,
  ]);

  const handleExtra = useCallback(
    (extra: { tags: string[]; tagColors: Record<string, string | null> }) => {
      setAvailableTags((prev) =>
        prev.length > 0 ? prev : (extra?.tags ?? []),
      );
      const normalizedColors: Record<string, string | null> = {};
      for (const [name, color] of Object.entries(extra?.tagColors ?? {})) {
        const key = normalizeTagName(name);
        if (key) normalizedColors[key] = color ?? null;
      }
      setTagColors((prev) => ({ ...prev, ...normalizedColors }));
    },
    [],
  );

  const loadBookmarkTags = useCallback(async () => {
    try {
      const res = await fetch(apiV1("/bookmark-tags"), { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        name: string;
        color?: string | null;
        bookmarkCount?: number;
      }[];
      const names = data.map((t) => t.name);
      const colors: Record<string, string | null> = {};
      const counts: Record<string, number> = {};
      for (const item of data) {
        const key = normalizeTagName(item.name);
        if (!key) continue;
        colors[key] = item.color ?? null;
        counts[key] = Number(item.bookmarkCount ?? 0);
      }
      setAvailableTags(names);
      setTagColors((prev) => ({ ...prev, ...colors }));
      setTagBookmarkCounts(counts);
    } catch {
      toast.error("Failed to load bookmark tags");
    }
  }, []);

  const { items, setItems, totalPages, listLoading, clearCache } =
    useCachedPagedList<
      DBBookmark,
      { tags: string[]; tagColors: Record<string, string | null> }
    >({
      cacheKey,
      page,
      pageSize,
      reloadTick,
      setPage,
      setReloadTick,
      onExtra: handleExtra,
      fetcher: fetchBookmarks,
    });

  const applyPatch = useCallback(
    (id: string, patch: Partial<DBBookmark>) => {
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

  useEffect(() => {
    setRefreshing(listLoading);
  }, [listLoading]);

  useEffect(() => {
    loadBookmarkTags();
  }, [loadBookmarkTags]);

  const pinnedIds = useMemo(
    () => new Set(pinnedIdsRaw.split(",").filter(Boolean)),
    [pinnedIdsRaw],
  );

  const togglePin = useCallback(
    (id: string) => {
      setPinnedIdsRaw((prev) => {
        const list = prev.split(",").filter(Boolean);
        const set = new Set(list);
        if (set.has(id)) return list.filter((x) => x !== id).join(",");
        return [...list, id].join(",");
      });
      setPinFlashId(id);
      setTimeout(() => setPinFlashId(null), 650);
    },
    [setPinnedIdsRaw],
  );

  const pinnedItems = useMemo(
    () => items.filter((item) => pinnedIds.has(item.id)),
    [items, pinnedIds],
  );
  const unpinnedItems = useMemo(
    () => items.filter((item) => !pinnedIds.has(item.id)),
    [items, pinnedIds],
  );
  const paginatedItems = useMemo(() => unpinnedItems, [unpinnedItems]);
  const visibleSelectionOrder = useMemo(
    () => [...pinnedItems, ...paginatedItems].map((item) => item.id),
    [pinnedItems, paginatedItems],
  );

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);

  const paginatedItemsIds = useMemo(
    () => paginatedItems.map((x) => x.id).join(","),
    [paginatedItems],
  );

  const cardsLayoutClassName = getBookmarksLayoutClassName(bookmarkViewMode);

  const tagFolderItems = useMemo(() => {
    const normalizedQuery = q.trim().toLowerCase();
    const mapped = availableTags
      .map((tag) => {
        const key = normalizeTagName(tag);
        if (!key) return null;
        return {
          tag,
          key,
          count: Number(tagBookmarkCounts[key] ?? 0),
          color: tagColors[key] ?? null,
        } satisfies BookmarkTagFolderItem;
      })
      .filter((item): item is BookmarkTagFolderItem => Boolean(item));

    const filtered = normalizedQuery
      ? mapped.filter((item) => {
          const displayName = formatTagName(item.tag).toLowerCase();
          return (
            displayName.includes(normalizedQuery) ||
            item.tag.toLowerCase().includes(normalizedQuery)
          );
        })
      : mapped;

    return filtered.sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
    );
  }, [availableTags, q, tagBookmarkCounts, tagColors]);

  const openTagFolder = useCallback(
    (tag: string) => {
      const normalized = normalizeTagName(tag);
      if (!normalized) return;
      clearSelection();
      setSelectedTags([normalized]);
      setPage(1);
      setBookmarkContentViewRaw("bookmarks");
    },
    [clearSelection, setBookmarkContentViewRaw],
  );

  useEffect(() => {
    if (!focusIdParam) return;
    if (flashId === focusIdParam) return;
    const el = cardRefs.current[focusIdParam];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(focusIdParam);
      const t = setTimeout(() => setFlashId(null), 1600);
      return () => clearTimeout(t);
    }
  }, [focusIdParam, paginatedItemsIds, page, flashId]);

  useEffect(() => {
    setPage(1);
    if (selectedIds.length > 0) clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    showFavoriteOnly,
    showPublicOnly,
    debouncedQ,
    pageSize,
    selectedTags,
    bookmarkContentView,
    clearSelection,
  ]);

  return (
    <PageLayout
      title="Bookmarks"
      subtitle="Create and share your bookmarks"
      headerActions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Bookmark tools">
              <IconAdjustments className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => setTransferDialogOpen(true)}>
              <IconUpload className="h-4 w-4" />
              Import/Export
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRssDialogOpen(true)}>
              <IconRss className="h-4 w-4" />
              Auto-Hoard RSS
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      toolbar={
        <>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              bookmarkContentView === "tags"
                ? "Search tag folders..."
                : "Search bookmarks..."
            }
            className="w-full"
          />

          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters((v) => !v)}
            className="whitespace-nowrap"
            aria-expanded={showFilters}
            aria-controls="bookmarks-filters"
          >
            <IconFilterSpark />
          </Button>
          <Button
            variant={refreshing ? "ghost" : "outline"}
            onClick={() => refresh()}
            disabled={refreshing}
          >
            {refreshing ? (
              <IconLoader className="h-4 w-4 animate-spin" />
            ) : (
              <IconRefresh className="h-4 w-4" />
            )}
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
          {currentUsername && (
            <BookmarkTagsDialog
              username={currentUsername}
              onChanged={() => {
                loadBookmarkTags();
                refresh();
              }}
            />
          )}
          <CreateBookmarkDialog
            onCreated={() => refresh()}
            tagColors={tagColors}
            availableTags={availableTags}
            open={createOpen}
            onOpenChange={setCreateOpen}
            disabled={bookmarksDisabled}
            disabledReason="Manage this in Settings → Features. If it was disabled by an admin, contact them."
          />
          <BookmarkTransferDialog
            open={transferDialogOpen}
            onOpenChange={setTransferDialogOpen}
            onImported={() => refresh()}
          />
          <RssAutoHoardDialog
            open={rssDialogOpen}
            onOpenChange={setRssDialogOpen}
            onChanged={() => refresh()}
            tagColors={tagColors}
            availableTags={availableTags}
          />
        </>
      }
    >
      {bookmarksDisabled ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Bookmarks are disabled. You can manage this in Settings → Features. If
          it was disabled by an admin, contact them.
        </div>
      ) : null}
      {showFilters && (
        <FilterPanel id="bookmarks-filters">
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
          <Select
            value={bookmarkContentView}
            onValueChange={(value) =>
              setBookmarkContentViewRaw(normalizeBookmarkContentView(value))
            }
          >
            <SelectTrigger className="rounded-md border text-sm min-w-40">
              <SelectValue placeholder="Content" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bookmarks">Bookmarks</SelectItem>
              <SelectItem value="tags">Tag Folders</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={bookmarkViewMode}
            onValueChange={(value) =>
              setBookmarkViewModeRaw(normalizeBookmarkViewMode(value))
            }
          >
            <SelectTrigger className="rounded-md border text-sm min-w-36">
              <SelectValue placeholder="View mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editorial">Editorial</SelectItem>
              <SelectItem value="masonry">Masonry</SelectItem>
              <SelectItem value="rows">Rows</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
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
                      "bt",
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

      {bookmarkContentView === "tags" ? (
        <BookmarkTagFolders
          items={tagFolderItems}
          selectedTag={selectedTags[0] ?? null}
          onOpenTag={openTagFolder}
        />
      ) : listLoading ? (
        <BookmarksSkeleton count={pageSize} viewMode={bookmarkViewMode} />
      ) : (
        <div className="space-y-3" key={seq.current}>
          <SelectionBar count={selectedCount}>
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
            <Dialog open={bulkAddTagOpen} onOpenChange={setBulkAddTagOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={bulkAddTagLoading || availableTags.length === 0}
                >
                  <IconTag /> Add Tag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Add tag to {selectedCount} selected bookmark
                    {selectedCount === 1 ? "" : "s"}
                  </DialogTitle>
                </DialogHeader>
                {availableTags.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Create a bookmark tag first, then try again.
                  </p>
                ) : (
                  <Select value={bulkTagValue} onValueChange={setBulkTagValue}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a tag" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {formatTagName(tag)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setBulkAddTagOpen(false)}
                    disabled={bulkAddTagLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={bulkAddTag}
                    disabled={
                      bulkAddTagLoading ||
                      availableTags.length === 0 ||
                      !normalizeTagName(bulkTagValue)
                    }
                  >
                    {bulkAddTagLoading ? (
                      <>
                        <IconLoader className="h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Tag"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkDeleteLoading}
                >
                  {bulkDeleteLoading ? (
                    <>
                      <IconLoader className="h-4 w-4 animate-spin" />
                      Removing...
                    </>
                  ) : (
                    "Remove Selected"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selectedCount} selected bookmark
                    {selectedCount === 1 ? "" : "s"}?
                  </AlertDialogTitle>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={bulkDeleteLoading}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={bulkDelete}
                    disabled={bulkDeleteLoading}
                  >
                    {bulkDeleteLoading ? (
                      <>
                        <IconLoader className="h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SelectionBar>

          {pinnedItems.length > 0 && (
            <div className="space-y-3">
              <div className={cardsLayoutClassName}>
                {pinnedItems.map((r, i) => (
                  <BookmarkCard
                    key={r.id}
                    row={r}
                    onChanged={() => refresh()}
                    onPatch={(patch) => applyPatch(r.id, patch)}
                    index={i}
                    selected={isSelected(r.id)}
                    onToggle={() =>
                      toggleOne(r.id, { orderedIds: visibleSelectionOrder })
                    }
                    enableCardSelection={selectedCount > 0}
                    flash={flashId === r.id}
                    isPinned={pinnedIds.has(r.id)}
                    pinFlash={pinFlashId === r.id}
                    onTogglePin={() => togglePin(r.id)}
                    tagColors={tagColors}
                    availableTags={availableTags}
                    viewMode={bookmarkViewMode}
                    setRef={(el) => (cardRefs.current[r.id] = el)}
                  />
                ))}
              </div>
              <Separator />
            </div>
          )}

          {paginatedItems.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No bookmarks yet.
            </div>
          ) : (
            <div className={cardsLayoutClassName}>
              {paginatedItems.map((r, i) => (
                <BookmarkCard
                  key={r.id}
                  row={r}
                  onChanged={() => refresh()}
                  onPatch={(patch) => applyPatch(r.id, patch)}
                  index={i}
                  selected={isSelected(r.id)}
                  onToggle={() =>
                    toggleOne(r.id, { orderedIds: visibleSelectionOrder })
                  }
                  enableCardSelection={selectedCount > 0}
                  flash={flashId === r.id}
                  isPinned={pinnedIds.has(r.id)}
                  pinFlash={pinFlashId === r.id}
                  onTogglePin={() => togglePin(r.id)}
                  tagColors={tagColors}
                  availableTags={availableTags}
                  viewMode={bookmarkViewMode}
                  setRef={(el) => (cardRefs.current[r.id] = el)}
                />
              ))}
            </div>
          )}
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

function BookmarkTagFolders({
  items,
  selectedTag,
  onOpenTag,
}: {
  items: BookmarkTagFolderItem[];
  selectedTag: string | null;
  onOpenTag: (tag: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/60 px-4 py-8 text-sm text-muted-foreground">
        No tag folders found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {items.map((item) => {
        const styles = getBadgeColorStyles(item.color);
        const isActive =
          selectedTag !== null && normalizeTagName(selectedTag) === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onOpenTag(item.tag)}
            className={cn(
              "rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/30",
              isActive && "border-primary/60 bg-accent/40",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {formatTagName(item.tag)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {item.count} bookmark{item.count === 1 ? "" : "s"}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn("text-xs", styles?.className)}
                style={styles?.style}
              >
                <IconTag className="h-3.5 w-3.5" />
                Tag
              </Badge>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BookmarksSkeleton({
  count = 6,
  viewMode = "editorial",
}: {
  count?: number;
  viewMode?: BookmarkViewMode;
}) {
  const layoutClassName = getBookmarksLayoutClassName(viewMode);
  const isRowsView = viewMode === "rows";
  const showImageSkeleton = viewMode !== "minimal";
  const imageSkeletonHeightClassName =
    viewMode === "masonry"
      ? "h-24"
      : viewMode === "rows"
        ? "aspect-[1/1]"
        : "h-40";

  return (
    <div className={layoutClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl border bg-card p-4 flex flex-col gap-3",
            viewMode === "minimal" && "p-3 gap-2 bg-background/60",
            viewMode === "rows" && "p-3 gap-2",
          )}
        >
          {isRowsView ? (
            <div className="space-y-2 md:grid md:grid-cols-[7.5rem_1fr] md:items-start md:gap-3 md:space-y-0">
              <Skeleton className="aspect-5/3 w-full rounded-lg" />
              <div className="space-y-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <div className="flex gap-1 pt-0.5">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-10" />
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-8" />
              </div>
              {showImageSkeleton ? (
                <Skeleton
                  className={`${imageSkeletonHeightClassName} w-full`}
                />
              ) : null}
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-12" />
                <Skeleton className="h-5 w-14" />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function BookmarkCard({
  row,
  onChanged,
  onPatch,
  index = 0,
  selected = false,
  onToggle,
  enableCardSelection,
  flash = false,
  isPinned = false,
  pinFlash = false,
  onTogglePin,
  setRef,
  tagColors,
  availableTags,
  viewMode = "editorial",
}: {
  row: DBBookmark;
  onChanged: () => void;
  onPatch?: (patch: Partial<DBBookmark>) => void;
  index?: number;
  selected?: boolean;
  onToggle?: () => void;
  enableCardSelection?: boolean;
  flash?: boolean;
  isPinned?: boolean;
  pinFlash?: boolean;
  onTogglePin?: () => void;
  setRef?: (el: HTMLDivElement | null) => void;
  tagColors?: Record<string, string | null>;
  availableTags: string[];
  viewMode?: BookmarkViewMode;
}) {
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isMasonryView = viewMode === "masonry";
  const isRowsView = viewMode === "rows";
  const isMinimalView = viewMode === "minimal";
  const showImage = Boolean(row.imageUrl) && !isMinimalView;
  const imageClassName = cn(
    "w-full object-cover rounded-lg border",
    isMasonryView && "h-28",
    isRowsView && "aspect-[1/1] h-auto max-h-28",
    !isMasonryView && !isRowsView && "h-44 md:h-52",
  );
  const descriptionClampClassName = isMinimalView
    ? "line-clamp-1"
    : isMasonryView
      ? "line-clamp-2"
      : isRowsView
        ? "line-clamp-1"
        : "line-clamp-3";
  const getShareLink = (anonymous = false) => {
    if (!row.slug) throw new Error("Missing slug");
    return shareUrl("b", row.slug, anonymous ? { anonymous: true } : undefined);
  };

  const onDelete = async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(bookmarksUrl(`/${row.id}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j?.error || "Delete failed");
      } else {
        toast.success("Deleted");
        onChanged();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleFavorite = async () => {
    if (favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      const res = await fetch(bookmarksUrl(`/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !row.isFavorite }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to update favorite");
      toast.success(
        !row.isFavorite ? "Added to favorites" : "Removed from favorites",
      );
      onPatch?.({ isFavorite: !row.isFavorite });
    } catch (e) {
      toast.error((e as Error).message || "Failed to update favorite");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const toggleVisibility = async () => {
    if (visibilityLoading) return;
    setVisibilityLoading(true);
    try {
      const res = await fetch(bookmarksUrl(`/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !row.isPublic }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to update visibility");
      toast.success(`Bookmark is now ${!row.isPublic ? "public" : "private"}`);
      onPatch?.({ isPublic: !row.isPublic });
    } catch (e) {
      toast.error((e as Error).message || "Failed to update visibility");
    } finally {
      setVisibilityLoading(false);
    }
  };

  const cardActions = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(isPinned ? "text-primary" : "", pinFlash && "")}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onTogglePin?.();
        }}
        title={isPinned ? "Unpin" : "Pin"}
      >
        <div
          className={cn(
            "p-2 rounded-md",
            isPinned
              ? "text-primary bg-accent"
              : "text-muted-foreground bg-muted",
          )}
        >
          {isPinned ? (
            <IconPinFilled className="h-4 w-4" />
          ) : (
            <IconPin className="h-4 w-4" />
          )}
        </div>
      </Button>
      <FavoriteBadge
        isFavorite={row.isFavorite!}
        toggleFavorite={toggleFavorite}
        loading={favoriteLoading}
      />
      <PublicBadge
        isPublic={row.isPublic!}
        toggleVisibility={toggleVisibility}
        loading={visibilityLoading}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <IconAdjustments className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60">
          <EditBookmarkDialog
            row={row}
            onSaved={onChanged}
            tagColors={tagColors}
            availableTags={availableTags}
          />
          <ArchiveBookmarkDialog row={row} />
          {row.isPublic && (
            <CopyButton
              variant="ghost"
              className="w-full justify-start"
              successMessage="Copied share link"
              getText={() => getShareLink()}
            >
              <IconCopy className="h-4 w-4" />
              <span>Copy Link</span>
            </CopyButton>
          )}
          {row.isPublic && (
            <CopyButton
              variant="ghost"
              className="w-full justify-start"
              successMessage="Copied anonymous share link"
              successDescription="Anonymous share hides your profile, but content may still reveal identity."
              getText={() => getShareLink(true)}
            >
              <IconCopy className="h-4 w-4" />
              <span>Copy Anonymous Link</span>
              <HelpTip text="Anonymous share hides your profile, but content may still reveal identity. Or changing the URL parameters may affect anonymity." />
            </CopyButton>
          )}
          {row.isPublic && (
            <ShareQrButton
              url={getShareLink()}
              label="Share QR"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            />
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start"
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <IconLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <IconTrash className="h-4 w-4 text-red-500" />
                )}
                <span>{deleteLoading ? "Deleting..." : "Delete"}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Bookmark</AlertDialogTitle>
                <p>Are you sure you want to delete this bookmark?</p>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteLoading}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} disabled={deleteLoading}>
                  {deleteLoading ? (
                    <>
                      <IconLoader className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );

  return (
    <Card
      ref={setRef}
      className={cn(
        "group animate-fade-in-up relative overflow-hidden transition-colors",
        isMasonryView && "bg-card/90",
        isRowsView && "border-l border-l-border",
        isMinimalView && "bg-background/60 border-dashed shadow-none",
        selected && "ring-2 ring-primary",
        flash && "ring-2 ring-primary shadow-primary",
      )}
      style={{ animationDelay: `${index * 60}ms` }}
      onClick={enableCardSelection ? onToggle : undefined}
    >
      <div
        className="absolute left-2 top-2 z-50 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
      >
        <Checkbox
          checked={selected}
          className="cursor-pointer"
          aria-label={`Select ${row.title || row.slug}`}
        />
      </div>
      <CardHeader
        className={cn(
          "flex justify-between items-start gap-2",
          isRowsView && "hidden",
          isRowsView && "px-3 py-2",
          isMinimalView && "pb-1 pt-3",
          !isRowsView && !isMinimalView && "pb-2",
        )}
      >
        <CardTitle
          className={cn(
            "line-clamp-1 items-center",
            isMasonryView || isMinimalView || isRowsView
              ? "text-sm"
              : "text-base",
            isRowsView && "sr-only",
          )}
        >
          {row.title || row.url}
        </CardTitle>
        <div className="flex items-center gap-1">{cardActions}</div>
      </CardHeader>
      <CardContent
        className={cn(
          "space-y-2 flex flex-col h-full justify-between",
          isRowsView && "px-5",
          isMinimalView && "pt-0 pb-3",
        )}
      >
        <div
          className={cn(
            "space-y-2",
            isRowsView &&
              showImage &&
              "md:grid md:grid-cols-[7.5rem_1fr] md:items-start md:gap-3 md:space-y-0",
          )}
        >
          {showImage ? (
            <div className="relative">
              <Image
                src={row.imageUrl!}
                alt={row.title || "Bookmark image"}
                width={500}
                height={300}
                className={imageClassName}
                loading="lazy"
              />
              {row.isPublic && (
                <CopyButton
                  variant="secondary"
                  size="icon"
                  successMessage="Copied share link"
                  getText={getShareLink}
                  className="absolute top-1 right-1"
                >
                  <IconShare />
                </CopyButton>
              )}
            </div>
          ) : null}

          <div
            className={cn(
              "space-y-2 min-w-0",
              isRowsView && "space-y-1",
              isMinimalView && "space-y-1",
            )}
          >
            {isRowsView ? (
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium line-clamp-1 leading-tight min-w-0">
                  {row.title || row.url}
                </div>
                <div
                  className="flex items-center gap-1 shrink-0 -mr-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {cardActions}
                </div>
              </div>
            ) : null}
            <Link
              href={row.url}
              target="_blank"
              className={cn(
                "text-primary underline break-all",
                isRowsView && "text-sm line-clamp-1",
                isMinimalView && "text-sm line-clamp-1",
              )}
            >
              {row.url}
            </Link>
            {row.description && !isMinimalView ? (
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  descriptionClampClassName,
                )}
              >
                {row.description}
              </p>
            ) : null}
            {Array.isArray(row.tags) && row.tags.length > 0 && (
              <div
                className={cn(
                  "flex flex-wrap gap-2 pt-1",
                  isRowsView && "gap-1 pt-0.5",
                  isMinimalView && "gap-1 pt-0",
                )}
              >
                {row.tags.map((t: string) => {
                  const key = normalizeTagName(t);
                  const styles = getBadgeColorStyles(tagColors?.[key]);
                  return (
                    <Badge
                      key={t}
                      variant="outline"
                      className={cn(
                        isMinimalView || isRowsView ? "text-[10px]" : "text-xs",
                        styles?.className,
                      )}
                      style={styles?.style}
                    >
                      <IconTag />
                      {formatTagName(t)}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookmarkTransferDialog({
  onImported,
  open,
  onOpenChange,
}: {
  onImported: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<
    "json" | "html" | null
  >(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const exportBookmarks = async (format: "json" | "html") => {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      const res = await fetch(bookmarksUrl(`/export?format=${format}`), {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to export bookmarks");
      }
      const blob = await res.blob();
      const fallbackName = `swush-bookmarks.${format === "json" ? "json" : "html"}`;
      const fileName = parseFileNameFromDisposition(
        res.headers.get("content-disposition"),
        fallbackName,
      );
      downloadBlobFile(blob, fileName);
      toast.success(`Bookmarks exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error((error as Error).message || "Failed to export bookmarks");
    } finally {
      setExportingFormat(null);
    }
  };

  const importBookmarksFile = async (file: File) => {
    setImporting(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const res = await fetch(bookmarksUrl("/import"), {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        data?: {
          total?: number;
          imported?: number;
          skipped?: number;
          failed?: number;
        };
      };
      if (!res.ok) {
        throw new Error(body?.error || body?.message || "Import failed");
      }

      const imported = Number(body?.data?.imported || 0);
      const skipped = Number(body?.data?.skipped || 0);
      const failed = Number(body?.data?.failed || 0);
      toast.success(
        `Imported ${imported} bookmark${imported === 1 ? "" : "s"}.`,
        {
          description: `Skipped ${skipped}, failed ${failed}.`,
        },
      );
      onOpenChange(false);
      onImported();
    } catch (error) {
      toast.error((error as Error).message || "Failed to import bookmarks");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import and export bookmarks</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">Export bookmarks</p>
            <p className="text-xs text-muted-foreground">
              Export as JSON (full bookmark data) or browser HTML bookmarks.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => exportBookmarks("json")}
                disabled={Boolean(exportingFormat) || importing}
              >
                {exportingFormat === "json" ? (
                  <IconLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <IconDownload className="h-4 w-4" />
                )}
                Export JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => exportBookmarks("html")}
                disabled={Boolean(exportingFormat) || importing}
              >
                {exportingFormat === "html" ? (
                  <IconLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <IconDownload className="h-4 w-4" />
                )}
                Export HTML
              </Button>
            </div>
          </div>

          <div className="grid gap-2 rounded-md border p-3">
            <p className="text-sm font-medium">Import bookmarks</p>
            <p className="text-xs text-muted-foreground">
              Import from Swush JSON export or browser bookmark HTML. Existing
              URLs are skipped.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.html,.htm,application/json,text/html"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importBookmarksFile(file);
                event.target.value = "";
              }}
            />
            <Button
              variant="outline"
              disabled={importing || Boolean(exportingFormat)}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? (
                <IconLoader className="h-4 w-4 animate-spin" />
              ) : (
                <IconUpload className="h-4 w-4" />
              )}
              {importing ? "Importing..." : "Choose file and import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RssAutoHoardDialog({
  open,
  onOpenChange,
  onChanged,
  tagColors,
  availableTags,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  tagColors: Record<string, string | null>;
  availableTags: string[];
}) {
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feeds, setFeeds] = useState<BookmarkRssFeed[]>([]);
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null);
  const [runningFeedId, setRunningFeedId] = useState<string | null>(null);

  const [feedUrl, setFeedUrl] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [maxItemsPerFetch, setMaxItemsPerFetch] = useState(10);
  const [snapshotMode, setSnapshotMode] =
    useState<BookmarkSnapshotMode>("none");
  const [tagsText, setTagsText] = useState("");

  const intervalOptions = [5, 15, 30, 60, 180, 360, 720, 1440];
  const maxItemsOptions = [5, 10, 15, 20, 30];

  const loadFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(bookmarkRssFeedsUrl(), { cache: "no-store" });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: BookmarkRssFeed[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load RSS feeds");
      }
      setFeeds(Array.isArray(payload.data) ? payload.data : []);
    } catch (error) {
      toast.error((error as Error).message || "Failed to load RSS feeds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadFeeds();
  }, [open, loadFeeds]);

  useEffect(() => {
    if (!open) setAddFeedOpen(false);
  }, [open]);

  const patchFeed = useCallback(
    async (
      id: string,
      patch: Record<string, unknown>,
      options?: { successMessage?: string },
    ) => {
      setBusyFeedId(id);
      try {
        const res = await fetch(bookmarkRssFeedsUrl(`/${id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          data?: BookmarkRssFeed;
          error?: string;
        };

        if (!res.ok || !payload.data) {
          throw new Error(payload.error || "Failed to update RSS feed");
        }

        setFeeds((prev) =>
          prev.map((feed) =>
            feed.id === payload.data!.id ? payload.data! : feed,
          ),
        );
        if (options?.successMessage) toast.success(options.successMessage);
      } catch (error) {
        toast.error((error as Error).message || "Failed to update RSS feed");
      } finally {
        setBusyFeedId(null);
      }
    },
    [],
  );

  const addFeed = async () => {
    if (!feedUrl.trim()) {
      toast.error("Feed URL is required");
      return;
    }

    setSaving(true);
    try {
      const defaultTags = Array.from(
        new Set(
          tagsText
            .split(",")
            .map((tag) => normalizeTagName(tag))
            .filter(Boolean),
        ),
      );

      const res = await fetch(bookmarkRssFeedsUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedUrl,
          intervalMinutes,
          maxItemsPerFetch,
          snapshotMode,
          defaultTags,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        data?: BookmarkRssFeed;
        error?: string;
      };

      if (!res.ok || !payload.data) {
        throw new Error(payload.error || "Failed to add RSS feed");
      }

      setFeeds((prev) => [payload.data!, ...prev]);
      setFeedUrl("");
      setIntervalMinutes(60);
      setMaxItemsPerFetch(10);
      setSnapshotMode("none");
      setTagsText("");
      setAddFeedOpen(false);
      toast.success("RSS feed added");
      onChanged();
    } catch (error) {
      toast.error((error as Error).message || "Failed to add RSS feed");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (id: string) => {
    setRunningFeedId(id);
    try {
      const res = await fetch(bookmarkRssFeedsUrl(`/${id}`), {
        method: "POST",
      });

      const payload = (await res.json().catch(() => ({}))) as {
        data?: BookmarkRssFeed;
        error?: string;
      };

      if (!res.ok || !payload.data) {
        throw new Error(payload.error || "Failed to queue feed run");
      }

      setFeeds((prev) =>
        prev.map((feed) =>
          feed.id === payload.data!.id ? payload.data! : feed,
        ),
      );
      toast.success("Feed run queued");
    } catch (error) {
      toast.error((error as Error).message || "Failed to queue feed run");
    } finally {
      setRunningFeedId(null);
    }
  };

  const removeFeed = async (id: string) => {
    if (!window.confirm("Remove this RSS feed?")) return;

    setBusyFeedId(id);
    try {
      const res = await fetch(bookmarkRssFeedsUrl(`/${id}`), {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to remove RSS feed");
      }

      setFeeds((prev) => prev.filter((feed) => feed.id !== id));
      toast.success("RSS feed removed");
    } catch (error) {
      toast.error((error as Error).message || "Failed to remove RSS feed");
    } finally {
      setBusyFeedId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Auto-hoard from RSS feeds</DialogTitle>
          </DialogHeader>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Configured feeds</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddFeedOpen(true)}
                >
                  <IconRss className="h-4 w-4" />
                  Add RSS feed
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void loadFeeds()}
                  disabled={loading}
                >
                  {loading ? (
                    <IconLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconRefresh className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading feeds...</p>
            ) : feeds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No RSS feeds yet.</p>
            ) : (
              <div className="space-y-3 max-h-[48vh] overflow-auto pr-1">
                {feeds.map((feed) => {
                  const isBusy =
                    busyFeedId === feed.id || runningFeedId === feed.id;
                  return (
                    <div
                      key={feed.id}
                      className="rounded-md border p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium line-clamp-1">
                            {feed.feedTitle || feed.feedUrl}
                          </p>
                          <p className="text-xs text-muted-foreground break-all">
                            {feed.feedUrl}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={feed.isEnabled ? "default" : "secondary"}
                          >
                            {feed.isEnabled ? "Enabled" : "Paused"}
                          </Badge>
                          {feed.lastError ? (
                            <Badge
                              variant="destructive"
                              className="text-[11px]"
                            >
                              Last run failed
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Enabled
                          </Label>
                          <Switch
                            checked={feed.isEnabled}
                            disabled={isBusy}
                            onCheckedChange={(value) => {
                              void patchFeed(
                                feed.id,
                                { isEnabled: value },
                                {
                                  successMessage: value
                                    ? "Feed enabled"
                                    : "Feed paused",
                                },
                              );
                            }}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Interval
                          </Label>
                          <Select
                            value={String(feed.intervalMinutes)}
                            onValueChange={(value) => {
                              void patchFeed(feed.id, {
                                intervalMinutes: Number(value),
                              });
                            }}
                            disabled={isBusy}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Interval" />
                            </SelectTrigger>
                            <SelectContent>
                              {intervalOptions.map((value) => (
                                <SelectItem key={value} value={String(value)}>
                                  {value < 60
                                    ? `${value} min`
                                    : value % 60 === 0
                                      ? `${value / 60} h`
                                      : `${value} min`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Items per fetch
                          </Label>
                          <Select
                            value={String(feed.maxItemsPerFetch)}
                            onValueChange={(value) => {
                              void patchFeed(feed.id, {
                                maxItemsPerFetch: Number(value),
                              });
                            }}
                            disabled={isBusy}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Items" />
                            </SelectTrigger>
                            <SelectContent>
                              {maxItemsOptions.map((value) => (
                                <SelectItem key={value} value={String(value)}>
                                  {value} items
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {Array.isArray(feed.defaultTags) &&
                      feed.defaultTags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {feed.defaultTags.map((tag) => {
                            const normalizedTag = normalizeTagName(tag);
                            const styles = getBadgeColorStyles(
                              tagColors[normalizedTag],
                            );
                            return (
                              <Badge
                                key={`${feed.id}-${tag}`}
                                variant="outline"
                                className={cn("text-[10px]", styles?.className)}
                                style={styles?.style}
                              >
                                <IconTag className="h-3 w-3" />
                                {formatTagName(tag)}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          Next: {formatFeedDateTime(feed.nextFetchAt)} | Last:{" "}
                          {formatFeedDateTime(feed.lastFetchedAt)}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isBusy || !feed.isEnabled}
                            onClick={() => void runNow(feed.id)}
                          >
                            {runningFeedId === feed.id ? (
                              <IconLoader className="h-4 w-4 animate-spin" />
                            ) : (
                              <IconRefresh className="h-4 w-4" />
                            )}
                            Run now
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => void removeFeed(feed.id)}
                          >
                            <IconTrash className="h-4 w-4 text-red-500" />
                            Remove
                          </Button>
                        </div>
                      </div>

                      {feed.lastError ? (
                        <p className="text-xs text-red-600">{feed.lastError}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addFeedOpen} onOpenChange={setAddFeedOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add RSS feed</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Feed URL</Label>
              <Input
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
                placeholder="https://example.com/rss.xml"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Fetch every</Label>
                <Select
                  value={String(intervalMinutes)}
                  onValueChange={(value) => setIntervalMinutes(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Interval" />
                  </SelectTrigger>
                  <SelectContent>
                    {intervalOptions.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value < 60
                          ? `${value} min`
                          : value % 60 === 0
                            ? `${value / 60} h`
                            : `${value} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Items per fetch</Label>
                <Select
                  value={String(maxItemsPerFetch)}
                  onValueChange={(value) => setMaxItemsPerFetch(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Items" />
                  </SelectTrigger>
                  <SelectContent>
                    {maxItemsOptions.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value} items
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Snapshot mode</Label>
                <Select
                  value={snapshotMode}
                  onValueChange={(value) =>
                    setSnapshotMode(normalizeBookmarkSnapshotMode(value))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Snapshot mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="local">Local HTML Snapshot</SelectItem>
                    <SelectItem value="internet_archive">
                      Internet Archive Only
                    </SelectItem>
                    <SelectItem value="both">
                      Local + Internet Archive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Default tags</Label>
              <TagInputWithSuggestions
                value={tagsText}
                onChange={setTagsText}
                tagColors={tagColors}
                availableTags={availableTags}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddFeedOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={addFeed} disabled={saving}>
              {saving ? (
                <>
                  <IconLoader className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Feed"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateBookmarkDialog({
  onCreated,
  tagColors,
  availableTags,
  open: controlledOpen,
  onOpenChange,
  disabled,
  disabledReason,
}: {
  onCreated: () => void;
  tagColors?: Record<string, string | null>;
  availableTags: string[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const actualOpen = isControlled ? controlledOpen : open;
  const setActualOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setOpen(next);
  };
  const [saving, setSaving] = useState(false);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [password, setPassword] = useState("");
  const [maxViews, setMaxViews] = useState<number | "">("");
  const [maxViewsAction, setMaxViewsAction] = useState<
    "make_private" | "delete" | ""
  >("");
  const [snapshotMode, setSnapshotMode] =
    useState<BookmarkSnapshotMode>("local");
  const [tagsText, setTagsText] = useState("");
  const { prefs, loading: prefsLoading } = useUserPreferences();

  useEffect(() => {
    if (prefsLoading) return;
    setIsPublic(prefs.defaultBookmarkVisibility === "public");
    setTagsText((prefs.defaultBookmarkTags || []).join(", "));
  }, [prefs, prefsLoading]);

  const save = async () => {
    setSaving(true);
    if (!url.trim()) {
      toast.error("URL is required");
      setSaving(false);
      return;
    }
    try {
      const tags = Array.from(
        new Set(
          tagsText
            .split(",")
            .map((t) => normalizeTagName(t))
            .filter(Boolean),
        ),
      );

      const res = await fetch(bookmarksUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          url: url,
          title: title || null,
          description: description || null,
          imageUrl: imageUrl || null,
          slug: slug || null,
          isFavorite,
          isPublic,
          password: password || null,
          maxViews: typeof maxViews === "number" ? maxViews : null,
          maxViewsAction: maxViewsAction || null,
          tags: tags.length ? tags : undefined,
          snapshotMode,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          j?.message ||
            j?.error ||
            (res.status === 403
              ? "Bookmarks are disabled. Manage this in Settings → Features. If disabled by an admin, contact them."
              : "Create failed"),
        );
      }
      const localSnapshot = j?.snapshot?.local as
        | { ok?: boolean; error?: string | null }
        | null
        | undefined;
      const internetArchiveSnapshot = j?.snapshot?.internetArchive as
        | { ok?: boolean; error?: string | null }
        | null
        | undefined;
      const snapshotErrors = [
        localSnapshot && !localSnapshot.ok
          ? (localSnapshot.error ?? "Local snapshot failed")
          : null,
        internetArchiveSnapshot && !internetArchiveSnapshot.ok
          ? (internetArchiveSnapshot.error ??
            "Internet Archive submission failed")
          : null,
      ].filter(Boolean) as string[];

      toast.success(
        snapshotErrors.length
          ? "Bookmark created (snapshot partial)"
          : "Bookmark created",
        snapshotErrors.length
          ? { description: snapshotErrors.join(" | ") }
          : undefined,
      );
      setActualOpen(false);
      onCreated();
      setTitle("");
      setDescription("");
      setImageUrl("");
      setSlug("");
      setIsPublic(prefs.defaultBookmarkVisibility === "public");
      setPassword("");
      setMaxViews("");
      setMaxViewsAction("");
      setSnapshotMode("local");
      setTagsText((prefs.defaultBookmarkTags || []).join(", "));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={actualOpen} onOpenChange={setActualOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        >
          <IconBookmarkPlus className="h-4 w-4" />
          New
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Bookmark</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[70vh] overflow-auto">
          <Label>URL</Label>
          <Input
            value={url}
            required
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://iconical.dev"
          />

          <Label>Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My Favorite Website"
          />

          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The best guy out there"
          />

          <Label>Image URL</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />

          <Label>Auto Snapshot</Label>
          <Select
            value={snapshotMode}
            onValueChange={(value) =>
              setSnapshotMode(normalizeBookmarkSnapshotMode(value))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Snapshot mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="local">Local HTML Snapshot</SelectItem>
              <SelectItem value="internet_archive">
                Internet Archive Only
              </SelectItem>
              <SelectItem value="both">Local + Internet Archive</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Local mode stores an HTML snapshot on the bookmark record. Internet
            Archive mode submits the URL to Wayback.
          </p>

          <Label>Tags</Label>
          <TagInputWithSuggestions
            value={tagsText}
            onChange={setTagsText}
            tagColors={tagColors}
            availableTags={availableTags}
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

          <MaxViewsFields
            currentViews={0}
            maxViews={maxViews}
            onMaxViewsChange={setMaxViews}
            maxViewsAction={maxViewsAction}
            onMaxViewsActionChange={setMaxViewsAction}
          />

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

function ArchiveBookmarkDialog({ row }: { row: DBBookmark }) {
  const [open, setOpen] = useState(false);
  const [waybackStatus, setWaybackStatus] = useState<WaybackStatus>("idle");
  const [waybackSnapshotUrl, setWaybackSnapshotUrl] = useState<string | null>(
    null,
  );

  const archive = useMemo(() => getBookmarkArchiveData(row), [row]);
  const hasLocalSnapshot = Boolean(
    archive.archiveHtml ||
    archive.archiveText ||
    archive.archiveExcerpt ||
    archive.archiveTitle,
  );
  const localStatusLabel = hasLocalSnapshot ? "Saved" : "Missing";
  const showWaybackStatus = waybackStatus !== "idle";
  const waybackStatusLabel =
    waybackStatus === "checking"
      ? "Checking"
      : waybackStatus === "success"
        ? "Available"
        : waybackStatus === "pending"
          ? "Pending"
          : "Not checked";

  const openLocalSnapshot = () => {
    if (!hasLocalSnapshot) {
      toast.error("No local snapshot is saved for this bookmark yet.");
      return;
    }

    const html = buildLocalSnapshotReaderHtml({
      archive,
      sourceUrl: row.url,
      fallbackTitle: row.title || row.url,
    });
    openSnapshotHtmlInNewTab(html);
  };

  const openWaybackSnapshot = async () => {
    if (waybackSnapshotUrl) {
      window.open(waybackSnapshotUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setWaybackStatus("checking");
    const snapshotUrl = await fetchWaybackSnapshotUrl(row.url);

    if (snapshotUrl) {
      setWaybackSnapshotUrl(snapshotUrl);
      setWaybackStatus("success");
      window.open(snapshotUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setWaybackStatus("pending");
    toast.error(
      "Wayback snapshot is not visible yet. It can take a few minutes after submission.",
    );
  };

  const openWaybackCalendar = () => {
    window.open(
      getWaybackCalendarUrl(row.url),
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={(e) => {
            e.preventDefault();
            setOpen((prev) => !prev);
          }}
        >
          <IconArchive className="h-4 w-4" />
          <span>Archive</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Archive</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="rounded-md border p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">Snapshot Status</div>
              <div className="flex flex-wrap items-center gap-2">
                {hasLocalSnapshot ? (
                  <Badge
                    variant="outline"
                    className="text-[11px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  >
                    Local: {localStatusLabel}
                  </Badge>
                ) : null}
                {showWaybackStatus ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px]",
                      waybackStatus === "success"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    IA: {waybackStatusLabel}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {hasLocalSnapshot ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openLocalSnapshot}
                >
                  Open Local Snapshot
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void openWaybackSnapshot()}
                disabled={waybackStatus === "checking"}
              >
                {waybackStatus === "checking" ? (
                  <IconLoader className="h-4 w-4 animate-spin" />
                ) : null}
                {waybackStatus === "checking"
                  ? "Checking Wayback..."
                  : waybackStatus === "success"
                    ? "Open Wayback Snapshot"
                    : "Check Wayback Snapshot"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openWaybackCalendar}
              >
                Wayback Calendar
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Internet Archive can take a little time after submission. Local
              snapshots open in clean reader mode when available. IA status is
              shown after you check it.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditBookmarkDialog({
  row,
  onSaved,
  tagColors,
  availableTags,
}: {
  row: DBBookmark;
  onSaved: () => void;
  tagColors?: Record<string, string | null>;
  availableTags: string[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState<string>(row.title ?? "");
  const [description, setDescription] = useState<string>(row.description ?? "");
  const [imageUrl, setImageUrl] = useState<string>(row.imageUrl ?? "");
  const [slug, setSlug] = useState<string>(row.slug ?? "");
  const [isFavorite, setIsFavorite] = useState<boolean>(
    row.isFavorite ?? false,
  );
  const [isPublic, setIsPublic] = useState<boolean>(row.isPublic ?? false);
  const [password, setPassword] = useState<string>("");
  const [maxViews, setMaxViews] = useState<number | "">(
    typeof row.maxViews === "number" ? row.maxViews : "",
  );
  const [maxViewsAction, setMaxViewsAction] = useState<
    "make_private" | "delete" | ""
  >((row.maxViewsAction as "make_private" | "delete" | null) ?? "");
  const [tagsText, setTagsText] = useState<string>(row.tags?.join(", ") ?? "");

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

      const res = await fetch(bookmarksUrl(`/${row.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          title: title || null,
          description: description || null,
          imageUrl: imageUrl || null,
          slug: slug || null,
          isFavorite,
          isPublic,
          password: password === "" ? undefined : password,
          maxViews: typeof maxViews === "number" ? maxViews : null,
          maxViewsAction: maxViewsAction || null,
          tags: tags,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Update failed");
      toast.success("Bookmark updated");
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
      const res = await fetch(bookmarksUrl(`/${row.id}`), {
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
          variant="ghost"
          className="w-full justify-start"
          onClick={(e) => {
            e.preventDefault();
            setOpen((prev) => !prev);
          }}
        >
          <IconEdit className="h-4 w-4" />
          <span>Edit</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Bookmark</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 max-h-[70vh] overflow-auto pr-1">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />

          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Label>Image URL</Label>
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />

          <Label>Tags</Label>
          <TagInputWithSuggestions
            value={tagsText}
            onChange={setTagsText}
            tagColors={tagColors}
            availableTags={availableTags}
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

          <MaxViewsFields
            currentViews={row.currentViews ?? 0}
            maxViews={maxViews}
            onMaxViewsChange={setMaxViews}
            maxViewsAction={maxViewsAction}
            onMaxViewsActionChange={setMaxViewsAction}
          />

          <Label>Custom Slug</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Leave empty to auto-generate"
          />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving || !title.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
