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
import { IconX } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { normalize } from "@/lib/helpers";
import { apiV1 } from "@/lib/api-path";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

type FolderMeta = { id: string; name: string; color?: string | null };
type TagMeta = { id: string; name: string; color?: string | null };

type BulkPayload = {
  folderId?: string | null;
  addTagIds?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selectedCount: number;
  onApply: (payload: BulkPayload) => Promise<void>;
};

function formatTag(s: string) {
  const n = normalize(s);
  return n ? n[0] + n.slice(1) : "";
}

function normalizeFolder(s: unknown): string {
  const v = typeof s === "string" ? s : s == null ? "" : String(s);
  return v.trim().replace(/\s+/g, " ").toLowerCase();
}
function capitalizeFirst(s: string): string {
  const n = normalizeFolder(s);
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

function filterStartsWith(options: string[], q: string, limit = 6) {
  const qq = q.trim().toLowerCase();
  if (!qq) return options.slice(0, limit);
  const starts = options.filter((o) => o.toLowerCase().startsWith(qq));
  const rest = options.filter(
    (o) => !o.toLowerCase().startsWith(qq) && o.toLowerCase().includes(qq)
  );
  return [...starts, ...rest].slice(0, limit);
}

export function BulkTagsFoldersDialog({
  open,
  onOpenChange,
  selectedCount,
  onApply,
}: Props) {
  const foldersUrl = (path = "") => apiV1(`/folders${path}`);
  const tagsUrl = (path = "") => apiV1(`/tags${path}`);
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const [tags, setTags] = useState<TagMeta[]>([]);

  const [folderName, setFolderName] = useState("");
  const [folderFocused, setFolderFocused] = useState(false);

  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [tagsFocused, setTagsFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [fRes, tRes] = await Promise.all([
          fetch(foldersUrl(), { cache: "no-store" }),
          fetch(tagsUrl(), { cache: "no-store" }),
        ]);
        const fData = (await fRes.json()) as FolderMeta[];
        const tData = (await tRes.json()) as TagMeta[];
        setFolders(Array.isArray(fData) ? fData : []);
        setTags(Array.isArray(tData) ? tData : []);
      } catch {}
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setFolderName("");
    setChips([]);
    setDraft("");
  }, [open]);

  const tagMap = useMemo(
    () => new Map(tags.map((t) => [normalize(t.name), t.id])),
    [tags]
  );
  const tagColorMap = useMemo(
    () => new Map(tags.map((t) => [normalize(t.name), t.color ?? null])),
    [tags]
  );

  function commitDraft() {
    const v = normalize(draft);
    if (!v) return;
    setChips((prev) => {
      const s = new Set(prev.map(normalize));
      s.add(v);
      return Array.from(s);
    });
    setDraft("");
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    let folderId: string | null = null;
    const fnameDisplay = capitalizeFirst(folderName);
    const fnameNorm = normalizeFolder(folderName);
    if (fnameNorm) {
      const match = folders.find((f) => normalizeFolder(f.name) === fnameNorm);
      if (match) {
        folderId = match.id;
      } else {
        const res = await fetch(foldersUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: fnameDisplay }),
        });
        if (res.ok) {
          const created = (await res.json()) as FolderMeta;
          folderId = created.id;
          setFolders((prev) => [...prev, created]);
        } else {
          toast.error("Failed to create folder");
          setSaving(false);
          return;
        }
      }
    }

    const desired = new Set(chips.map(normalize));
    const toAddNames = [...desired];

    const newNames: string[] = [];
    const addIds: string[] = [];
    for (const name of toAddNames) {
      const id = tagMap.get(name);
      if (id) addIds.push(id);
      else newNames.push(name);
    }
    if (newNames.length) {
      const created: TagMeta[] = [];
      for (const nm of newNames) {
        const r = await fetch(tagsUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nm }),
        });
        if (r.ok) {
          const tag = (await r.json()) as TagMeta;
          created.push(tag);
        }
      }
      if (created.length) {
        created.forEach((t) => tagMap.set(normalize(t.name), t.id));
        addIds.push(...created.map((t) => t.id));
        setTags((prev) => [...prev, ...created]);
      }
    }

    const body: BulkPayload = {};
    if (typeof folderId === "string") body.folderId = folderId;
    if (addIds.length) body.addTagIds = addIds;

    if (!("folderId" in body) && !addIds.length) {
      setSaving(false);
      onOpenChange(false);
      return;
    }

    await onApply(body);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Bulk Edit Tags & Folder</DialogTitle>
          <DialogDescription>
            Apply tags or move {selectedCount} selected file
            {selectedCount === 1 ? "" : "s"} into a folder.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <label htmlFor="folder" className="text-xs text-muted-foreground">
            Folder
          </label>
          <div className="relative">
            <Input
              id="folder"
              value={folderName}
              onChange={(e) => setFolderName(capitalizeFirst(e.target.value))}
              onFocus={() => setFolderFocused(true)}
              onBlur={() => {
                setFolderName((prev) => capitalizeFirst(prev));
                setFolderFocused(false);
              }}
              placeholder="e.g. Invoices / 2025"
              disabled={saving}
            />
            {folderFocused && folderName.trim() && folders.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-sm">
                {(() => {
                  const uniqDisplay = Array.from(
                    new Map(
                      folders.map((f) => [
                        normalizeFolder(f.name),
                        capitalizeFirst(f.name),
                      ])
                    ).values()
                  );
                  return filterStartsWith(uniqDisplay, folderName)
                    .filter((n) => n && n !== folderName.trim())
                    .map((name) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setFolderName(name);
                          setFolderFocused(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-muted rounded-md transition"
                      >
                        {name}
                      </button>
                    ));
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="tags-input"
            id="tags-label"
            className="text-xs text-muted-foreground"
          >
            Tags
          </label>
          <div
            className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            onClick={() => inputRef.current?.focus()}
            role="textbox"
            aria-labelledby="tags-label"
          >
            {chips.map((t) => (
              (() => {
                const colorStyles = getBadgeColorStyles(
                  tagColorMap.get(normalize(t))
                );
                return (
                  <Badge
                    key={t}
                    variant="secondary"
                    className={cn("rounded-full", colorStyles?.className)}
                    style={colorStyles?.style}
                  >
                    {formatTag(t)}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-background/50 -mr-1"
                      onClick={() =>
                        setChips((prev) => prev.filter((x) => x !== t))
                      }
                      aria-label={`Remove ${t}`}
                      disabled={saving}
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                );
              })()
            ))}
            <input
              ref={inputRef}
              id="tags-input"
              name="tags"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setTagsFocused(true)}
              onBlur={() => setTagsFocused(false)}
              placeholder={chips.length ? "Add more…" : "e.g. work"}
              className="min-w-[8ch] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                  e.preventDefault();
                  commitDraft();
                } else if (e.key === "Backspace" && !draft && chips.length) {
                  setChips((prev) => prev.slice(0, -1));
                }
              }}
            />
          </div>

          {tagsFocused && draft.trim() && tags.length > 0 && (
            <div className="relative">
              <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-sm">
                {filterStartsWith(
                  tags
                    .map((t) => t.name)
                    .filter((n) => {
                      const nn = normalize(n);
                      return (
                        !chips.map(normalize).includes(nn) &&
                        nn !== normalize(draft)
                      );
                    }),
                  draft
                ).map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const nv = normalize(name);
                      setChips((prev) => {
                        const s = new Set(prev.map(normalize));
                        s.add(nv);
                        return Array.from(s);
                      });
                      setDraft("");
                      setTagsFocused(false);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted rounded-md transition"
                    disabled={saving}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <span className="text-[11px] text-muted-foreground">
            Tags will be added to every selected file. Missing tags are created
            automatically.
          </span>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Applying..." : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
