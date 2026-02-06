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
import { IconTrash, IconPencil, IconShare } from "@tabler/icons-react";
import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import CopyButton from "@/components/Common/CopyButton";
import ShareQrButton from "@/components/Common/ShareQrButton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiV1 } from "@/lib/api-path";
import { shareUrl } from "@/lib/api/helpers";
import ColorPicker from "@/components/Common/ColorPicker";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Too long"),
});

type Props = {
  folderId: string;
  folderName: string;
  folderColor?: string | null;
  onUpdated?: (next: {
    id: string;
    name: string;
    color?: string | null;
    shareEnabled?: boolean;
    shareHasPassword?: boolean;
    shareSlug?: string | null;
  }) => void;
  disabled?: boolean;
  className?: string;
  shareEnabled?: boolean;
  shareHasPassword?: boolean;
  shareSlug?: string | null;
};

export function FolderActions({
  folderId,
  folderName,
  folderColor,
  onUpdated,
  disabled,
  className,
  shareEnabled = false,
  shareHasPassword = false,
  shareSlug,
}: Props) {
  const router = useRouter();
  const [openRename, setOpenRename] = React.useState(false);
  const [openDelete, setOpenDelete] = React.useState(false);
  const [openShare, setOpenShare] = React.useState(false);
  const [shareEnabledState, setShareEnabledState] =
    React.useState(shareEnabled);
  const [sharePassword, setSharePassword] = React.useState("");
  const [shareHasPasswordState, setShareHasPasswordState] =
    React.useState(shareHasPassword);
  const [shareSlugState, setShareSlugState] = React.useState(shareSlug ?? null);
  const [shareSaving, setShareSaving] = React.useState(false);
  const [color, setColor] = React.useState<string | null>(folderColor ?? null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: folderName },
    values: { name: folderName },
  });

  const shareLink = shareUrl("f", shareSlugState);
  const shareLinkPlaceholder = shareEnabledState
    ? "Save to generate a link"
    : "Enable sharing to get a link";

  React.useEffect(() => {
    setShareEnabledState(shareEnabled);
    setShareHasPasswordState(shareHasPassword);
    setShareSlugState(shareSlug ?? null);
  }, [shareEnabled, shareHasPassword, shareSlug]);

  React.useEffect(() => {
    setColor(folderColor ?? null);
  }, [folderColor, openRename]);

  async function renameFolder(values: z.infer<typeof schema>) {
    try {
      const res = await fetch(apiV1("/folders"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId, name: values.name, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Failed to rename folder");
      }
      toast.success("Folder renamed", { description: `→ ${values.name}` });
      setOpenRename(false);
      if (onUpdated && data?.id && data?.name) {
        onUpdated({ id: data.id, name: data.name, color: data.color ?? null });
      } else if (onUpdated) {
        onUpdated({ id: folderId, name: values.name, color });
      }
    } catch (err) {
      toast.error("Rename failed", { description: (err as Error).message });
    }
  }

  async function deleteFolder() {
    try {
      const res = await fetch(apiV1("/folders"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: folderId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to delete folder");
      }
      toast.success("Folder deleted", {
        description: "Files moved to (Unfiled)",
      });
      setOpenDelete(false);
      router.push("/folders");
      router.refresh();
    } catch (err) {
      toast.error("Delete failed", { description: (err as Error).message });
    }
  }

  async function saveShareSettings(opts?: {
    removePassword?: boolean;
    shareEnabled?: boolean;
  }) {
    setShareSaving(true);
    try {
      const nextEnabled =
        typeof opts?.shareEnabled === "boolean"
          ? opts.shareEnabled
          : shareEnabledState;
      const payload: {
        id: string;
        shareEnabled?: boolean;
        password?: string | null;
      } = { id: folderId, shareEnabled: nextEnabled };
      if (opts?.removePassword) {
        payload.password = null;
      } else if (sharePassword.trim()) {
        payload.password = sharePassword.trim();
      }

      const res = await fetch(apiV1("/folders/share"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "Failed to update share settings");
      }
      const data = (await res.json().catch(() => ({}))) as {
        shareEnabled?: boolean;
        hasPassword?: boolean;
        shareSlug?: string | null;
      };
      if (typeof data.shareEnabled === "boolean") {
        setShareEnabledState(data.shareEnabled);
      }
      setShareHasPasswordState(Boolean(data.hasPassword));
      if (data.shareSlug) {
        setShareSlugState(data.shareSlug);
      }
      if (typeof data.shareEnabled === "boolean") {
        setShareEnabledState(data.shareEnabled);
      } else {
        setShareEnabledState(nextEnabled);
      }
      if (onUpdated) {
        onUpdated({
          id: folderId,
          name: folderName,
          color,
          shareEnabled:
            typeof data.shareEnabled === "boolean"
              ? data.shareEnabled
              : nextEnabled,
          shareHasPassword: Boolean(data.hasPassword),
          shareSlug: data.shareSlug ?? shareSlugState,
        });
      }
      setSharePassword("");
      toast.success("Share settings updated");
      return true;
    } catch (err) {
      toast.error("Share update failed", {
        description: (err as Error).message,
      });
      return false;
    } finally {
      setShareSaving(false);
    }
  }

  const handleShareToggle = async (val: boolean) => {
    if (shareSaving) return;
    const prev = shareEnabledState;
    setShareEnabledState(val);
    const ok = await saveShareSettings({ shareEnabled: val });
    if (!ok) {
      setShareEnabledState(prev);
    }
  };

  return (
    <div className={cn("flex flex-row items-center gap-2", className)}>
      <Dialog
        open={openRename}
        onOpenChange={(o) => {
          setOpenRename(o);
          reset({ name: folderName });
        }}
      >
        <DialogTrigger asChild>
          <Button variant="secondary" disabled={disabled}>
            <IconPencil size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
            <DialogDescription>Choose a clear, short name.</DialogDescription>
          </DialogHeader>

          <form className="grid gap-3" onSubmit={handleSubmit(renameFolder)}>
            <div className="grid gap-2">
              <Label htmlFor="name">Folder name</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g. Invoices"
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <ColorPicker
              id={`folder-color-${folderId}`}
              label="Folder color"
              value={color}
              onChange={setColor}
              disabled={isSubmitting}
              hint="Color shows on folder badges and filters."
            />

            <DialogFooter className="mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenRename(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogTrigger asChild>
          <Button variant="destructive" disabled={disabled}>
            <IconTrash size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete folder?</DialogTitle>
            <DialogDescription>
              This will remove the folder. Its files will be moved to{" "}
              <strong>(Unfiled)</strong>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteFolder}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openShare}
        onOpenChange={(o) => {
          setOpenShare(o);
          setSharePassword("");
        }}
      >
        <DialogTrigger asChild>
          <Button variant="outline" disabled={disabled}>
            <IconShare size={16} />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share folder</DialogTitle>
            <DialogDescription>
              Shared folders only show files that are already public.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-4 rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Enable sharing</div>
                <div className="text-xs text-muted-foreground">
                  Turn on the public link for this folder.
                </div>
              </div>
              <Switch
                checked={shareEnabledState}
                onCheckedChange={(val) => {
                  void handleShareToggle(Boolean(val));
                }}
                disabled={shareSaving}
              />
            </div>

            {shareEnabledState && (
              <div className="grid gap-2">
                <Label>Share link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={shareLink}
                    readOnly
                    placeholder={shareLinkPlaceholder}
                  />
                  <CopyButton
                    variant="secondary"
                    successMessage="Copied share link"
                    getText={() => shareLink}
                    disabled={!shareLink}
                  >
                    Copy
                  </CopyButton>
                  <ShareQrButton url={shareLink} />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="share-password">Password (optional)</Label>
              <Input
                id="share-password"
                type="password"
                placeholder={
                  shareHasPasswordState ? "Password set" : "No password"
                }
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  type="button"
                  disabled={shareSaving}
                  onClick={() => saveShareSettings()}
                >
                  {shareSaving ? "Saving..." : "Save"}
                </Button>
                {shareHasPasswordState && (
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={shareSaving}
                    onClick={() => saveShareSettings({ removePassword: true })}
                  >
                    Remove password
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
