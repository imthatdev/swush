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
  IconEyeOff,
  IconEye,
  IconFile as FileIcon,
  IconFolder,
  IconLayoutBoardSplitFilled,
  IconMusic as Music2,
  IconPin,
  IconPinFilled,
  IconPlaylist,
  IconRefresh,
  IconTag,
  IconCloudUp,
  IconEyeDotted,
  IconFilterSpark,
  IconStar,
  IconStarFilled,
  IconExternalLink,
} from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Upload } from "@/types";
import { folderNameOf, isSpoilerFile, normalize } from "@/lib/helpers";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
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
import TagFilter from "./TagFilter";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import FileCard from "./FileCard";
import { PaginationFooter } from "../Shared/PaginationFooter";
import { useBulkSelect } from "@/hooks/use-bulk-select";
import { toast } from "sonner";
import { SpoilerOverlay } from "@/components/Common/SpoilerOverlay";
import { User } from "@/types/schema";
import { apiV1, apiV1Path } from "@/lib/api-path";
import { BulkTagsFoldersDialog } from "@/components/Dialogs/BulkTagsFoldersDialog";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { Spinner } from "../ui/spinner";
import { isMedia } from "@/lib/mime-types";
import { usePlayer } from "@/components/Vault/Player/PlayerProvider";
import { useLocalStorageString } from "@/hooks/use-local-storage";
import { VideoPreview } from "./FilePreview";

interface DashboardWrapperProps {
  user: User;
  initialItems: Upload[];
  initialTotal: number;
  initialPage: number;
  initialPageSize: number;
}

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
const CARD_VISIBILITY_STYLE = {
  contentVisibility: "auto",
  containIntrinsicSize: "320px 420px",
} as CSSProperties;

