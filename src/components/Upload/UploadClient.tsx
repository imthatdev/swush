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

import { useState, useEffect, useRef, useMemo } from "react";
import type { SetStateAction } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderMeta, TagMeta } from "@/types";
import { normalizeTag } from "@/components/Upload/FolderInputWithSuggestions";
import { formatBytes, splitFilename } from "@/lib/helpers";
import PageLayout from "@/components/Common/PageLayout";
import { apiV1 } from "@/lib/api-path";
import type {
  ChunkInitResponse,
  UploadApiResponse,
  UploadItem,
  UploadPayload,
} from "@/components/Upload/types";
import UploadDropzone from "@/components/Upload/UploadDropzone";
import UploadQueue from "@/components/Upload/UploadQueue";
import UploadEditDialog from "@/components/Upload/UploadEditDialog";
import UploadBulkDialog from "@/components/Upload/UploadBulkDialog";
import { useUploadSummary } from "@/hooks/use-upload-summary";
import type { NameConvention, SlugConvention } from "@/lib/upload-conventions";
import { useUserFeatures } from "@/hooks/use-user-features";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import RemoteUploadDialog from "../RemoteUploadDialog";
import { IconUpload, IconWorldUpload } from "@tabler/icons-react";
import type { Summary } from "@/components/Upload/types";
import { getApiErrorMessage } from "@/lib/client/api-error";
import { MaxViewsAction } from "@/lib/server/max-views";
import { cn } from "@/lib/utils";
import Link from "next/link";

const DEFAULT_NAME_CONVENTION: NameConvention = "original";
const DEFAULT_SLUG_CONVENTION: SlugConvention = "funny";
const KEEP_CONVENTION = "keep" as const;

