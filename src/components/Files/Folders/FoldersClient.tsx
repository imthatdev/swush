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
import { IconFolder } from "@tabler/icons-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderActions } from "./FoldersActions";
import PageLayout from "@/components/Common/PageLayout";
import { formatBytes } from "@/lib/helpers";
import { apiV1 } from "@/lib/api-path";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import ColorPicker from "@/components/Common/ColorPicker";
import { toast } from "sonner";

type FolderItem = {
  id: string;
  name: string;
  color?: string | null;
  shareEnabled?: boolean;
  shareSlug?: string | null;
  shareHasPassword?: boolean;
  fileCount: number;
  totalSize: number;
};

export default function FoldersClient() {
  const [items, setItems] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [openCreate, setOpenCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createColor, setCreateColor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const dq = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(apiV1("/folders"), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load folders");
      const json = (await res.json()) as FolderItem[];
      setItems(json);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || e.isComposing;
      if (isTyping) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function openCreateDialog() {
    setCreateError(null);
    setCreateName("");
    setCreateColor(null);
    setOpenCreate(true);
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const name = createName.trim();
      if (!name) throw new Error("Folder name is required");
      const res = await fetch(apiV1("/folders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: createColor }),
      });
      if (!res.ok) {
        const err = await res.json().catch();
        throw new Error(err?.message || "Failed to create folder");
      }
      setOpenCreate(false);
      await load();
    } catch (e) {
      setCreateError((e as Error)?.message || "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  const filtered = useMemo(() => {
    const q = dq.trim().toLowerCase();
    if (!q) return items;
    return items.filter((f) => f.name.toLowerCase().includes(q));
  }, [items, dq]);

  return (
    <PageLayout
      title="Folders"
      subtitle="Browse files by folder. Click a folder to view its contents."
      headerActions={
        <Button onClick={openCreateDialog} size="sm" variant="default">
          + New Folder
        </Button>
      }
      toolbar={
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search folders"
          className="w-full"
        />
      }
    >
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground">No folders found.</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No folders match “{query}”.
        </div>
      ) : (
        <div className="grid gap-2 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <div
              key={f.id}
              className="rounded-lg border p-4 bg-muted/30 hover:bg-muted/60 transition flex flex-col justify-between gap-4"
            >
              <div className="flex flex-col justify-center">
                {(() => {
                  const colorStyles = getBadgeColorStyles(f.color);
                  return (
                    <Link
                      href={
                        f.id === "unfiled"
                          ? "/folders/unfiled"
                          : `/folders/${encodeURIComponent(f.name)}`
                      }
                      className="inline-flex"
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
                          colorStyles?.className ?? "border-border bg-muted/40",
                        )}
                        style={colorStyles?.style}
                      >
                        <IconFolder size={16} />
                        {f.name}
                      </span>
                    </Link>
                  );
                })()}
                <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    {f.fileCount} file{f.fileCount === 1 ? "" : "s"}
                  </span>
                  <span>{formatBytes(f.totalSize)}</span>
                </div>
              </div>
              {f.id !== "unfiled" && (
                <FolderActions
                  folderId={f.id}
                  folderName={f.name}
                  folderColor={f.color ?? null}
                  shareEnabled={Boolean(f.shareEnabled)}
                  shareHasPassword={Boolean(f.shareHasPassword)}
                  shareSlug={f.shareSlug ?? null}
                  onUpdated={(next) => {
                    setItems((prev) =>
                      [...prev]
                        .map((item) =>
                          item.id === next.id
                            ? {
                                ...item,
                                name: next.name,
                                color: next.color ?? null,
                                shareEnabled:
                                  next.shareEnabled ?? item.shareEnabled,
                                shareSlug: next.shareSlug ?? item.shareSlug,
                                shareHasPassword:
                                  next.shareHasPassword ??
                                  item.shareHasPassword,
                              }
                            : item,
                        )
                        .sort((a, b) => a.name.localeCompare(b.name)),
                    );
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new folder</DialogTitle>
            <DialogDescription>Choose a short, clear name.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="create-name">Folder name</Label>
            <Input
              id="create-name"
              placeholder="e.g. Invoices"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <ColorPicker
              id="folder-color"
              label="Folder color"
              value={createColor}
              onChange={setCreateColor}
              disabled={creating}
              hint="Color shows on folder badges and filters."
            />
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