export default function VaultClient({
  user,
  initialItems,
  initialTotal,
  initialPage,
  initialPageSize,
}: DashboardWrapperProps) {
  const router = useRouter();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);

  const searchParams = useSearchParams();
  const focusIdParam = searchParams.get("focusId");
  const initialQ = searchParams.get("q");
  const initialFolder = searchParams.get("folder");
  const initialTagsParam = searchParams.get("tags");
  const initialTagParams = searchParams.getAll("tag");
  const initialTags = [
    ...(initialTagsParam ? initialTagsParam.split(",") : []),
    ...initialTagParams,
  ]
    .map((t) => t.trim())
    .filter(Boolean);
  const initialFav = searchParams.get("favorite");
  const initialKind = searchParams.get("kind");
  const initialVisibility = searchParams.get("visibility");
  const initialSort = searchParams.get("sort");
  const initialGallery = searchParams.get("gallery");
  const didInitFromUrl = useRef(false);
  const didSyncFolderFromPlayer = useRef(false);
  const didFetchFromFilters = useRef(false);

  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [pendingApprovals, setPendingApprovals] = useState<
    Record<string, { requestId: string; itemId: string }>
  >({});
  const [approvalAction, setApprovalAction] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(
    initialFolder || null,
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags || []);
  const [showFavorites, setShowFavorites] = useState(
    initialFav === "1" || false,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [filterKind, setFilterKind] = useState(initialKind || "all");
  const [filterVisibility, setFilterVisibility] = useState<
    "public" | "private" | "all"
  >("all");
  const [pinnedIdsRaw, setPinnedIdsRaw] = useLocalStorageString(
    "vault:pinned",
    "",
  );
  const [pinnedExtras, setPinnedExtras] = useState<Upload[]>([]);
  const [focusItem, setFocusItem] = useState<Upload | null>(null);
  const [pinFlashId, setPinFlashId] = useState<string | null>(null);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<
    {
      contentHash: string;
      total: number;
      items: { id: string; title: string; slug: string }[];
    }[]
  >([]);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagColorMap, setTagColorMap] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [folderColorMap, setFolderColorMap] = useState<
    Map<string, string | null>
  >(new Map());

  const {
    prefs,
    setPrefs,
    savePreferences,
    loading: prefsLoading,
  } = useUserPreferences();
  const [hidePreviews, setHidePreviews] = useState(false);
  const [galleryView, setGalleryView] = useState(false);
  const [revealSpoilers, setRevealSpoilers] = useState(false);
  const [vaultSort, setVaultSort] = useState(prefs.vaultSort);

  const {
    setPlayerOpen,
    setPlayerCollapsed,
    setQueue: setPlayerQueue,
    setIndex: setPlayerIndex,
    selectedFolder: playerSelectedFolder,
    setSelectedFolder: setPlayerSelectedFolder,
    setAvailableFolders: setPlayerAvailableFolders,
    setLoadFolderIntoPlayer,
  } = usePlayer();

  useEffect(() => {
    if (prefsLoading) return;
    setHidePreviews(prefs.hidePreviews ?? false);
    setGalleryView(prefs.vaultView === "grid");
    setRevealSpoilers(prefs.revealSpoilers ?? false);
    setVaultSort(prefs.vaultSort);
    if (prefs.rememberLastFolder && prefs.lastFolder) {
      setSelectedFolder(prefs.lastFolder);
    }
  }, [prefs, prefsLoading]);

  const updatePreferences = useCallback(
    async (patch: Partial<typeof prefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      try {
        await savePreferences(next);
      } catch {
        toast.error("Failed to save preferences");
      }
    },
    [prefs, savePreferences, setPrefs],
  );
  const [pageSize, setPageSize] = useState<number>(
    initialPageSize || PAGE_SIZE_OPTIONS[0],
  );

  useEffect(() => {
    if (didInitFromUrl.current) return;
    didInitFromUrl.current = true;
    if (initialQ) setQuery(initialQ);
    if (initialFolder) setSelectedFolder(initialFolder);
    if (initialTags.length) setSelectedTags(initialTags);
    if (initialFav === "1") setShowFavorites(true);
    if (initialGallery === "1") setGalleryView(true);
    if (initialKind) setFilterKind(initialKind);
    if (initialVisibility)
      setFilterVisibility(initialVisibility as "public" | "private" | "all");
    if (initialSort) {
      const allowedSorts = [
        "newest",
        "oldest",
        "name-asc",
        "name-desc",
        "size-asc",
        "size-desc",
      ] as const;
      if ((allowedSorts as readonly string[]).includes(initialSort)) {
        setVaultSort(initialSort as (typeof allowedSorts)[number]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedFolder !== null) return;
    if (!playerSelectedFolder) return;
    if (didSyncFolderFromPlayer.current) return;
    setSelectedFolder(playerSelectedFolder);
    didSyncFolderFromPlayer.current = true;
  }, [playerSelectedFolder, selectedFolder]);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const loadPendingApprovals = useCallback(async () => {
    try {
      const res = await fetch(apiV1("/upload-requests/queue"), {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json().catch(() => ({}))) as {
        items?: {
          itemId?: string;
          uploadRequestId?: string;
          fileId?: string | null;
        }[];
      };
      const map: Record<string, { requestId: string; itemId: string }> = {};
      for (const item of json.items || []) {
        if (!item.fileId || !item.itemId || !item.uploadRequestId) continue;
        map[item.fileId] = {
          requestId: item.uploadRequestId,
          itemId: item.itemId,
        };
      }
      setPendingApprovals(map);
    } catch {
      // ignore
    }
  }, []);

  const buildListParams = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams();
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (selectedFolder) params.set("folder", selectedFolder);
      if (selectedTags.length)
        params.set("tags", selectedTags.map((t) => t.trim()).join(","));
      if (showFavorites) params.set("favorite", "1");
      if (filterKind !== "all") params.set("kind", filterKind);
      if (filterVisibility !== "all")
        params.set("visibility", filterVisibility);
      if (vaultSort) params.set("sort", vaultSort);
      params.set("page", String(nextPage));
      params.set("pageSize", String(pageSize));
      params.set("paged", "1");
      params.set("fields", "summary");
      params.set("warm", "1");
      return params;
    },
    [
      debouncedQuery,
      filterKind,
      filterVisibility,
      pageSize,
      selectedFolder,
      selectedTags,
      showFavorites,
      vaultSort,
    ],
  );

  const fetchFilesPage = useCallback(
    async (nextPage: number, { silent }: { silent?: boolean } = {}) => {
      if (!silent) setRefreshing(true);
      try {
        const params = buildListParams(nextPage);
        const filesPath = apiV1("/files");
        const res = await fetch(`${filesPath}?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.message || "Failed to load files");
        const nextItems = Array.isArray(json)
          ? json
          : Array.isArray(json.items)
            ? json.items
            : [];
        setItems(nextItems);
        setTotal(
          typeof json.total === "number" ? json.total : nextItems.length,
        );
        setPage(
          typeof json.page === "number" && json.page > 0 ? json.page : nextPage,
        );
        if (typeof json.pageSize === "number" && json.pageSize > 0) {
          setPageSize(json.pageSize);
        }
        await loadPendingApprovals();
      } catch (err) {
        if (!silent) {
          toast.error((err as Error).message || "Failed to load files");
        }
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [buildListParams, loadPendingApprovals],
  );

  async function handleRefresh() {
    await fetchFilesPage(page);
  }

  useEffect(() => {
    void loadPendingApprovals();
  }, [loadPendingApprovals]);

  const filterKey = useMemo(
    () =>
      [
        debouncedQuery.trim().toLowerCase(),
        selectedFolder ?? "",
        selectedTags.map((t) => t.trim().toLowerCase()).join(","),
        showFavorites ? "fav" : "",
        filterKind,
        filterVisibility,
        vaultSort,
        String(pageSize),
      ].join("|"),
    [
      debouncedQuery,
      filterKind,
      filterVisibility,
      pageSize,
      selectedFolder,
      selectedTags,
      showFavorites,
      vaultSort,
    ],
  );

  useEffect(() => {
    if (!didFetchFromFilters.current) {
      didFetchFromFilters.current = true;
      return;
    }
    setPage(1);
    void fetchFilesPage(1);
  }, [fetchFilesPage, filterKey]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      if (nextPage === page) return;
      setPage(nextPage);
      void fetchFilesPage(nextPage);
    },
    [fetchFilesPage, page],
  );

  const handleApprovalAction = async (
    fileId: string,
    action: "approve" | "reject",
  ) => {
    const approval = pendingApprovals[fileId];
    if (!approval) return;
    if (approvalAction) return;
    setApprovalAction(approval.itemId);
    try {
      const res = await fetch(
        apiV1Path(
          "/upload-requests",
          approval.requestId,
          "queue",
          approval.itemId,
        ),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!res.ok) throw new Error("Action failed");
      setPendingApprovals((prev) => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
      if (action === "reject") {
        setItems((prev) => prev.filter((f) => f.id !== fileId));
      }
      toast.success(action === "approve" ? "Approved" : "Rejected");
    } catch (err) {
      toast.error("Approval failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setApprovalAction(null);
    }
  };

  const loadDuplicates = async () => {
    setDuplicatesLoading(true);
    try {
      const res = await fetch(apiV1("/files/duplicates"));
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.message || "Failed to load duplicates");
      setDuplicateGroups(Array.isArray(json.groups) ? json.groups : []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDuplicatesLoading(false);
    }
  };

  const loadFilterOptions = useCallback(async () => {
    try {
      const [foldersRes, tagsRes] = await Promise.all([
        fetch(apiV1("/folders"), { cache: "no-store" }),
        fetch(apiV1("/tags"), { cache: "no-store" }),
      ]);
      const [foldersJson, tagsJson] = await Promise.all([
        foldersRes.json().catch(() => []),
        tagsRes.json().catch(() => []),
      ]);

      if (foldersRes.ok && Array.isArray(foldersJson)) {
        const names = foldersJson
          .map((f) => (typeof f?.name === "string" ? f.name.trim() : ""))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setAvailableFolders(names);
        const map = new Map<string, string | null>();
        for (const f of foldersJson) {
          if (!f?.name) continue;
          const key = normalize(String(f.name));
          map.set(key, typeof f?.color === "string" ? f.color : null);
        }
        setFolderColorMap(map);
      }

      if (tagsRes.ok && Array.isArray(tagsJson)) {
        const names = tagsJson
          .map((t) => (typeof t?.name === "string" ? normalize(t.name) : ""))
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setAvailableTags(names);
        const map = new Map<string, string | null>();
        for (const t of tagsJson) {
          if (!t?.name) continue;
          const key = normalize(String(t.name));
          map.set(key, typeof t?.color === "string" ? t.color : null);
        }
        setTagColorMap(map);
      }
    } catch {
      // Ignore filter fetch failures.
    }
  }, []);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  const audioFolders = useMemo(
    () => availableFolders.slice(),
    [availableFolders],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
    [total, pageSize],
  );

  const resolveKind = useCallback((mime: string, name: string) => {
    const lowerName = name.toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime === "application/pdf") return "pdf";
    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/xml" ||
      mime === "application/javascript" ||
      /\.txt$/i.test(lowerName)
    )
      return "text";
    if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(lowerName)) return "image";
    if (/\.(mp4|webm|mov|mkv|avi|mpeg)$/i.test(lowerName)) return "video";
    if (/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(lowerName)) return "audio";
    if (/\.pdf$/i.test(lowerName)) return "pdf";
    return "other";
  }, []);

  const matchesFilters = useCallback(
    (f: Upload) => {
      const q = debouncedQuery.trim().toLowerCase();
      if (q) {
        const name = f.originalName.toLowerCase();
        const slug = (f.slug ?? "").toLowerCase();
        const desc = (f.description ?? "").toLowerCase();
        if (!name.includes(q) && !slug.includes(q) && !desc.includes(q)) {
          return false;
        }
      }

      if (selectedFolder) {
        const folder = folderNameOf(f)?.toLowerCase() ?? "";
        if (folder !== selectedFolder.toLowerCase()) return false;
      }

      if (selectedTags.length) {
        const tags =
          (f as Partial<{ tags?: (string | { name: string })[] }>).tags ?? [];
        const names = tags
          .map((t) => (typeof t === "string" ? t : t.name))
          .filter(Boolean)
          .map((t) => normalize(t as string));
        if (!selectedTags.some((t) => names.includes(normalize(t)))) {
          return false;
        }
      }

      if (showFavorites && !f.isFavorite) return false;

      if (filterVisibility !== "all") {
        const isPublic = Boolean(f.isPublic);
        if (filterVisibility === "public" && !isPublic) return false;
        if (filterVisibility === "private" && isPublic) return false;
      }

      if (filterKind !== "all") {
        const kind = resolveKind(f.mimeType ?? "", f.originalName ?? "");
        if (
          filterKind === "media"
            ? !["image", "video", "audio"].includes(kind)
            : filterKind !== kind
        ) {
          return false;
        }
      }

      return true;
    },
    [
      debouncedQuery,
      filterKind,
      filterVisibility,
      resolveKind,
      selectedFolder,
      selectedTags,
      showFavorites,
    ],
  );

  const pinnedIds = useMemo(
    () => new Set(pinnedIdsRaw.split(",").filter(Boolean)),
    [pinnedIdsRaw],
  );

  const togglePin = useCallback(
    (id: string) => {
      setPinnedIdsRaw((prev) => {
        const nextSet = new Set(prev.split(",").filter(Boolean));
        if (nextSet.has(id)) nextSet.delete(id);
        else nextSet.add(id);
        return Array.from(nextSet).join(",");
      });
      setPinFlashId(id);
      setTimeout(() => setPinFlashId(null), 650);
    },
    [setPinnedIdsRaw],
  );

  const pinnedFromItems = useMemo(
    () => items.filter((item) => pinnedIds.has(item.id)),
    [items, pinnedIds],
  );

  const pinnedExtrasFiltered = useMemo(() => {
    const existing = new Set(items.map((i) => i.id));
    return pinnedExtras.filter(
      (item) =>
        pinnedIds.has(item.id) &&
        !existing.has(item.id) &&
        matchesFilters(item),
    );
  }, [items, matchesFilters, pinnedExtras, pinnedIds]);

  const pinnedItems = useMemo(
    () => [...pinnedExtrasFiltered, ...pinnedFromItems],
    [pinnedExtrasFiltered, pinnedFromItems],
  );

  const visibleItems = useMemo(() => {
    const pinnedSet = new Set(pinnedItems.map((i) => i.id));
    const base = [...pinnedItems, ...items.filter((i) => !pinnedSet.has(i.id))];
    if (focusItem && !base.some((i) => i.id === focusItem.id)) {
      return [focusItem, ...base];
    }
    return base;
  }, [focusItem, items, pinnedItems]);

  const fetchFileById = useCallback(async (id: string) => {
    try {
      const res = await fetch(apiV1Path("/files", id), {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      if (!json || typeof json.id !== "string") return null;
      return json as Upload;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!pinnedIds.size) {
      setPinnedExtras([]);
      return;
    }
    const existing = new Set(items.map((i) => i.id));
    const missing = Array.from(pinnedIds).filter((id) => !existing.has(id));
    if (missing.length === 0) {
      setPinnedExtras([]);
      return;
    }
    let active = true;
    Promise.all(missing.map((id) => fetchFileById(id)))
      .then((rows) => {
        if (!active) return;
        const filtered = rows
          .filter((row): row is Upload => !!row)
          .filter((row) => matchesFilters(row));
        setPinnedExtras(filtered);
      })
      .catch(() => {
        if (!active) return;
        setPinnedExtras([]);
      });
    return () => {
      active = false;
    };
  }, [fetchFileById, items, matchesFilters, pinnedIds]);

  useEffect(() => {
    if (!focusIdParam) {
      setFocusItem(null);
      return;
    }
    if (pinnedIds.has(focusIdParam)) return;
    if (items.some((i) => i.id === focusIdParam)) {
      setFocusItem(null);
      return;
    }
    let active = true;
    fetchFileById(focusIdParam).then((row) => {
      if (!active) return;
      if (!row || !matchesFilters(row)) {
        setFocusItem(null);
        return;
      }
      setFocusItem(row);
    });
    return () => {
      active = false;
    };
  }, [fetchFileById, focusIdParam, items, matchesFilters, pinnedIds]);

  const {
    selectedIds,
    isSelected,
    toggleOne,
    togglePage,
    selectRange,
    clear,
    count,
    performBulk,
  } = useBulkSelect();
  const selectedCount = count;
  const lastSelectedIndexRef = useRef<number | null>(null);
  const clearSelection = clear;

  const toggleAllOnPage = () => togglePage(visibleItems.map((f) => f.id));
  const handleCardToggle = (
    id: string,
    index: number,
    e?: React.MouseEvent | React.KeyboardEvent,
  ) => {
    const isShift = Boolean(e?.shiftKey);
    const isCtrl = Boolean(e?.metaKey || e?.ctrlKey);
    const firstSelectedId = selectedIds[0];
    const firstSelectedIndex = firstSelectedId
      ? visibleItems.findIndex((f) => f.id === firstSelectedId)
      : -1;
    const anchorIndex =
      firstSelectedIndex >= 0
        ? firstSelectedIndex
        : lastSelectedIndexRef.current;

    if (isShift && anchorIndex !== null) {
      const start = Math.min(anchorIndex, index);
      const end = Math.max(anchorIndex, index);
      const rangeIds = visibleItems.slice(start, end + 1).map((f) => f.id);
      selectRange(rangeIds, { additive: isCtrl });
      lastSelectedIndexRef.current = index;
      return;
    }
    lastSelectedIndexRef.current = index;
    toggleOne(id);
  };

  useEffect(() => {
    if (!prefs.rememberLastFolder) return;
    const timer = setTimeout(() => {
      void updatePreferences({ lastFolder: selectedFolder });
    }, 10000);
    return () => clearTimeout(timer);
  }, [prefs.rememberLastFolder, selectedFolder, updatePreferences]);

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusIdParam) return;
    const el = cardRefs.current[focusIdParam];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setFlashId(focusIdParam);
      const t = setTimeout(() => setFlashId(null), 1600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIdParam, visibleItems.map((x) => x.id).join(","), page]);

  useEffect(() => {
    if (!didInitFromUrl.current) return;
    const sp = new URLSearchParams();
    if (debouncedQuery.trim()) sp.set("q", debouncedQuery.trim());
    if (selectedFolder) sp.set("folder", selectedFolder);
    if (selectedTags.length)
      sp.set("tags", selectedTags.map((t) => t.trim()).join(","));
    if (showFavorites) sp.set("favorite", "1");
    if (filterKind !== "all") sp.set("kind", filterKind);
    if (filterVisibility !== "all") sp.set("visibility", filterVisibility);
    if (vaultSort) sp.set("sort", vaultSort);
    if (galleryView) sp.set("gallery", "1");
    if (pageSize) sp.set("pageSize", String(pageSize));
    if (page > 1) sp.set("page", String(page));
    if (focusIdParam) sp.set("focusId", focusIdParam);
    router.replace(`/vault${sp.toString() ? `?${sp.toString()}` : ""}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    selectedFolder,
    selectedTags,
    showFavorites,
    pageSize,
    page,
    galleryView,
    filterKind,
    filterVisibility,
    vaultSort,
    focusIdParam,
  ]);

  const [deleting, setDeleting] = useState(false);
  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const toDelete = [...selectedIds];

    setDeleting(true);
    toast.loading("Deleting files...");
    try {
      const { ok, fail } = await performBulk(toDelete, async (id) =>
        fetch(apiV1Path("/files", id), { method: "DELETE" }),
      );
      toast.dismiss();
      setItems((prev) => prev.filter((f) => !toDelete.includes(f.id)));
      if (fail.length) {
        toast.error(`Deleted ${ok}/${toDelete.length}.`, {
          description: fail[0]?.error || "Some deletions failed.",
        });
      } else {
        toast.success(`Deleted ${ok} file${ok === 1 ? "" : "s"}.`);
      }
    } finally {
      setDeleting(false);
      clearSelection();
      await handleRefresh();
    }
  };

  const bulkSetVisibility = async (nextPublic: boolean) => {
    if (selectedIds.length === 0) return;
    const targets = [...selectedIds];
    try {
      const { ok, fail } = await performBulk(targets, async (id) =>
        fetch(apiV1Path("/files", id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: nextPublic }),
        }),
      );
      if (fail.length) {
        toast.error(`Updated ${ok}/${targets.length}.`, {
          description: fail[0]?.error || "Some updates failed.",
        });
      } else {
        toast.success(
          `${nextPublic ? "Public" : "Private"} set for ${ok} file${
            ok === 1 ? "" : "s"
          }.`,
        );
      }
    } finally {
      clearSelection();
      await handleRefresh();
    }
  };

  const bulkApplyTagsFolder = async (payload: {
    folderId?: string | null;
    addTagIds?: string[];
  }) => {
    if (selectedIds.length === 0) return;
    const targets = [...selectedIds];
    try {
      const { ok, fail } = await performBulk(targets, async (id) =>
        fetch(apiV1Path("/files", id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
      );
      if (fail.length) {
        toast.error(`Updated ${ok}/${targets.length}.`, {
          description: fail[0]?.error || "Some updates failed.",
        });
      } else {
        toast.success(`Updated ${ok} file${ok === 1 ? "" : "s"}.`);
      }
    } finally {
      clearSelection();
      await handleRefresh();
    }
  };

  const fetchAudioQueue = useCallback(
    async (folder: string | null) => {
      const pageSize = 200;
      const maxPages = 10;
      let pageCursor = 1;
      let collected: Upload[] = [];
      let totalCount = 0;

      while (pageCursor <= maxPages) {
        const params = new URLSearchParams();
        params.set("kind", "audio");
        params.set("page", String(pageCursor));
        params.set("pageSize", String(pageSize));
        params.set("paged", "1");
        params.set("fields", "summary");
        if (folder) params.set("folder", folder);
        if (vaultSort) params.set("sort", vaultSort);

        const filesPath = apiV1("/files");
        const res = await fetch(`${filesPath}?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) break;
        const pageItems = Array.isArray(json.items) ? json.items : [];
        totalCount = typeof json.total === "number" ? json.total : totalCount;
        collected = collected.concat(pageItems as Upload[]);
        if (pageItems.length === 0) break;
        if (totalCount && collected.length >= totalCount) break;
        pageCursor += 1;
      }

      return collected;
    },
    [vaultSort],
  );

  const loadFolderIntoPlayer = useCallback(
    async (folder: string | null) => {
      setSelectedFolder(folder);
      setPlayerSelectedFolder(folder);
      const q = await fetchAudioQueue(folder);
      if (q.length === 0) {
        setPlayerQueue([]);
        setPlayerIndex(0);
        toast.message("No audio in this folder", {
          description: "Pick a folder with MP3/WAV files.",
        });
        return;
      }
      setPlayerQueue(q);
      setPlayerIndex(0);
    },
    [
      fetchAudioQueue,
      setPlayerIndex,
      setPlayerQueue,
      setPlayerSelectedFolder,
      setSelectedFolder,
    ],
  );

  const openFolderInPlayer = () => {
    loadFolderIntoPlayer(selectedFolder);
    setPlayerCollapsed(false);
    setPlayerOpen(true);
  };

  useEffect(() => {
    if (selectedFolder === null && playerSelectedFolder) return;
    setPlayerSelectedFolder(selectedFolder);
  }, [playerSelectedFolder, selectedFolder, setPlayerSelectedFolder]);

  useEffect(() => {
    setPlayerAvailableFolders(audioFolders);
  }, [audioFolders, setPlayerAvailableFolders]);

  useEffect(() => {
    setLoadFolderIntoPlayer(loadFolderIntoPlayer);
    return () => setLoadFolderIntoPlayer(null);
  }, [loadFolderIntoPlayer, setLoadFolderIntoPlayer]);

  return (
    <PageLayout
      className="h-auto! overflow-visible!"
      title={`Welcome back, ${user?.name ? user.name : user.username} 👋`}
      subtitle="Here’s your stash."
      headerActions={
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={openFolderInPlayer}
            className="gap-2 whitespace-nowrap"
          >
            <IconPlaylist className="h-4 w-4" />
          </Button>
          <Button
            variant={galleryView ? "default" : "outline"}
            onClick={() => {
              const next = !galleryView;
              setGalleryView(next);
            }}
            className="whitespace-nowrap"
          >
            <IconLayoutBoardSplitFilled className="h-4 w-4" />
          </Button>
        </>
      }
      toolbar={
        <>
          <Input
            placeholder="Search by name, description, type or slug…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            id="search-vault"
            className="w-full"
          />

          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters((v) => !v)}
            className="whitespace-nowrap"
            aria-expanded={showFilters}
            aria-controls="vault-filters"
          >
            <IconFilterSpark />
          </Button>

          <Button
            variant={refreshing ? "ghost" : "outline"}
            disabled={refreshing}
            onClick={handleRefresh}
            className="gap-2"
          >
            <IconRefresh
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>

          <Button className="gap-2" onClick={() => router.push("/upload")}>
            <IconCloudUp className="h-4 w-4" />
            Upload
          </Button>
        </>
      }
    >
      {showFilters && (
        <FilterPanel id="vault-filters">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedFolder ?? "__all__"}
              onValueChange={(val) => {
                didSyncFolderFromPlayer.current = true;
                setSelectedFolder(val === "__all__" ? null : val);
              }}
            >
              <SelectTrigger className="min-w-40">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All folders</SelectItem>
                {availableFolders.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <TagFilter
              availableTags={availableTags}
              selectedTags={selectedTags}
              onChange={setSelectedTags}
            />

            <Button
              variant={showFavorites ? "default" : "outline"}
              onClick={() => setShowFavorites((prev) => !prev)}
            >
              {showFavorites ? <IconStarFilled /> : <IconStar />}
            </Button>

            <Select
              value={filterKind}
              onValueChange={(value) => setFilterKind(value)}
            >
              <SelectTrigger className="rounded-md text-sm px-2 min-w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filterVisibility}
              onValueChange={(value) =>
                setFilterVisibility(value as "public" | "private" | "all")
              }
            >
              <SelectTrigger className="rounded-md text-sm px-2 min-w-32">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibility</SelectItem>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setDuplicatesOpen(true);
                void loadDuplicates();
              }}
            >
              Duplicates
            </Button>

            <Select
              value={vaultSort}
              onValueChange={(value) => {
                const next = value as typeof vaultSort;
                setVaultSort(next);
              }}
            >
              <SelectTrigger className="rounded-md text-sm px-2 min-w-36">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name-asc">Name (A–Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z–A)</SelectItem>
                <SelectItem value="size-desc">Size (largest)</SelectItem>
                <SelectItem value="size-asc">Size (smallest)</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="rounded-md text-sm px-2 min-w-30">
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
              variant={hidePreviews ? "default" : "outline"}
              onClick={() => {
                const next = !hidePreviews;
                setHidePreviews(next);
              }}
              className="whitespace-nowrap"
            >
              {hidePreviews ? <IconEyeOff /> : <IconEyeDotted />} Previews
            </Button>
            <Button
              variant={revealSpoilers ? "default" : "outline"}
              onClick={() => {
                const next = !revealSpoilers;
                setRevealSpoilers(next);
              }}
              className="whitespace-nowrap"
            >
              {revealSpoilers ? <IconEyeOff /> : <IconEyeDotted />} Spoilers
            </Button>
          </div>
        </FilterPanel>
      )}

      <Dialog open={duplicatesOpen} onOpenChange={setDuplicatesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate files</DialogTitle>
          </DialogHeader>
          {duplicatesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="h-4 w-4" /> Loading duplicates...
            </div>
          ) : duplicateGroups.length ? (
            <div className="space-y-4 max-h-[50vh] overflow-auto">
              {duplicateGroups.map((group) => (
                <div key={group.contentHash} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {group.total} duplicates
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearSelection();
                        selectRange(
                          group.items.map((i) => i.id),
                          {
                            additive: false,
                          },
                        );
                        setDuplicatesOpen(false);
                      }}
                    >
                      Select group
                    </Button>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {group.items.map((item) => (
                      <li key={item.id} className="truncate">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1"
                          onClick={() => router.push(`/v/${item.slug}`)}
                        >
                          {item.title}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">No duplicates found.</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicatesOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {(selectedFolder || selectedTags.length > 0) && (
        <div className="flex flex-wrap gap-2 items-center mb-2">
          {selectedFolder &&
            (() => {
              const folderColor = folderColorMap.get(normalize(selectedFolder));
              const folderStyles = getBadgeColorStyles(folderColor);
              return (
                <Badge
                  className={cn(
                    "gap-1",
                    folderStyles?.className ?? "bg-primary",
                  )}
                  style={folderStyles?.style}
                >
                  <IconFolder size={12} /> {selectedFolder}
                </Badge>
              );
            })()}
          {selectedTags.map((t) => {
            const tagStyles = getBadgeColorStyles(
              tagColorMap.get(normalize(t)),
            );
            return (
              <Badge
                key={t}
                variant="outline"
                className={cn("gap-1", tagStyles?.className)}
                style={tagStyles?.style}
              >
                <IconTag size={12} /> {t}
              </Badge>
            );
          })}
        </div>
      )}

      <SelectionBar
        count={selectedCount}
        className="sticky top-2 z-40 bg-muted/95 shadow-sm backdrop-blur supports-backdrop-filter:bg-muted/80"
      >
        <Button
          variant="outline"
          onClick={() => toggleAllOnPage()}
          disabled={visibleItems.length === 0}
          size="sm"
        >
          Select Page ({visibleItems.length})
        </Button>
        <Button variant="outline" size="sm" onClick={clearSelection}>
          Clear
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBulkEditOpen(true)}
        >
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkSetVisibility(true)}
          className="gap-2"
        >
          <IconEye className="h-4 w-4" />
          Make Public
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => bulkSetVisibility(false)}
          className="gap-2"
        >
          <IconEyeOff className="h-4 w-4" />
          Make Private
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={deleting}>
              {deleting ? (
                <span className="flex items-center gap-2">
                  <Spinner />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selectedCount} selected file
                {selectedCount === 1 ? "" : "s"}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={bulkDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SelectionBar>

      <BulkTagsFoldersDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedCount={selectedCount}
        onApply={bulkApplyTagsFolder}
      />

      {visibleItems.length === 0 && pinnedItems.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground text-center">
            No files found matching your criteria.
          </p>
        </div>
      )}

      {galleryView ? (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [column-fill:balance] max-w-[90vw]">
          {visibleItems.map((file) => {
            const rawSrc = `/x/${encodeURIComponent(file.slug)}`;
            const previewSrc = `${rawSrc}.png`;
            return (
              <div
                key={file.id}
                ref={(el) => {
                  cardRefs.current[file.id] = el;
                }}
                onClick={() => {
                  if (
                    isMedia("video", file.mimeType, file.originalName) ||
                    isMedia("image", file.mimeType, file.originalName)
                  ) {
                    return;
                  } else {
                    router.push(`/v/${file.slug}`);
                  }
                }}
                style={CARD_VISIBILITY_STYLE}
                className={cn(
                  "mb-4 break-inside-avoid overflow-hidden rounded-md cursor-pointer relative",
                  flashId === file.id &&
                    "ring-2 ring-primary shadow-[0_0_0_4px_var(--primary-a9)]",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground",
                    pinFlashId === file.id && "animate-wiggle",
                    pinnedIds.has(file.id) && "text-primary",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(file.id);
                  }}
                  aria-label={
                    pinnedIds.has(file.id) ? "Unpin file" : "Pin file"
                  }
                >
                  {pinnedIds.has(file.id) ? (
                    <IconPinFilled className="h-4 w-4" />
                  ) : (
                    <IconPin className="h-4 w-4" />
                  )}
                </button>
                <button
                  type="button"
                  className={cn(
                    "absolute left-2 top-2 z-10 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/v/${file.slug}`);
                  }}
                  aria-label={"Open file"}
                >
                  <IconExternalLink className="h-4 w-4" />
                </button>
                <SpoilerOverlay
                  active={isSpoilerFile(file)}
                  alwaysReveal={revealSpoilers}
                  resetKey={file.id}
                >
                  {isMedia("image", file.mimeType, file.originalName) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewSrc}
                      alt={file.originalName}
                      className="w-full h-auto object-contain"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.dataset.fallback === "1") return;
                        target.dataset.fallback = "1";
                        target.src = rawSrc;
                      }}
                    />
                  ) : isMedia("video", file.mimeType, file.originalName) ? (
                    <div className="flex w-full items-center justify-center bg-muted aspect-video">
                      <VideoPreview
                        src={rawSrc}
                        previewSrc={`${rawSrc}.png`}
                        hlsSrc={`/hls/${encodeURIComponent(file.slug)}/index.m3u8`}
                        mime={file.mimeType}
                        name={file.originalName}
                        disableInteraction={selectedCount > 0}
                      />
                    </div>
                  ) : isMedia("audio", file.mimeType, file.originalName) ? (
                    <div className="flex w-full items-center justify-center bg-muted aspect-video">
                      <Music2 className="h-10 w-10 opacity-70" />
                    </div>
                  ) : (
                    <div className="flex w-full items-center justify-center bg-muted aspect-video">
                      <FileIcon className="h-10 w-10 opacity-70" />
                    </div>
                  )}
                </SpoilerOverlay>
                {pendingApprovals[file.id] ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
                    <div className="flex items-center gap-2 pointer-events-auto">
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleApprovalAction(file.id, "approve");
                        }}
                        disabled={
                          approvalAction === pendingApprovals[file.id]?.itemId
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleApprovalAction(file.id, "reject");
                        }}
                        disabled={
                          approvalAction === pendingApprovals[file.id]?.itemId
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {visibleItems.map((file, idx) => (
            <div
              key={file.id}
              ref={(el) => {
                cardRefs.current[file.id] = el;
              }}
              style={CARD_VISIBILITY_STYLE}
              className={cn(
                flashId === file.id && "ring-2 ring-primary rounded-md ",
              )}
            >
              <FileCard
                file={file}
                index={idx}
                selected={isSelected(file.id)}
                onToggle={(e) => handleCardToggle(file.id, idx, e)}
                enableCardSelection={selectedCount > 0}
                revealSpoilers={revealSpoilers}
                hidePreviews={hidePreviews}
                openInNewTab={prefs.openSharedInNewTab}
                hidePublicShareConfirmations={
                  prefs.hidePublicShareConfirmations
                }
                sizeFormat={prefs.sizeFormat}
                setItems={setItems}
                isPinned={pinnedIds.has(file.id)}
                pinFlash={pinFlashId === file.id}
                onTogglePin={() => togglePin(file.id)}
                approval={pendingApprovals[file.id] ?? null}
                approvalLoading={
                  approvalAction === pendingApprovals[file.id]?.itemId
                }
                onApprove={() => handleApprovalAction(file.id, "approve")}
                onReject={() => handleApprovalAction(file.id, "reject")}
              />
            </div>
          ))}
        </div>
      )}

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </PageLayout>
  );
}
