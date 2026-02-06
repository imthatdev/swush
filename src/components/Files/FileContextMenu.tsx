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
  IconTrash,
  IconDownload,
  IconEdit,
  IconEyeOff,
  IconEye,
  IconAdjustments,
  IconLink,
  IconLock,
  IconStarFilled,
  IconStarOff,
  IconTags,
  IconLockOpen,
  IconLockAccess,
  IconWaveSine,
  IconQrcode,
} from "@tabler/icons-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Upload } from "@/types";
import { toast } from "sonner";
import { FileRenameDialog } from "../Dialogs/FileRenameDialog";
import { FileTagsFoldersDialog } from "../Dialogs/FileTagsFoldersDialog";
import { ConfirmDialog } from "../Dialogs/ConfirmDialog";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiV1 } from "@/lib/api-path";
import { copyToClipboard } from "@/lib/client/clipboard";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import { isMedia } from "@/lib/mime-types";
import ShareQrButton from "@/components/Common/ShareQrButton";

interface FileContextMenuProps {
  file: Upload;
  onFileUpdated: (updatedFile: Upload) => void;
  onFileDeleted: (id: string) => void;
}

export function FileContextMenu({
  file,
  onFileUpdated,
  onFileDeleted,
}: FileContextMenuProps) {
  const filesUrl = (path = "") => apiV1(`/files${path}`);
  const router = useRouter();
  const { appUrl } = useAppConfig();
  const baseUrl = appUrl || "";
  const resolveUrl = (path: string) => {
    const base =
      typeof window !== "undefined" ? window.location.origin : baseUrl;
    return base ? `${base}${path}` : path;
  };
  const shareLink = resolveUrl(`/v/${file.slug}`);
  const anonymousShareLink = file.isPublic
    ? resolveUrl(`/v/${file.slug}?anon=1`)
    : "";
  const isStreamable =
    isMedia("audio", file.mimeType, file.originalName) ||
    isMedia("video", file.mimeType, file.originalName);
  const [renameOpen, setRenameOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState(file.hasPassword);
  const [openQRDialog, setOpenQRDialog] = useState(false);

  async function toggleVisibility() {
    const res = await fetch(filesUrl(`/${file.slug}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !file.isPublic }),
    });
    if (res.ok) {
      const updated = { ...file, isPublic: !file.isPublic };
      onFileUpdated(updated);
      toast.success(`File is now ${updated.isPublic ? "Public" : "Private"}`);
    } else {
      toast.error("Failed to update visibility");
    }
  }

  async function toggleFavorite() {
    const res = await fetch(filesUrl(`/${file.slug}/favorite`), {
      method: "PATCH",
    });
    if (res.ok) {
      const updated = { ...file, isFavorite: !file.isFavorite };
      onFileUpdated(updated);
      toast.success(
        updated.isFavorite ? "Added to Favorites" : "Removed from Favorites",
      );
    } else {
      toast.error("Failed to update favorites");
    }
  }

  async function deleteFile() {
    setIsDeleting(true);
    const res = await fetch(filesUrl(`/${file.slug}`), { method: "DELETE" });
    if (res.ok) {
      onFileDeleted(file.id);
      toast.success("File deleted");
    } else {
      setIsDeleting(false);
      toast.error("Failed to delete file");
    }
  }

  async function savePassword() {
    setPasswordSaving(true);
    const res = await fetch(filesUrl(`/${file.slug}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: passwordValue }),
    });
    setPasswordSaving(false);
    if (res.ok) {
      setPasswordOpen(false);
      setPasswordValue("");
      setHasPassword(true);
      toast.success("Password updated");
    } else {
      const data = await res.json().catch();
      toast.error(data?.message || "Failed to update password");
    }
  }

  async function removePassword() {
    const res = await fetch(filesUrl(`/${file.slug}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: null }),
    });
    if (res.ok) {
      toast.success("Password removed");
      setHasPassword(false);
    } else {
      const data = await res.json().catch();
      toast.error(data?.message || "Failed to remove password");
    }
  }

  async function handleCopy(
    text: string,
    successMessage: string,
    description?: string,
  ) {
    try {
      await copyToClipboard(text);
      toast.success(successMessage, {
        description: description ?? text,
      });
    } catch (err) {
      toast.error("Copy failed", {
        description: (err as Error)?.message || "Clipboard unavailable",
      });
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isDeleting}>
            {isDeleting ? (
              <IconTrash className="h-4 w-4 animate-pulse text-destructive" />
            ) : (
              <IconAdjustments className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
            Tools
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <IconEdit className="mr-2 h-4 w-4 text-blue-500" />
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTagsOpen(true)}>
              <IconTags className="mr-2 h-4 w-4 text-amber-500" />
              Categorize
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleFavorite}>
              {file.isFavorite ? (
                <>
                  <IconStarOff className="mr-2 h-4 w-4 text-yellow-500" />
                  Remove from Favorites
                </>
              ) : (
                <>
                  <IconStarFilled className="mr-2 h-4 w-4 text-yellow-500" />
                  Add to Favorites
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleVisibility}>
              {file.isPublic ? (
                <>
                  <IconEyeOff className="mr-2 h-4 w-4 text-red-500" />
                  Make Private
                </>
              ) : (
                <>
                  <IconEye className="mr-2 h-4 w-4 text-green-500" />
                  Make Public
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setPasswordOpen(true);
              }}
              disabled={!file.isPublic}
            >
              {hasPassword ? (
                <>
                  <IconLockAccess className="mr-2 h-4 w-4 text-yellow-500" />
                  Change Password
                </>
              ) : (
                <>
                  <IconLock className="mr-2 h-4 w-4 text-rose-500" />
                  Set Password
                </>
              )}
            </DropdownMenuItem>
            {hasPassword && (
              <DropdownMenuItem
                onClick={() => {
                  if (hasPassword) {
                    removePassword();
                    return;
                  }
                }}
                disabled={!file.isPublic}
              >
                <IconLockOpen className="mr-2 h-4 w-4 text-emerald-500" />
                Remove Password
              </DropdownMenuItem>
            )}
            {!file.isPublic && (
              <DropdownMenuItem
                disabled
                className="text-xs text-muted-foreground"
              >
                Make the file public to manage passwords.
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
            Links
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => router.push(`/v/${file.slug}`)}>
              <IconEye className="mr-2 h-4 w-4 text-cyan-500" />
              View File
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() =>
                handleCopy(
                  resolveUrl(`/v/${file.slug}`),
                  "Copied View URL to clipboard",
                )
              }
              disabled={!file.isPublic}
            >
              <IconLink className="mr-2 h-4 w-4 text-indigo-500" />
              Copy View URL
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                handleCopy(
                  anonymousShareLink,
                  "Copied Anonymous View URL to clipboard",
                  "Anonymous share hides your profile, but content may still reveal identity.",
                )
              }
              disabled={!file.isPublic}
            >
              <IconEyeOff className="mr-2 h-4 w-4 text-orange-500" />
              Copy Anonymous URL
            </DropdownMenuItem>
            <ShareQrButton
              url={shareLink}
              open={openQRDialog}
              setOpen={setOpenQRDialog}
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setOpenQRDialog(true);
                }}
              >
                <IconQrcode className="mr-2 h-4 w-4" />
                QR Code
              </DropdownMenuItem>
            </ShareQrButton>
            {isStreamable && (
              <DropdownMenuItem
                onClick={() =>
                  handleCopy(
                    resolveUrl(`/hls/${file.slug}/index.m3u8`),
                    "Copied Stream URL to clipboard",
                  )
                }
                disabled={!file.isPublic}
              >
                <IconWaveSine className="mr-2 h-4 w-4 text-sky-500" />
                Copy Stream URL
              </DropdownMenuItem>
            )}
            {!file.isPublic && (
              <DropdownMenuItem
                disabled
                className="text-xs text-muted-foreground"
              >
                Make the file public to copy links.
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs uppercase text-muted-foreground">
            Actions
          </DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={() => {
                const a = document.createElement("a");
                a.href = resolveUrl(`/x/${file.slug}`);
                a.download = file.originalName;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
            >
              <IconDownload className="mr-2 h-4 w-4 text-emerald-500" />
              Download File
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteOpen(true)}
              variant="destructive"
              disabled={isDeleting}
            >
              <IconTrash className="mr-2 h-4 w-4 text-red-500" /> Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <FileRenameDialog
        file={file}
        open={renameOpen}
        onOpenChange={setRenameOpen}
        onUpdated={onFileUpdated}
      />
      <FileTagsFoldersDialog
        file={file}
        open={tagsOpen}
        onOpenChange={setTagsOpen}
        onUpdated={onFileUpdated}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete File"
        description={`Are you sure you want to delete ${file.originalName}? This cannot be undone.`}
        onConfirm={deleteFile}
      />

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Protect with password</DialogTitle>
            <DialogDescription>
              Set a password to require viewers to unlock before accessing this
              file. Leave empty to clear.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={passwordValue}
              onChange={(e) => setPasswordValue(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePassword} disabled={passwordSaving}>
              {passwordSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
