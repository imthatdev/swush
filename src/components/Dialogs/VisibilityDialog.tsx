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

import { IconLoader2, IconLock, IconLockOpen } from "@tabler/icons-react";
import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Upload } from "@/types";
import { apiV1 } from "@/lib/api-path";

export default function VisibilityDialog({
  file,
  setItems,
  skipConfirmation = false,
}: {
  file: Upload;
  setItems: React.Dispatch<React.SetStateAction<Upload[]>>;
  skipConfirmation?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const filesUrl = (path = "") => apiV1(`/files${path}`);
  const keyFor = (f: Upload) => (f.slug ? String(f.slug) : f.id);

  const toggleVisibility = async () => {
    if (saving) return;
    setSaving(true);
    const next = !file.isPublic;
    try {
      const res = await fetch(filesUrl(`/${keyFor(file)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((f) => (f.id === file.id ? { ...f, isPublic: next } : f)),
        );
        toast.success(next ? "Made Public" : "Made Private");
      } else {
        toast.error("Failed to change visibility");
      }
    } finally {
      setSaving(false);
    }
  };

  if (skipConfirmation) {
    return (
      <Button
        variant="ghost"
        size="icon"
        aria-label={file.isPublic ? "Make private" : "Make public"}
        disabled={saving}
        onClick={(e) => {
          e.preventDefault();
          void toggleVisibility();
        }}
      >
        {file.isPublic ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-2 text-xs font-medium">
            {saving ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <IconLockOpen size={14} />
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-2 py-2 text-xs font-medium">
            {saving ? (
              <IconLoader2 size={14} className="animate-spin" />
            ) : (
              <IconLock size={14} />
            )}
          </span>
        )}
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label={file.isPublic ? "Make private" : "Make public"}
          disabled={saving}
        >
          {file.isPublic ? (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-2 text-xs font-medium">
                {saving ? (
                  <IconLoader2 size={14} className="animate-spin" />
                ) : (
                  <IconLockOpen size={14} />
                )}
              </span>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-md bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-2 py-2 text-xs font-medium">
                {saving ? (
                  <IconLoader2 size={14} className="animate-spin" />
                ) : (
                  <IconLock size={14} />
                )}
              </span>
            </div>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {file.isPublic
              ? "Make this file private?"
              : "Make this file public?"}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          {file.isPublic
            ? "Only you will be able to view this file."
            : "Anyone with the link will be able to view this file."}
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              await toggleVisibility();
            }}
            disabled={saving}
          >
            {saving ? "Saving..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
