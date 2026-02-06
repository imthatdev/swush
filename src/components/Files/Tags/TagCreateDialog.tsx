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

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

export default function TagCreateDialog({
  onCreated,
}: {
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [color, setColor] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  async function onCreate(values: z.infer<typeof schema>) {
    try {
      setWorking(true);
      const res = await fetch(apiV1("/tags"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, color }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to create tag");
      toast.success("Tag created", {
        description: `#${formatTagName(values.name)}`,
      });
      setOpen(false);
      reset({ name: "" });
      setColor(null);
      onCreated();
    } catch (e) {
      toast.error("Create failed", { description: (e as Error).message });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset({ name: "" });
          setColor(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">+ New Tag</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create tag</DialogTitle>
          <DialogDescription>
            Tags are capitalized and unique per user.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={handleSubmit(onCreate)}>
          <div className="grid gap-2">
            <Label htmlFor="tag-name">Tag name</Label>
            <Input
              id="tag-name"
              {...register("name")}
              placeholder="e.g. invoices"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <ColorPicker
            id="tag-create-color"
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
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || working}>
              {working ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
