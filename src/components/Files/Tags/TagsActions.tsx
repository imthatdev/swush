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

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";
import ColorPicker from "@/components/Common/ColorPicker";
import { formatTagName } from "@/lib/tag-names";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(50, "Keep it under 50 chars"),
});

type Props = {
  tagId: string;
  tagName: string;
  tagColor?: string | null;
  onUpdated?: (next: { id: string; name: string; color?: string | null }) => void;
};

export default function TagActions({
  tagId,
  tagName,
  tagColor,
  onUpdated,
}: Props) {
  const [openRename, setOpenRename] = React.useState(false);
  const [openDelete, setOpenDelete] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const [color, setColor] = React.useState<string | null>(tagColor ?? null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: formatTagName(tagName) },
    values: { name: formatTagName(tagName) },
  });

  React.useEffect(() => {
    setColor(tagColor ?? null);
  }, [tagColor, openRename]);

  async function onRename(values: z.infer<typeof schema>) {
    try {
      setWorking(true);
      const res = await fetch(apiV1("/tags"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tagId, name: values.name, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to rename tag");
      setOpenRename(false);
      toast.success("Tag renamed", {
        description: `#${formatTagName(values.name)}`,
      });
      if (onUpdated && data?.id && data?.name) {
        onUpdated({ id: data.id, name: data.name, color: data.color ?? null });
      } else if (onUpdated) {
        onUpdated({ id: tagId, name: values.name, color });
      }
    } catch (e) {
      toast.error("Rename failed", { description: (e as Error).message });
    } finally {
      setWorking(false);
    }
  }

  async function onDelete() {
    try {
      setWorking(true);
      const res = await fetch(apiV1("/tags"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tagId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to delete tag");
      setOpenDelete(false);
      toast.success("Tag deleted", { description: `#${tagName}` });
      router.push("/tags");
      router.refresh();
    } catch (e) {
      toast.error("Delete failed", { description: (e as Error).message });
    } finally {
      setWorking(false);
    }
  }

  const RenameButton = (
    <Button variant="secondary" size="sm" className="w-20">
      Edit
    </Button>
  );
  const DeleteButton = (
    <Button variant="destructive" size="sm" className="w-20">
      Delete
    </Button>
  );

  return (
    <div className="flex flex-col items-center justify-between gap-2">
      <Dialog
        open={openRename}
        onOpenChange={(o) => {
          setOpenRename(o);
          reset({ name: formatTagName(tagName) });
        }}
      >
        <DialogTrigger asChild>{RenameButton}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit tag</DialogTitle>
            <DialogDescription>
              Tag names are capitalized and unique per user.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={handleSubmit(onRename)}>
            <div className="grid gap-2">
              <Label htmlFor="name">Tag name</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="e.g. invoices"
              />
              {errors.name && (
                <p className="text-sm text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <ColorPicker
              id={`tag-color-${tagId}`}
              label="Tag color"
              value={color}
              onChange={setColor}
              disabled={isSubmitting || working}
              hint="Color shows on tag badges and filters."
            />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenRename(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || working}>
                {working ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogTrigger asChild>{DeleteButton}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete tag?</DialogTitle>
            <DialogDescription>
              This removes the tag and its file associations. Files remain
              untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={working}>
              {working ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
