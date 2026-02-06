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

import type React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaxViewsFields } from "@/components/Common/MaxViewsFields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { FolderMeta, TagMeta } from "@/types";
import {
  FolderInputWithSuggestions,
  TagChipsInput,
} from "@/components/Upload/FolderInputWithSuggestions";
import type { UploadItem } from "@/components/Upload/types";
import {
  NAME_CONVENTION_LABELS,
  NAME_CONVENTIONS,
  SLUG_CONVENTION_LABELS,
  SLUG_CONVENTIONS,
} from "@/lib/upload-conventions";
import type { NameConvention, SlugConvention } from "@/lib/upload-conventions";

export default function UploadEditDialog({
  open,
  onOpenChange,
  files,
  editingFileIndex,
  previewUrls,
  customName,
  setCustomName,
  lockedExt,
  description,
  setDescription,
  isPublic,
  setIsPublic,
  folderName,
  setFolderName,
  vanitySlug,
  setVanitySlug,
  maxViews,
  setMaxViews,
  maxViewsAction,
  setMaxViewsAction,
  nameConvention,
  setNameConvention,
  slugConvention,
  setSlugConvention,
  tagsChips,
  setTagsChips,
  tagDraft,
  setTagDraft,
  tags,
  folders,
  folderFocused,
  setFolderFocused,
  tagsFocused,
  setTagsFocused,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: UploadItem[];
  editingFileIndex: number | null;
  previewUrls: Map<File, string>;
  customName: string;
  setCustomName: (value: string) => void;
  lockedExt: string;
  description: string;
  setDescription: (value: string) => void;
  isPublic: boolean;
  setIsPublic: (value: boolean) => void;
  folderName: string;
  setFolderName: (value: string) => void;
  vanitySlug: string;
  setVanitySlug: (value: string) => void;
  maxViews: number | "";
  setMaxViews: (value: number | "") => void;
  maxViewsAction: "make_private" | "delete" | "";
  setMaxViewsAction: (value: "make_private" | "delete" | "") => void;
  nameConvention: NameConvention;
  setNameConvention: (value: NameConvention) => void;
  slugConvention: SlugConvention;
  setSlugConvention: (value: SlugConvention) => void;
  tagsChips: string[];
  setTagsChips: React.Dispatch<React.SetStateAction<string[]>>;
  tagDraft: string;
  setTagDraft: (value: string) => void;
  tags: TagMeta[];
  folders: FolderMeta[];
  folderFocused: boolean;
  setFolderFocused: (value: boolean) => void;
  tagsFocused: boolean;
  setTagsFocused: (value: boolean) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>Edit a file</DialogTitle>
          <DialogDescription>
            Configure this file&apos;s settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          {editingFileIndex !== null && files[editingFileIndex] && (
            <>
              {files[editingFileIndex].file.type.startsWith("image/") && (
                <Image
                  src={previewUrls.get(files[editingFileIndex].file) || ""}
                  alt="Preview"
                  width={200}
                  height={200}
                  className="rounded object-cover"
                />
              )}

              <div className="grid gap-2">
                <Label htmlFor="customName">Rename (optional)</Label>
                <div className="grid grid-cols-4 gap-1">
                  <Input
                    id="customName"
                    value={customName || files[editingFileIndex].file.name}
                    onChange={(e) => {
                      const next = e.target.value ?? "";
                      const safeBase = next.split(".")[0];
                      setCustomName(safeBase);
                    }}
                    placeholder="Custom filename"
                    className="col-span-3 bg-transparent outline-none placeholder:text-muted-foreground"
                  />
                  {lockedExt && (
                    <Input
                      value={`${lockedExt}`}
                      disabled
                      className="select-none bg-transparent outline-none text-muted-foreground"
                    />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  Leave blank to use the naming convention.
                </span>
              </div>

              <div className="grid gap-2">
                <Label>Name convention</Label>
                <Select
                  value={nameConvention}
                  onValueChange={(value) =>
                    setNameConvention(value as NameConvention)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a naming style" />
                  </SelectTrigger>
                  <SelectContent>
                    {NAME_CONVENTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {NAME_CONVENTION_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vanitySlug">Vanity Slug (optional)</Label>
                <Input
                  id="vanitySlug"
                  value={vanitySlug}
                  onChange={(e) => setVanitySlug(e.target.value)}
                  placeholder="custom-short-link"
                />
                <span className="text-xs text-muted-foreground">
                  Allowed: letters, numbers, dashes, underscores
                </span>
              </div>

              <div className="grid gap-2">
                <Label>Slug convention</Label>
                <Select
                  value={slugConvention}
                  onValueChange={(value) =>
                    setSlugConvention(value as SlugConvention)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a slug style" />
                  </SelectTrigger>
                  <SelectContent>
                    {SLUG_CONVENTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {SLUG_CONVENTION_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {files[editingFileIndex].file.type.startsWith("audio/") && (
                <audio controls className="w-full">
                  <source
                    src={previewUrls.get(files[editingFileIndex].file) || ""}
                    type={files[editingFileIndex].file.type}
                  />
                  Your browser does not support the audio element.
                </audio>
              )}
              {files[editingFileIndex].file.type.startsWith("video/") && (
                <video controls className="w-full rounded">
                  <source
                    src={previewUrls.get(files[editingFileIndex].file) || ""}
                    type={files[editingFileIndex].file.type}
                  />
                  Your browser does not support the video tag.
                </video>
              )}

              <div className="grid gap-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this file?"
                />
              </div>

              <FolderInputWithSuggestions
                id="folderName"
                label="Folder (optional)"
                value={folderName}
                onChange={setFolderName}
                focused={folderFocused}
                setFocused={setFolderFocused}
                folders={folders}
                placeholder="e.g. Invoices / 2025"
              />

              <TagChipsInput
                id="tags"
                label="Tags (optional)"
                chips={tagsChips}
                setChips={setTagsChips}
                draft={tagDraft}
                setDraft={setTagDraft}
                focused={tagsFocused}
                setFocused={setTagsFocused}
                availableTags={tags}
              />

              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <Label htmlFor="publicSwitch">Public File?</Label>
                <Switch
                  id="publicSwitch"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>

              <MaxViewsFields
                currentViews={0}
                maxViews={maxViews}
                onMaxViewsChange={setMaxViews}
                maxViewsAction={maxViewsAction}
                onMaxViewsActionChange={setMaxViewsAction}
              />

              <div className="flex justify-end pt-2">
                <Button onClick={onSave}>Save</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
