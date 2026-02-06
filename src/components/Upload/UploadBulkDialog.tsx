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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { FolderMeta, TagMeta } from "@/types";
import {
  FolderInputWithSuggestions,
  TagChipsInput,
} from "@/components/Upload/FolderInputWithSuggestions";
import {
  NAME_CONVENTION_LABELS,
  NAME_CONVENTIONS,
  SLUG_CONVENTION_LABELS,
  SLUG_CONVENTIONS,
} from "@/lib/upload-conventions";

export default function UploadBulkDialog({
  open,
  onOpenChange,
  bulkMakePublic,
  setBulkMakePublic,
  bulkExpireAt,
  setBulkExpireAt,
  bulkFolder,
  setBulkFolder,
  bulkFolderFocused,
  setBulkFolderFocused,
  bulkTagsChips,
  setBulkTagsChips,
  bulkTagDraft,
  setBulkTagDraft,
  bulkTagsFocused,
  setBulkTagsFocused,
  bulkNameConvention,
  setBulkNameConvention,
  bulkSlugConvention,
  setBulkSlugConvention,
  keepValue,
  folders,
  tags,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bulkMakePublic: boolean;
  setBulkMakePublic: (value: boolean) => void;
  bulkExpireAt: string;
  setBulkExpireAt: (value: string) => void;
  bulkFolder: string;
  setBulkFolder: (value: string) => void;
  bulkFolderFocused: boolean;
  setBulkFolderFocused: (value: boolean) => void;
  bulkTagsChips: string[];
  setBulkTagsChips: React.Dispatch<React.SetStateAction<string[]>>;
  bulkTagDraft: string;
  setBulkTagDraft: (value: string) => void;
  bulkTagsFocused: boolean;
  setBulkTagsFocused: (value: boolean) => void;
  bulkNameConvention: string;
  setBulkNameConvention: (value: string) => void;
  bulkSlugConvention: string;
  setBulkSlugConvention: (value: string) => void;
  keepValue: string;
  folders: FolderMeta[];
  tags: TagMeta[];
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk update files</DialogTitle>
          <DialogDescription>
            Apply settings to all files currently in your queue.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <Label htmlFor="bulkPublic">Make all Public</Label>
            <Switch
              id="bulkPublic"
              checked={bulkMakePublic}
              onCheckedChange={setBulkMakePublic}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bulkExpires">Expire At (optional)</Label>
            <Input
              id="bulkExpires"
              type="datetime-local"
              value={bulkExpireAt}
              onChange={(e) => setBulkExpireAt(e.target.value)}
            />
          </div>

          <FolderInputWithSuggestions
            id="bulkFolder"
            label="Folder (optional)"
            value={bulkFolder}
            onChange={setBulkFolder}
            focused={bulkFolderFocused}
            setFocused={setBulkFolderFocused}
            folders={folders}
            placeholder="e.g. Receipts"
          />

          <TagChipsInput
            id="bulkTags"
            label="Tags"
            chips={bulkTagsChips}
            setChips={setBulkTagsChips}
            draft={bulkTagDraft}
            setDraft={setBulkTagDraft}
            focused={bulkTagsFocused}
            setFocused={setBulkTagsFocused}
            availableTags={tags}
          />

          <div className="grid gap-2">
            <Label>Name convention</Label>
            <Select
              value={bulkNameConvention}
              onValueChange={setBulkNameConvention}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Keep current" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={keepValue}>Keep current</SelectItem>
                {NAME_CONVENTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {NAME_CONVENTION_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Slug convention</Label>
            <Select
              value={bulkSlugConvention}
              onValueChange={setBulkSlugConvention}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Keep current" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={keepValue}>Keep current</SelectItem>
                {SLUG_CONVENTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {SLUG_CONVENTION_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onApply}>Apply to All</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
