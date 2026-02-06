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

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PaginationFooter } from "@/components/Shared/PaginationFooter";
import { useCachedPagedList } from "@/hooks/use-cached-paged-list";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";

type ExportItem = {
  id: string;
  status: string;
  fileName?: string | null;
  createdAt?: string | Date | null;
  error?: string | null;
};

export default function ExportData() {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [reloadTick, setReloadTick] = useState(0);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [clearingFailed, setClearingFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selection, setSelection] = useState({
    includeFiles: true,
    includeFileBinaries: true,
    includeNotes: true,
    includeBookmarks: true,
    includeSnippets: true,
    includeRecipes: true,
    includeShortLinks: true,
  });

  const cacheKey = useMemo(
    () => `exports|${page}|${pageSize}`,
    [page, pageSize],
  );

  const fetchExports = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("offset", String((page - 1) * pageSize));
    const res = await fetch(apiV1(`/profile/export?${qs.toString()}`), {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { items?: ExportItem[]; total?: number };
    return {
      items: data.items ?? [],
      total: Number(data.total || 0),
    };
  }, [page, pageSize]);

  const { items, totalPages, totalCount, listLoading } =
    useCachedPagedList<ExportItem>({
      cacheKey,
      page,
      pageSize,
      reloadTick,
      setPage,
      setReloadTick,
      fetcher: fetchExports,
    });

  useEffect(() => {
    const hasPending = items.some(
      (it) => it.status === "queued" || it.status === "processing",
    );
    if (!hasPending) return;
    const id = setInterval(() => {
      setReloadTick((tick) => tick + 1);
    }, 4000);
    return () => clearInterval(id);
  }, [items, setReloadTick]);

  const startExport = async () => {
    const includeFiles = selection.includeFiles;
    const includeFileBinaries = includeFiles
      ? selection.includeFileBinaries
      : false;
    const payload = {
      include: {
        includeFiles,
        includeFileBinaries,
        includeNotes: selection.includeNotes,
        includeBookmarks: selection.includeBookmarks,
        includeSnippets: selection.includeSnippets,
        includeRecipes: selection.includeRecipes,
        includeShortLinks: selection.includeShortLinks,
      },
    };

    const anySelected =
      payload.include.includeFiles ||
      payload.include.includeNotes ||
      payload.include.includeBookmarks ||
      payload.include.includeSnippets ||
      payload.include.includeRecipes ||
      payload.include.includeShortLinks;
    if (!anySelected) {
      toast.error("Pick at least one export type");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(apiV1("/profile/export"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to start export");
      }
      toast.success("Export started");
      setPage(1);
      setReloadTick((tick) => tick + 1);
      setDialogOpen(false);
    } catch (err) {
      toast.error("Could not start export", {
        description: (err as Error).message,
      });
    } finally {
      setCreating(false);
    }
  };

  const clearFailed = async () => {
    setClearingFailed(true);
    try {
      const res = await fetch(apiV1("/profile/export?scope=failed"), {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to clear exports");
      }
      toast.success("Failed exports cleared");
      setPage(1);
      setReloadTick((tick) => tick + 1);
    } catch (err) {
      toast.error("Failed to clear exports", {
        description: (err as Error).message,
      });
    } finally {
      setClearingFailed(false);
    }
  };

  const deleteAllArchives = async () => {
    setDeletingAll(true);
    try {
      const res = await fetch(apiV1("/profile/export?scope=all"), {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete archives");
      }
      toast.success("Archives deleted");
      setPage(1);
      setReloadTick((tick) => tick + 1);
    } catch (err) {
      toast.error("Failed to delete archives", {
        description: (err as Error).message,
      });
    } finally {
      setDeletingAll(false);
    }
  };

  const deleteArchive = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(apiV1(`/profile/export/${id}`), {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to delete archive");
      }
      toast.success("Archive deleted");
      setReloadTick((tick) => tick + 1);
    } catch (err) {
      toast.error("Failed to delete archive", {
        description: (err as Error).message,
      });
    } finally {
      setDeletingId((current) => (current === id ? null : current));
    }
  };

  const failedCount = items.filter((item) => item.status === "failed").length;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary">
              Create archive
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create archive</DialogTitle>
              <DialogDescription>
                Choose what to include in the backup zip.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={selection.includeFiles}
                  onCheckedChange={(value) =>
                    setSelection((prev) => ({
                      ...prev,
                      includeFiles: Boolean(value),
                      includeFileBinaries: Boolean(value)
                        ? prev.includeFileBinaries
                        : false,
                    }))
                  }
                />
                Files (CSV)
              </label>
              <label className="flex items-center gap-2 pl-6 text-muted-foreground">
                <Checkbox
                  checked={selection.includeFileBinaries}
                  disabled={!selection.includeFiles}
                  onCheckedChange={(value) =>
                    setSelection((prev) => ({
                      ...prev,
                      includeFileBinaries: Boolean(value),
                    }))
                  }
                />
                File binaries (actual files)
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={selection.includeNotes}
                  onCheckedChange={(value) =>
                    setSelection((prev) => ({
                      ...prev,
                      includeNotes: Boolean(value),
                    }))
                  }
                />
                Notes
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={selection.includeBookmarks}
                  onCheckedChange={(value) =>
                    setSelection((prev) => ({
                      ...prev,
                      includeBookmarks: Boolean(value),
                    }))
                  }
                />
                Bookmarks
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={selection.includeSnippets}
                  onCheckedChange={(value) =>
                    setSelection((prev) => ({
                      ...prev,
                      includeSnippets: Boolean(value),
                    }))
                  }
                />
                Snippets
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={selection.includeRecipes}
                  onCheckedChange={(value) =>
                    setSelection((prev) => ({
                      ...prev,
                      includeRecipes: Boolean(value),
                    }))
                  }
                />
                Recipes
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={selection.includeShortLinks}
                  onCheckedChange={(value) =>
                    setSelection((prev) => ({
                      ...prev,
                      includeShortLinks: Boolean(value),
                    }))
                  }
                />
                Short links
              </label>
            </div>
            <DialogFooter>
              <Button
                variant="secondary"
                onClick={startExport}
                disabled={creating}
              >
                {creating ? "Starting..." : "Create archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button
          size="sm"
          variant="outline"
          onClick={clearFailed}
          disabled={failedCount === 0 || clearingFailed}
        >
          {clearingFailed ? "Clearing..." : "Clear failed"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={deleteAllArchives}
          disabled={items.length === 0 || deletingAll}
        >
          {deletingAll ? "Deleting..." : "Delete all"}
        </Button>
        {listLoading ? (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        ) : null}
      </div>
      <div className="grid gap-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No exports yet.</p>
        ) : (
          items.map((item, index) => {
            const created =
              item.createdAt instanceof Date
                ? item.createdAt.toLocaleString()
                : typeof item.createdAt === "string"
                  ? new Date(item.createdAt).toLocaleString()
                  : "Unknown date";
            const position = totalCount - ((page - 1) * pageSize + index);
            const label = `Backup ${
              position > 0 ? position : index + 1
            } ꕀ ${created}`;
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {label}
                  </div>
                  <div
                    className={
                      item.status === "ready"
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }
                  >
                    {item.status === "ready"
                      ? "Ready"
                      : item.status === "processing"
                        ? "Processing"
                        : item.status === "queued"
                          ? "Queued"
                          : "Failed"}
                  </div>
                  {item.error ? (
                    <div className="text-destructive">{item.error}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === "ready" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingId === item.id}
                      onClick={() => {
                        setDownloadingId(item.id);
                        const a = document.createElement("a");
                        a.href = apiV1(`/profile/export/${item.id}`);
                        a.click();
                        setTimeout(
                          () =>
                            setDownloadingId((current) =>
                              current === item.id ? null : current,
                            ),
                          800,
                        );
                      }}
                    >
                      {downloadingId === item.id
                        ? "Downloading..."
                        : "Download"}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteArchive(item.id)}
                    disabled={deletingId === item.id}
                  >
                    {deletingId === item.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}
