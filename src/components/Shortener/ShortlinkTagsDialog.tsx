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

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconEdit, IconShare, IconTag, IconTrash } from "@tabler/icons-react";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";
import ColorPicker from "@/components/Common/ColorPicker";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import CopyButton from "@/components/Common/CopyButton";
import ShareQrButton from "@/components/Common/ShareQrButton";
import { shareUrl } from "@/lib/api/helpers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ShortlinkTagItem = {
  id: string;
  name: string;
  color?: string | null;
  shortlinkCount: number;
};

export default function ShortlinkTagsDialog({
  username,
  onChanged,
}: {
  username: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ShortlinkTagItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiV1("/shortlink-tags"), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tags");
      const data = (await res.json()) as ShortlinkTagItem[];
      setItems(data);
    } catch (err) {
      toast.error("Failed to load tags", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadTags();
  }, [open, loadTags]);

  const normalizedName = useMemo(() => normalizeTagName(name), [name]);
  const existingNames = useMemo(
    () => new Set(items.map((item) => item.name)),
    [items],
  );
  const nameTaken = normalizedName ? existingNames.has(normalizedName) : false;

  useEffect(() => {
    if (!createOpen) {
      setName("");
      setColor(null);
    }
  }, [createOpen]);

  const createTag = async () => {
    if (!normalizedName) {
      toast.error("Tag name is required");
      return;
    }
    if (nameTaken) {
      toast.error("Tag already exists");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(apiV1("/shortlink-tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to create tag");
      toast.success("Tag created", {
        description: `#${formatTagName(normalizedName)}`,
      });
      setName("");
      setColor(null);
      setCreateOpen(false);
      await loadTags();
      onChanged();
    } catch (err) {
      toast.error("Create failed", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <IconTag className="h-4 w-4" />
          Tags
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Shortlink tags</DialogTitle>
          <DialogDescription>
            Create, edit, share, or remove shortlink tags.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <div className="text-sm font-medium">Create a tag</div>
            <div className="text-xs text-muted-foreground">
              Add a colored tag for your shortlinks.
            </div>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">New tag</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create shortlink tag</DialogTitle>
                <DialogDescription>
                  Tag names are unique and case-insensitive.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="shortlink-tag-name">Tag name</Label>
                  <Input
                    id="shortlink-tag-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Marketing"
                  />
                  {nameTaken && (
                    <p className="text-xs text-destructive">
                      Tag already exists.
                    </p>
                  )}
                </div>
                <ColorPicker
                  id="shortlink-tag-color"
                  label="Tag color"
                  value={color}
                  onChange={setColor}
                  disabled={saving}
                />
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createTag} disabled={saving || nameTaken}>
                  {saving ? "Creating…" : "Create tag"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading tags…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No shortlink tags yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 overflow-y-auto max-h-96">
              {items.map((tag) => (
                <ShortlinkTagRow
                  key={tag.id}
                  tag={tag}
                  username={username}
                  onChanged={async () => {
                    await loadTags();
                    onChanged();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortlinkTagRow({
  tag,
  username,
  onChanged,
}: {
  tag: ShortlinkTagItem;
  username: string;
  onChanged: () => void;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [name, setName] = useState(formatTagName(tag.name));
  const [color, setColor] = useState<string | null>(tag.color ?? null);

  useEffect(() => {
    setName(formatTagName(tag.name));
    setColor(tag.color ?? null);
  }, [tag.name, tag.color]);

  const shareLink = shareUrl(
    "st",
    `${encodeURIComponent(username)}/${encodeURIComponent(tag.name)}`,
  );
  const tagStyles = getBadgeColorStyles(tag.color);

  const save = async () => {
    const normalized = normalizeTagName(name);
    if (!normalized) {
      toast.error("Tag name is required");
      return;
    }
    try {
      setWorking(true);
      const res = await fetch(apiV1("/shortlink-tags"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tag.id, name: normalized, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to update tag");
      toast.success("Tag updated", {
        description: `#${formatTagName(normalized)}`,
      });
      setEditOpen(false);
      onChanged();
    } catch (err) {
      toast.error("Update failed", { description: (err as Error).message });
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    try {
      setWorking(true);
      const res = await fetch(apiV1("/shortlink-tags"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tag.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to delete tag");
      toast.success("Tag deleted", {
        description: `#${formatTagName(tag.name)}`,
      });
      onChanged();
    } catch (err) {
      toast.error("Delete failed", { description: (err as Error).message });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={cn("gap-1", tagStyles?.className)}
          style={tagStyles?.style}
        >
          <IconTag className="h-3.5 w-3.5" />
          {formatTagName(tag.name)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {tag.shortlinkCount} shortlink
          {tag.shortlinkCount === 1 ? "" : "s"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <IconEdit className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit tag</DialogTitle>
              <DialogDescription>
                Update the name and color for this shortlink tag.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <Label htmlFor={`shortlink-tag-${tag.id}`}>Tag name</Label>
              <Input
                id={`shortlink-tag-${tag.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <ColorPicker
                id={`shortlink-tag-color-${tag.id}`}
                label="Tag color"
                value={color}
                onChange={setColor}
                disabled={working}
              />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={working}>
                {working ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CopyButton
          variant="outline"
          size="sm"
          successMessage="Copied share link"
          getText={() => shareLink}
        >
          <IconShare className="h-4 w-4" />
        </CopyButton>

        <ShareQrButton url={shareLink} />

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <IconTrash className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete tag?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the tag from all shortlinks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={remove} disabled={working}>
                {working ? "Deleting…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