export default function UploadClient() {
  const [remoteDialogOpen, setRemoteDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [maxViews, setMaxViews] = useState<number | "">("");
  const [maxViewsAction, setMaxViewsAction] = useState<
    "make_private" | "delete" | ""
  >("");
  const [folderName, setFolderName] = useState("");
  const [vanitySlug, setVanitySlug] = useState("");
  const [lockedExt, setLockedExt] = useState("");
  const [nameConvention, setNameConvention] = useState<NameConvention>(
    DEFAULT_NAME_CONVENTION,
  );
  const [slugConvention, setSlugConvention] = useState<SlugConvention>(
    DEFAULT_SLUG_CONVENTION,
  );
  const [defaultNameConvention, setDefaultNameConvention] =
    useState<NameConvention>(DEFAULT_NAME_CONVENTION);
  const [defaultSlugConvention, setDefaultSlugConvention] =
    useState<SlugConvention>(DEFAULT_SLUG_CONVENTION);
  const {
    maxUploadMb,
    maxFilesPerUpload,
    remainingQuotaMb,
    filesRemaining,
    maxStorageMb,
    remainingStorageMb,
    usedTodayBytes,
    usedStorageBytes,
    allowRemoteUpload,
    apply: applySummary,
  } = useUploadSummary();
  const { appUrl, uploadChunkThresholdMb } = useAppConfig();

  const { prefs, loading: prefsLoading } = useUserPreferences();
  const { features, loading: featuresLoading } = useUserFeatures();
  const filesEnabled = features.files?.isEnabled ?? true;
  const [summaryReady, setSummaryReady] = useState(false);

  const toMb = (bytes: number) => Math.round((bytes || 0) / 1_000_000);
  const formatMbWhole = (mb: number) => `${Math.round(mb)} MB`;
  const effectiveRemainingStorageMb = useMemo(() => {
    if (typeof remainingStorageMb === "number") return remainingStorageMb;
    if (typeof maxStorageMb === "number") {
      const usedMb = toMb(usedStorageBytes);
      return Math.max(0, maxStorageMb - usedMb);
    }
    return null;
  }, [remainingStorageMb, maxStorageMb, usedStorageBytes]);

  const pendingCount = useMemo(
    () => files.filter((f) => !f.uploaded).length,
    [files],
  );
  const uploadedCount = useMemo(
    () => files.filter((f) => f.uploaded).length,
    [files],
  );

  const [isUploading, setIsUploading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMakePublic, setBulkMakePublic] = useState(false);
  const [bulkExpireAt, setBulkExpireAt] = useState<string>("");
  const [bulkFolder, setBulkFolder] = useState("");
  const [bulkFolderFocused, setBulkFolderFocused] = useState(false);
  const [bulkNameConvention, setBulkNameConvention] = useState<
    NameConvention | typeof KEEP_CONVENTION
  >(KEEP_CONVENTION);
  const [bulkSlugConvention, setBulkSlugConvention] = useState<
    SlugConvention | typeof KEEP_CONVENTION
  >(KEEP_CONVENTION);

  const [bulkTagsChips, setBulkTagsChips] = useState<string[]>([]);
  const [bulkTagDraft, setBulkTagDraft] = useState("");
  const [bulkTagsFocused, setBulkTagsFocused] = useState(false);

  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const [tags, setTags] = useState<TagMeta[]>([]);
  const [folderFocused, setFolderFocused] = useState(false);

  const [tagsChips, setTagsChips] = useState<string[]>([]);

  const visibilityTouched = useRef(false);
  const folderTouched = useRef(false);
  const tagsTouched = useRef(false);

  const setIsPublicWithTouch = (value: boolean) => {
    visibilityTouched.current = true;
    setIsPublic(value);
  };
  const setFolderNameWithTouch = (value: string) => {
    folderTouched.current = true;
    let folder = value;
    if (folder.trim().toLowerCase() === "mfis") folder = "Mfis";
    setFolderName(folder);
  };
  const setTagsWithTouch = (value: SetStateAction<string[]>) => {
    tagsTouched.current = true;
    setTagsChips(value);
  };

  useEffect(() => {
    if (prefsLoading || visibilityTouched.current) return;
    if (editingFileIndex !== null) return;
    setIsPublic(prefs.defaultUploadVisibility === "public");
  }, [prefs, prefsLoading, editingFileIndex]);

  useEffect(() => {
    if (prefsLoading) return;
    if (editingFileIndex !== null) return;
    if (!folderTouched.current) {
      let folder = prefs.defaultUploadFolder ?? "";
      if (folder.trim().toLowerCase() === "mfis") folder = "Mfis";
      setFolderName(folder);
    }
    if (!tagsTouched.current) {
      setTagsChips(prefs.defaultUploadTags ?? []);
    }
  }, [prefs, prefsLoading, editingFileIndex]);
  const [tagDraft, setTagDraft] = useState("");
  const [tagsFocused, setTagsFocused] = useState(false);

  const CHUNKED_UPLOAD_THRESHOLD_MB =
    Number.isFinite(uploadChunkThresholdMb) && uploadChunkThresholdMb > 0
      ? uploadChunkThresholdMb
      : 95;
  const CHUNKED_CONCURRENCY = 3;

  const folderIdByName = useMemo(() => {
    return new Map(
      folders.map((f) => [f.name.trim().toLowerCase(), f.id] as const),
    );
  }, [folders]);

  const tagIdByName = useMemo(() => {
    return new Map(
      tags.map((t) => [t.name.trim().toLowerCase(), t.id] as const),
    );
  }, [tags]);

  const previewUrls = useRef<Map<File, string>>(new Map());
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const lastPasteAtRef = useRef<number>(0);

  const displayName = (item: UploadItem) =>
    item.customName?.trim() || item.file.name;

  function makePastedName(mime: string) {
    const ext = mime.split("/")[1] || "png";
    const ts = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    return `pasted-${ts}.${ext}`;
  }

  function extractImageFilesFromClipboard(
    ev: ClipboardEvent | React.ClipboardEvent,
  ): File[] {
    const dt =
      "clipboardData" in ev
        ? ev.clipboardData
        : (ev as ClipboardEvent).clipboardData;
    if (!dt) return [];

    const out: File[] = [];
    const items = Array.from(dt.items || []);
    for (const it of items) {
      if (it.kind === "file" && it.type.startsWith("image/")) {
        const f = it.getAsFile();
        if (f) {
          const named =
            f.name && f.name.trim().length > 0
              ? f
              : new File([f], makePastedName(f.type), {
                  type: f.type,
                  lastModified: Date.now(),
                });
          out.push(named);
        }
      }
    }

    if (out.length === 0 && dt.files && dt.files.length) {
      for (const f of Array.from(dt.files)) {
        if (f.type.startsWith("image/")) {
          const named =
            f.name && f.name.trim().length > 0
              ? f
              : new File([f], makePastedName(f.type), {
                  type: f.type,
                  lastModified: Date.now(),
                });
          out.push(named);
        }
      }
    }

    return out;
  }

  const handlePasteReact = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!filesEnabled) {
      toast.error(
        "Files are disabled. Manage this in Settings → Features. If disabled by an admin, contact them.",
      );
      return;
    }
    const now = Date.now();
    if (now - lastPasteAtRef.current < 200) return;
    const imgs = extractImageFilesFromClipboard(e);
    if (imgs.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    lastPasteAtRef.current = now;
    addFilesToQueue(imgs);
    toast.success(
      `${imgs.length} image${imgs.length > 1 ? "s" : ""} added from clipboard`,
    );
  };

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      if (!filesEnabled) return;
      const target = e.target as HTMLElement | null;
      if (
        dropZoneRef.current &&
        target &&
        dropZoneRef.current.contains(target)
      ) {
        return;
      }

      const tag = (target?.tagName || "").toLowerCase();
      const isTyping =
        tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isTyping) return;

      const now = Date.now();
      if (now - lastPasteAtRef.current < 200) return;

      const imgs = extractImageFilesFromClipboard(e);
      if (imgs.length === 0) return;

      e.preventDefault();
      lastPasteAtRef.current = now;
      addFilesToQueue(imgs);
      toast.success(
        `${imgs.length} image${imgs.length > 1 ? "s" : ""} added from clipboard`,
      );
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesEnabled]);

  const addFilesToQueue = (incoming: File[]) => {
    if (!filesEnabled) {
      toast.error(
        "Files are disabled. Manage this in Settings → Features. If disabled by an admin, contact them.",
      );
      return;
    }
    if (incoming.length === 0) return;

    let filtered = incoming;
    if (typeof maxUploadMb === "number" && maxUploadMb > 0) {
      const capBytes = maxUploadMb * 1_000_000;
      const rejected = incoming.filter((f) => f.size > capBytes);
      filtered = incoming.filter((f) => f.size <= capBytes);

      if (rejected.length > 0) {
        const names = rejected
          .map((f) => `${f.name} (${formatBytes(f.size)})`)
          .join(", ");
        toast.error(
          `These files exceed the ${maxUploadMb} MB limit and were skipped: ${names}`,
        );
      }
    }

    if (typeof maxFilesPerUpload === "number" && maxFilesPerUpload > 0) {
      const currentPending = files.filter((f) => !f.uploaded).length;
      const remainingSlots = Math.max(0, maxFilesPerUpload - currentPending);

      if (remainingSlots === 0) {
        toast.error(
          `You already have ${currentPending} file(s) in queue. Max is ${maxFilesPerUpload}.`,
        );
        return;
      }

      if (filtered.length > remainingSlots) {
        toast.error(
          `Only ${remainingSlots} more file(s) allowed (max ${maxFilesPerUpload} per upload). Extra files were skipped.`,
        );
        filtered = filtered.slice(0, remainingSlots);
      }
    }

    if (filtered.length === 0) return;

    const wrappedFiles = filtered.map((file) => {
      previewUrls.current.set(file, URL.createObjectURL(file));
      let folder = prefs.defaultUploadFolder ?? "";
      if (folder.trim().toLowerCase() === "mfis") folder = "Mfis";
      return {
        file,
        customName: "",
        nameOverride: false,
        nameConvention: defaultNameConvention,
        slugConvention: defaultSlugConvention,
        description: "",
        isPublic: false,
        views: 0,
        maxViews: null,
        maxViewsAction: "" as MaxViewsAction,
        folderName: folder,
        tags: prefs.defaultUploadTags ?? [],
        vanitySlug: "",
        progress: 0,
      };
    });

    setFiles((prev) => [...prev, ...wrappedFiles]);
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(apiV1("/profile/summary"), {
        method: "GET",
      });
      if (!res.ok) return;
      const raw = (await res.json()) as Summary;
      applySummary(raw);
    } catch {
      toast.error("Failed to load user summary");
    }
  };

  useEffect(() => {
    if (editingFileIndex === null) return;

    const f = files[editingFileIndex];
    if (!f) return;

    setOpen(true);

    const { ext } = splitFilename(f.file.name);
    const nameBase =
      f.nameOverride && f.customName ? splitFilename(f.customName).base : "";
    setCustomName(nameBase);
    setLockedExt(ext);
    setDescription(f.description);
    setIsPublic(f.isPublic);
    setMaxViews(typeof f.maxViews === "number" ? f.maxViews : "");
    setMaxViewsAction(f.maxViewsAction || "");
    setFolderName(f.folderName || "");
    setVanitySlug(f.vanitySlug || "");
    setTagsChips(Array.from(new Set((f.tags || []).map(normalizeTag))));
    setNameConvention(
      (f.nameConvention as NameConvention) || defaultNameConvention,
    );
    setSlugConvention(
      (f.slugConvention as SlugConvention) || defaultSlugConvention,
    );
  }, [editingFileIndex, files, defaultNameConvention, defaultSlugConvention]);

  useEffect(() => {
    (async () => {
      try {
        const [fRes, tRes] = await Promise.all([
          fetch(apiV1("/folders"), { cache: "no-store" }),
          fetch(apiV1("/tags"), { cache: "no-store" }),
        ]);
        const fData: FolderMeta[] = fRes.ok ? await fRes.json() : [];
        const tData: TagMeta[] = tRes.ok ? await tRes.json() : [];
        setFolders(Array.isArray(fData) ? fData : []);
        setTags(Array.isArray(tData) ? tData : []);
      } catch {
        toast.error("Failed to load folders/tags");
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    const loadDefaults = async () => {
      try {
        const res = await fetch(apiV1("/profile/upload-settings"), {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          settings?: {
            nameConvention?: NameConvention;
            slugConvention?: SlugConvention;
          };
        };
        if (!active || !data?.settings) return;
        setDefaultNameConvention(
          data.settings.nameConvention || DEFAULT_NAME_CONVENTION,
        );
        setDefaultSlugConvention(
          data.settings.slugConvention || DEFAULT_SLUG_CONVENTION,
        );
      } catch {
        toast.error("Failed to load upload settings");
      }
    };
    loadDefaults();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setFiles((prev) =>
      prev.map((file) => ({
        ...file,
        nameConvention: file.nameConvention ?? defaultNameConvention,
        slugConvention: file.slugConvention ?? defaultSlugConvention,
      })),
    );
  }, [defaultNameConvention, defaultSlugConvention]);

  useEffect(() => {
    let active = true;
    const initSummary = async () => {
      await fetchSummary();
      if (active) setSummaryReady(true);
    };
    void initSummary();

    return () => {
      active = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (summaryReady) return;
    if (featuresLoading) return;
    setSummaryReady(true);
  }, [featuresLoading, summaryReady]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!filesEnabled) {
      toast.error(
        "Files are disabled. Manage this in Settings → Features. If disabled by an admin, contact them.",
      );
      return;
    }
    const selected = e.target.files;
    if (!selected || selected.length === 0) return;
    addFilesToQueue(Array.from(selected));
  };

  const updateFileAt = (
    idx: number,
    patch: Partial<UploadItem> | ((prev: UploadItem) => Partial<UploadItem>),
  ) => {
    setFiles((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (!current) return prev;
      const update = typeof patch === "function" ? patch(current) : patch;
      next[idx] = { ...current, ...update };
      return next;
    });
  };

  const buildUploadPayload = (current: UploadItem) => {
    const folderNameNorm = (current.folderName || "").trim().toLowerCase();
    const folderId = folderNameNorm
      ? folderIdByName.get(folderNameNorm)
      : undefined;

    const inputTagNames = (current.tags ?? [])
      .map((t: string) => normalizeTag(t))
      .filter(Boolean);
    const tagIds: string[] = [];
    const newTags: string[] = [];
    for (const name of inputTagNames) {
      const key = name.toLowerCase();
      const id = tagIdByName.get(key);
      if (id) tagIds.push(id);
      else newTags.push(name);
    }

    const payload: UploadPayload = {
      name: current.nameOverride ? current.customName?.trim() : undefined,
      description: current.description,
      isPublic: current.isPublic,
      maxViews: typeof current.maxViews === "number" ? current.maxViews : null,
      maxViewsAction: current.maxViewsAction || "",
      folderId,
      folderName: folderId ? "" : current.folderName || "",
      tagIds,
      newTags,
      slug: current.vanitySlug || "",
      nameConvention: current.nameConvention || defaultNameConvention,
      slugConvention: current.slugConvention || defaultSlugConvention,
      file: current.file,
    };

    return payload;
  };

  const applyUploadResult = (idx: number, result: UploadApiResponse) => {
    const shareUrl = (slug: string) => {
      const base =
        appUrl || (typeof window !== "undefined" ? window.location.origin : "");
      return base
        ? `${base}/x/${encodeURIComponent(slug)}`
        : `/x/${encodeURIComponent(slug)}`;
    };
    updateFileAt(idx, (prev) => ({
      id: result.id ?? prev.id,
      slug: result.slug ?? prev.slug,
      storedName: result.storedName ?? prev.storedName,
      mimeType: result.mimeType ?? prev.mimeType,
      size: result.size ?? prev.size,
      description:
        typeof result.description === "string"
          ? result.description
          : prev.description,
      isPublic:
        typeof result.isPublic === "boolean" ? result.isPublic : prev.isPublic,
      maxViews:
        typeof result.maxViews === "number" ? result.maxViews : prev.maxViews,
      maxViewsAction:
        typeof result.maxViewsAction === "string"
          ? (result.maxViewsAction as UploadItem["maxViewsAction"])
          : prev.maxViewsAction,
      folderName: result.folder ?? prev.folderName ?? "",
      tags: Array.isArray(result.tags) ? result.tags : (prev.tags ?? []),
      url: result.url ?? prev.url,
      shareUrl: result.slug ? shareUrl(result.slug) : prev.shareUrl,
      progress: 100,
      uploaded: true,
      error: undefined,
      customName: result.originalName ?? prev.customName,
    }));
  };

  const isNumber = (v: unknown): v is number =>
    typeof v === "number" && !Number.isNaN(v);

  const shouldUseChunked = (file: File) =>
    file.size >= CHUNKED_UPLOAD_THRESHOLD_MB * 1_000_000;

  const uploadViaForm = (idx: number, payload: UploadPayload) => {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const formData = new FormData();
      if (payload.name) formData.append("name", payload.name);
      formData.append("description", payload.description);
      formData.append("isPublic", String(payload.isPublic));
      if (payload.folderId) formData.append("folderId", payload.folderId);
      else formData.append("folderName", payload.folderName || "");
      formData.append("tagIds", JSON.stringify(payload.tagIds));
      formData.append("newTags", payload.newTags.join(","));
      formData.append("slug", payload.slug);
      if (typeof payload.maxViews === "number") {
        formData.append("maxViews", String(payload.maxViews));
      }
      if (payload.maxViewsAction) {
        formData.append("maxViewsAction", payload.maxViewsAction);
      }
      if (payload.nameConvention)
        formData.append("nameConvention", payload.nameConvention);
      if (payload.slugConvention)
        formData.append("slugConvention", payload.slugConvention);
      formData.append("file", payload.file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiV1("/upload"));

      xhr.upload.onprogress = (event) => {
        const percent = event.lengthComputable
          ? Math.round((event.loaded / event.total) * 100)
          : 0;
        updateFileAt(idx, { progress: percent });
      };

      xhr.onload = () => {
        const ok = xhr.status >= 200 && xhr.status < 300;
        if (!ok) {
          let message = xhr.statusText || "Upload failed";
          try {
            const parsed = JSON.parse(xhr.responseText) as UploadApiResponse;
            message = getApiErrorMessage(parsed, message);
          } catch {}
          return reject(new Error(message));
        }
        try {
          const parsed = JSON.parse(xhr.responseText) as UploadApiResponse;
          resolve(parsed);
        } catch {
          reject(new Error("Invalid server response"));
        }
      };

      xhr.onerror = () => {
        reject(new Error(xhr.statusText || "Network error"));
      };

      xhr.send(formData);
    });
  };

  const uploadViaChunked = async (idx: number, payload: UploadPayload) => {
    const initRes = await fetch(apiV1("/upload?action=init"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: payload.name,
        fileName: payload.file.name,
        size: payload.file.size,
        mimeType: payload.file.type,
        description: payload.description,
        isPublic: payload.isPublic,
        slug: payload.slug,
        maxViews: payload.maxViews,
        maxViewsAction: payload.maxViewsAction,
        nameConvention: payload.nameConvention,
        slugConvention: payload.slugConvention,
        folderId: payload.folderId,
        folderName: payload.folderName,
        tagIds: JSON.stringify(payload.tagIds),
        newTags: payload.newTags.join(","),
      }),
    });

    if (!initRes.ok) {
      let message = "Upload init failed";
      try {
        const parsed = (await initRes.json()) as UploadApiResponse;
        message = getApiErrorMessage(parsed, message);
      } catch {}
      throw new Error(message);
    }

    const initData = (await initRes.json()) as ChunkInitResponse;
    if (!initData?.uploadId || !isNumber(initData.chunkSize)) {
      throw new Error("Invalid chunk init response");
    }

    const chunkSize = initData.chunkSize;
    const totalParts = isNumber(initData.totalParts)
      ? initData.totalParts
      : Math.ceil(payload.file.size / chunkSize);

    let uploadedBytes = 0;
    let nextIndex = 0;

    const uploadPart = async (partIndex: number) => {
      const start = partIndex * chunkSize;
      const end = Math.min(start + chunkSize, payload.file.size);
      const blob = payload.file.slice(start, end);
      const res = await fetch(
        apiV1(
          `/upload?action=part&uploadId=${encodeURIComponent(
            initData.uploadId,
          )}&part=${partIndex}`,
        ),
        {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: blob,
        },
      );

      if (!res.ok) {
        let message = "Chunk upload failed";
        try {
          const parsed = (await res.json()) as UploadApiResponse;
          message = getApiErrorMessage(parsed, message);
        } catch {}
        throw new Error(message);
      }

      uploadedBytes += blob.size;
      const percent = Math.round((uploadedBytes / payload.file.size) * 100);
      updateFileAt(idx, { progress: Math.min(percent, 99) });
    };

    const workers = Array.from({ length: CHUNKED_CONCURRENCY }).map(
      async () => {
        while (nextIndex < totalParts) {
          const part = nextIndex;
          nextIndex += 1;
          await uploadPart(part);
        }
      },
    );

    try {
      await Promise.all(workers);
    } catch (err) {
      try {
        await fetch(apiV1("/upload?action=abort"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: initData.uploadId }),
        });
      } catch {}
      throw err;
    }

    const completeRes = await fetch(apiV1("/upload?action=complete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: initData.uploadId }),
    });

    if (!completeRes.ok) {
      let message = "Upload completion failed";
      try {
        const parsed = (await completeRes.json()) as UploadApiResponse;
        message = getApiErrorMessage(parsed, message);
      } catch {}
      throw new Error(message);
    }

    return (await completeRes.json()) as UploadApiResponse;
  };

  async function uploadSingle(idx: number) {
    const current = files[idx];
    if (!current || current.uploaded) return;

    const payload = buildUploadPayload(current);
    try {
      const result = shouldUseChunked(payload.file)
        ? await uploadViaChunked(idx, payload)
        : await uploadViaForm(idx, payload);

      applyUploadResult(idx, result);
      toast.success(`"${displayName(current)}" uploaded successfully!`);
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Upload failed";
      updateFileAt(idx, { error: message, progress: 0, uploaded: false });
      toast.error(`Failed to upload "${displayName(current)}": ${message}`);
    }
  }

  async function retryUpload(idx: number) {
    setIsUploading(true);
    updateFileAt(idx, { progress: 0, error: undefined, uploaded: false });
    try {
      await uploadSingle(idx);
    } finally {
      setIsUploading(false);
    }
  }

  const handleUpload = async () => {
    const pendingIndexes = files
      .map((f, i) => (!f.uploaded ? i : -1))
      .filter((i) => i !== -1);

    if (pendingIndexes.length === 0) return;

    setIsUploading(true);

    setFiles((prev) => {
      const next = [...prev];
      for (const i of pendingIndexes) {
        if (next[i]) next[i] = { ...next[i], progress: 0, error: undefined };
      }
      return next;
    });

    await Promise.all(
      pendingIndexes.map(async (idx) => {
        const current = files[idx];
        if (!current) return;

        const payload = buildUploadPayload(current);
        try {
          const result = shouldUseChunked(payload.file)
            ? await uploadViaChunked(idx, payload)
            : await uploadViaForm(idx, payload);

          applyUploadResult(idx, result);
          toast.success(`"${displayName(current)}" uploaded successfully!`);
        } catch (err) {
          const message =
            err instanceof Error && err.message ? err.message : "Upload failed";
          updateFileAt(idx, { error: message, progress: 0 });
          toast.error(`Failed to upload "${displayName(current)}": ${message}`);
        }
      }),
    );

    await fetchSummary();

    setIsUploading(false);
    setOpen(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!filesEnabled) {
      toast.error(
        "Files are disabled. Manage this in Settings → Features. If disabled by an admin, contact them.",
      );
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const list = e.dataTransfer?.files;
    if (!list || list.length === 0) return;
    addFilesToQueue(Array.from(list));
  };

  const actionsHydrating = featuresLoading || !summaryReady;

  return (
    <PageLayout
      title="Upload Files"
      subtitle="Upload your files to the server"
      toolbar={
        <div className="flex flex-wrap justify-between items-center gap-2 w-full">
          <div
            className={cn(
              "grid grid-cols-2 w-full gap-2",
              allowRemoteUpload && "md:grid-cols-4",
            )}
          >
            {actionsHydrating ? (
              <>
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md" />
                <Skeleton className="h-9 w-full rounded-md col-span-2 md:col-span-4" />
              </>
            ) : (
              <>
                {allowRemoteUpload && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRemoteDialogOpen(true)}
                    disabled={!filesEnabled || featuresLoading}
                  >
                    <IconWorldUpload /> Remote
                  </Button>
                )}
                {filesEnabled ? (
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/upload-links">
                      <IconUpload /> Guest Links
                    </Link>
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" disabled>
                    <IconUpload /> Guest Links
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setBulkOpen(true)}
                  disabled={isUploading || files.length === 0 || !filesEnabled}
                >
                  Bulk Update
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isUploading || files.length === 0}
                  onClick={() => {
                    for (const url of previewUrls.current.values()) {
                      URL.revokeObjectURL(url);
                    }
                    previewUrls.current.clear();
                    setFiles([]);
                    toast.success("All files cleared.");
                  }}
                >
                  Clear Files
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={
                    isUploading ||
                    files.length === 0 ||
                    !filesEnabled ||
                    featuresLoading
                  }
                  className={cn(
                    allowRemoteUpload && "last:col-span-2 md:last:col-span-4",
                  )}
                >
                  {isUploading ? "Uploading..." : "Upload All"}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {!filesEnabled && !featuresLoading ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Files are disabled. You can manage this in Settings → Features. If it
          was disabled by an admin, contact them.
        </div>
      ) : null}
      <section className="space-y-4">
        <UploadDropzone
          maxUploadMb={maxUploadMb}
          maxFilesPerUpload={maxFilesPerUpload}
          remainingQuotaMb={remainingQuotaMb}
          filesRemaining={filesRemaining}
          maxStorageMb={maxStorageMb}
          effectiveRemainingStorageMb={effectiveRemainingStorageMb}
          usedTodayBytes={usedTodayBytes}
          usedStorageBytes={usedStorageBytes}
          formatMbWhole={formatMbWhole}
          toMb={toMb}
          disabled={!filesEnabled || featuresLoading}
          onFileChange={handleFileChange}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePasteReact}
          dropZoneRef={dropZoneRef}
        />

        <UploadQueue
          files={files}
          isUploading={isUploading}
          previewUrls={previewUrls.current}
          pendingCount={pendingCount}
          uploadedCount={uploadedCount}
          onEdit={(index) => {
            setEditingFileIndex(null);
            requestAnimationFrame(() => setEditingFileIndex(index));
          }}
          onRemove={(index) => {
            const url = previewUrls.current.get(files[index]?.file);
            if (url) URL.revokeObjectURL(url);
            if (files[index]?.file)
              previewUrls.current.delete(files[index].file);
            setFiles((prev) => prev.filter((_, idx) => idx !== index));
            const current = files[index];
            if (current) {
              toast.success(`"${displayName(current)}" removed from queue.`);
            }
          }}
          onRetry={retryUpload}
        />
      </section>
      <UploadEditDialog
        open={open}
        onOpenChange={setOpen}
        files={files}
        editingFileIndex={editingFileIndex}
        previewUrls={previewUrls.current}
        customName={customName}
        setCustomName={setCustomName}
        lockedExt={lockedExt}
        description={description}
        setDescription={setDescription}
        isPublic={isPublic}
        setIsPublic={setIsPublicWithTouch}
        maxViews={maxViews}
        setMaxViews={setMaxViews}
        maxViewsAction={maxViewsAction}
        setMaxViewsAction={setMaxViewsAction}
        folderName={folderName}
        setFolderName={setFolderNameWithTouch}
        vanitySlug={vanitySlug}
        setVanitySlug={setVanitySlug}
        nameConvention={nameConvention}
        setNameConvention={setNameConvention}
        slugConvention={slugConvention}
        setSlugConvention={setSlugConvention}
        tagsChips={tagsChips}
        setTagsChips={setTagsWithTouch}
        tagDraft={tagDraft}
        setTagDraft={setTagDraft}
        tags={tags}
        folders={folders}
        folderFocused={folderFocused}
        setFolderFocused={setFolderFocused}
        tagsFocused={tagsFocused}
        setTagsFocused={setTagsFocused}
        onSave={() => {
          if (editingFileIndex === null) return;
          const updatedFiles = [...files];
          const currentFile = updatedFiles[editingFileIndex];
          if (currentFile) {
            const nextBase = customName.trim();
            const hasOverride = Boolean(nextBase);
            currentFile.customName = hasOverride
              ? `${nextBase}${lockedExt}`
              : "";
            currentFile.nameOverride = hasOverride;
            currentFile.nameConvention = nameConvention;
            currentFile.slugConvention = slugConvention;
            currentFile.description = description;
            currentFile.isPublic = isPublic;
            currentFile.maxViews = maxViews;
            currentFile.maxViewsAction = maxViewsAction;
            currentFile.folderName = folderName;
            currentFile.tags = tagsChips;
            currentFile.vanitySlug = vanitySlug;
            setFiles(updatedFiles);
          }
          setCustomName("");
          setDescription("");
          visibilityTouched.current = false;
          setIsPublic(prefs.defaultUploadVisibility === "public");
          setMaxViews("");
          setMaxViewsAction("");
          folderTouched.current = false;
          setFolderName(prefs.defaultUploadFolder ?? "");
          setVanitySlug("");
          setNameConvention(defaultNameConvention);
          setSlugConvention(defaultSlugConvention);
          tagsTouched.current = false;
          setTagsChips(prefs.defaultUploadTags ?? []);
          setEditingFileIndex(null);
          setOpen(false);
          toast.success("File changes saved.");
        }}
      />
      <UploadBulkDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        bulkMakePublic={bulkMakePublic}
        setBulkMakePublic={setBulkMakePublic}
        bulkExpireAt={bulkExpireAt}
        setBulkExpireAt={setBulkExpireAt}
        bulkFolder={bulkFolder}
        setBulkFolder={setBulkFolder}
        bulkFolderFocused={bulkFolderFocused}
        setBulkFolderFocused={setBulkFolderFocused}
        bulkTagsChips={bulkTagsChips}
        setBulkTagsChips={setBulkTagsChips}
        bulkTagDraft={bulkTagDraft}
        setBulkTagDraft={setBulkTagDraft}
        bulkTagsFocused={bulkTagsFocused}
        setBulkTagsFocused={setBulkTagsFocused}
        bulkNameConvention={bulkNameConvention}
        setBulkNameConvention={(value) =>
          setBulkNameConvention(
            value as NameConvention | typeof KEEP_CONVENTION,
          )
        }
        bulkSlugConvention={bulkSlugConvention}
        setBulkSlugConvention={(value) =>
          setBulkSlugConvention(
            value as SlugConvention | typeof KEEP_CONVENTION,
          )
        }
        keepValue={KEEP_CONVENTION}
        folders={folders}
        tags={tags}
        onApply={() => {
          setFiles((prev) => {
            const bulkList = Array.from(
              new Set(bulkTagsChips.map(normalizeTag)),
            );

            return prev.map((f) => {
              if (f.uploaded) return f;
              const resolvedNameConvention =
                f.nameConvention || defaultNameConvention;
              const resolvedSlugConvention =
                f.slugConvention || defaultSlugConvention;

              const nextTags =
                bulkList.length > 0
                  ? Array.from(
                      new Set([
                        ...(f.tags ?? []).map(normalizeTag),
                        ...bulkList,
                      ]),
                    )
                  : (f.tags ?? []).map(normalizeTag);

              return {
                ...f,
                isPublic: bulkMakePublic ? true : f.isPublic,
                folderName: bulkFolder ? bulkFolder : f.folderName,
                tags: nextTags,
                nameConvention:
                  bulkNameConvention === KEEP_CONVENTION
                    ? resolvedNameConvention
                    : bulkNameConvention,
                slugConvention:
                  bulkSlugConvention === KEEP_CONVENTION
                    ? resolvedSlugConvention
                    : bulkSlugConvention,
              };
            });
          });
          setBulkOpen(false);
          toast.success("Bulk update applied to all pending files.");
        }}
      />
      {allowRemoteUpload && (
        <RemoteUploadDialog
          open={remoteDialogOpen}
          onOpenChange={setRemoteDialogOpen}
        />
      )}
    </PageLayout>
  );
}
