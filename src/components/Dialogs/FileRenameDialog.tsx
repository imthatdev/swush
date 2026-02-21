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

import { useEffect, useState } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MaxViewsFields } from "@/components/Common/MaxViewsFields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Upload } from "@/types";
import { toast } from "sonner";
import { splitFilename } from "@/lib/helpers";
import { apiV1 } from "@/lib/api-path";

type Props = {
  file: Upload;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (f: Upload) => void;
};

const allowedSlug = /^[a-z0-9_-]{1,64}$/;

export function FileRenameDialog({
  file,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const filesUrl = (path = "") => apiV1(`/files${path}`);
  const [base, setBase] = useState("");
  const [ext, setExt] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [anonymousShareEnabled, setAnonymousShareEnabled] = useState(false);
  const [maxViews, setMaxViews] = useState<number | "">("");
  const [maxViewsAction, setMaxViewsAction] = useState<
    "make_private" | "delete" | ""
  >("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const currentBase = splitFilename(file.originalName).base;
  const trimmedBase = base.trim();
  const nextBase = trimmedBase ? trimmedBase : currentBase;
  const nextName = `${nextBase}${ext}`;
  const nameChanged = trimmedBase ? nextName !== file.originalName : false;

  const trimmedSlug = slug.trim();
  const currentSlug = file.slug ?? "";
  const slugChanged = Boolean(trimmedSlug) && trimmedSlug !== currentSlug;

  const trimmedDesc = description.trim();
  const currentDesc = file.description ?? "";
  const descChanged = trimmedDesc !== currentDesc;

  const currentAnonymous = file.anonymousShareEnabled === true;
  const anonChanged = anonymousShareEnabled !== currentAnonymous;

  const nextMaxViews =
    typeof maxViews === "number" ? Math.max(1, Math.floor(maxViews)) : null;
  const nextMaxViewsAction = nextMaxViews ? maxViewsAction || null : null;
  const currentMaxViews =
    typeof file.maxViews === "number" ? file.maxViews : null;
  const currentMaxViewsAction = file.maxViewsAction ?? null;
  const maxViewsChanged = nextMaxViews !== currentMaxViews;
  const maxViewsActionChanged = nextMaxViewsAction !== currentMaxViewsAction;

  const hasChanges =
    nameChanged ||
    slugChanged ||
    descChanged ||
    anonChanged ||
    maxViewsChanged ||
    maxViewsActionChanged;

  const parseMaxViews = (value: unknown): number | "" => {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    }
    return "";
  };

  const hydrateFromFile = (nextFile: Upload) => {
    const { base, ext } = splitFilename(nextFile.originalName);
    setBase(base);
    setExt(ext);
    setSlug(nextFile.slug ?? "");
    setDescription(nextFile.description ?? "");
    setAnonymousShareEnabled(nextFile.anonymousShareEnabled === true);
    const parsedMaxViews = parseMaxViews(nextFile.maxViews);
    setMaxViews(parsedMaxViews);
    setMaxViewsAction(parsedMaxViews ? (nextFile.maxViewsAction ?? "") : "");
  };

  const handleOpenChange = (v: boolean) => {
    if (v) hydrateFromFile(file);
    onOpenChange(v);
  };

  useEffect(() => {
    if (open) hydrateFromFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, open]);

  const keyFor = (f: Upload) => (f.slug ? String(f.slug) : f.id);

  async function handleSave() {
    if (saving || clearing) return;
    setSaving(true);
    const payload: {
      originalName?: string;
      newSlug?: string;
      description?: string | null;
      anonymousShareEnabled?: boolean;
      maxViews?: number | null;
      maxViewsAction?: "make_private" | "delete" | null;
    } = {};

    if (trimmedBase) {
      if (nextName !== file.originalName) payload.originalName = nextName;
    } else if (currentBase && base !== currentBase) {
      setBase(currentBase);
    }

    if (
      trimmedSlug &&
      trimmedSlug !== (file.slug ?? "") &&
      !allowedSlug.test(trimmedSlug)
    ) {
      toast.warning("Slug must match a–z, 0–9, - or _");
      return;
    }
    if (trimmedSlug && trimmedSlug !== (file.slug ?? "")) {
      payload.newSlug = trimmedSlug;
    }

    if (trimmedDesc !== currentDesc) {
      payload.description = trimmedDesc.length ? trimmedDesc : null;
    }
    if (anonChanged) {
      payload.anonymousShareEnabled = anonymousShareEnabled;
    }

    if (nextMaxViews !== currentMaxViews) {
      payload.maxViews = nextMaxViews;
    }
    if (
      nextMaxViews !== currentMaxViews ||
      nextMaxViewsAction !== currentMaxViewsAction
    ) {
      payload.maxViewsAction = nextMaxViewsAction;
    }

    if (
      !payload.originalName &&
      !payload.newSlug &&
      payload.description === undefined &&
      payload.anonymousShareEnabled === undefined &&
      payload.maxViews === undefined &&
      payload.maxViewsAction === undefined
    ) {
      onOpenChange(false);
      return;
    }

    try {
      const res = await fetch(filesUrl(`/${keyFor(file)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        toast.error(msg || "Failed to update");
        return;
      }

      const updated: Upload = {
        ...file,
        originalName: payload.originalName ?? file.originalName,
        slug: payload.newSlug ?? file.slug,
        description:
          payload.description !== undefined
            ? payload.description
            : file.description,
        anonymousShareEnabled:
          payload.anonymousShareEnabled !== undefined
            ? payload.anonymousShareEnabled
            : file.anonymousShareEnabled,
        maxViews:
          payload.maxViews !== undefined ? payload.maxViews : file.maxViews,
        maxViewsAction:
          payload.maxViewsAction !== undefined
            ? payload.maxViewsAction
            : file.maxViewsAction,
      };
      onUpdated(updated);
      toast.success("Updated");
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClearVanity() {
    if (clearing || saving) return;
    setClearing(true);
    try {
      const res = await fetch(filesUrl(`/${keyFor(file)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newSlug: "" }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        toast.error(msg || "Failed to clear vanity");
        return;
      }
      const json = await res.json();
      if (json.file) {
        onUpdated(json.file);
        setSlug(json.file.slug ?? "");
      }
      toast.success("Vanity cleared");
    } finally {
      setClearing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename & Vanity</DialogTitle>
          <DialogDescription>
            Change the file name (extension locked) and optional vanity slug.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <label htmlFor="rename" className="text-xs text-muted-foreground">
            File name
          </label>
          <div className="flex min-h-10 items-center rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <input
              id="rename"
              value={base || splitFilename(file.originalName).base}
              onChange={(e) => setBase(e.target.value.split(".")[0])}
              className="flex-1 bg-transparent outline-none"
              placeholder="New name"
            />
            {ext && (
              <span className="ml-1 select-none text-muted-foreground">
                {ext}
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="vanity" className="text-xs text-muted-foreground">
            Vanity slug (a–z, 0–9, -, _)
          </label>
          <Input
            id="vanity"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. my-awesome-file"
          />
          {file.slug ? (
            <span className="text-[11px] text-muted-foreground">
              Current: <code>/v/{file.slug}</code>
            </span>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="desc" className="text-xs text-muted-foreground">
            Description
          </label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a short description…"
            className="min-h-21"
          />
          <span className="text-[11px] text-muted-foreground">
            Optional. This helps search and context.
          </span>
        </div>

        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Anonymous share</p>
            <p className="text-xs text-muted-foreground">
              Hide owner profile on the public view page.
            </p>
          </div>
          <Switch
            checked={anonymousShareEnabled}
            onCheckedChange={setAnonymousShareEnabled}
            disabled={!file.isPublic || saving || clearing}
          />
        </div>
        {!file.isPublic ? (
          <p className="text-[11px] text-muted-foreground">
            Make the file public to enable anonymous share.
          </p>
        ) : null}

        <MaxViewsFields
          currentViews={file.views ?? 0}
          maxViews={maxViews}
          onMaxViewsChange={setMaxViews}
          maxViewsAction={maxViewsAction}
          onMaxViewsActionChange={setMaxViewsAction}
        />

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClearVanity}
            disabled={clearing || saving}
          >
            {clearing ? (
              <>
                <IconLoader2 size={14} className="animate-spin" />
                Clearing…
              </>
            ) : (
              "Clear vanity"
            )}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || clearing || !hasChanges}
          >
            {saving ? (
              <>
                <IconLoader2 size={14} className="animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
