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

"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { apiV1 } from "@/lib/api-path";

type EmbedForm = {
  title: string;
  description: string;
  color: string;
  imageUrl: string;
};

const emptyForm: EmbedForm = {
  title: "",
  description: "",
  color: "",
  imageUrl: "",
};

export default function EmbedSettings() {
  const [form, setForm] = useState<EmbedForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiV1("/profile/embed"), {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load embed settings");
        const data = (await res.json()) as {
          settings?: Partial<EmbedForm> | null;
        };
        if (!active) return;
        const next = data?.settings || {};
        setForm({
          title: next.title ?? "",
          description: next.description ?? "",
          color: next.color ?? "",
          imageUrl: next.imageUrl ?? "",
        });
      } catch (err) {
        if (!active) return;
        toast.error("Could not load embed settings", {
          description: (err as Error).message,
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const updateField = (key: keyof EmbedForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (nextForm: EmbedForm) => {
    setSaving(true);
    try {
      const res = await fetch(apiV1("/profile/embed"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextForm),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Save failed");
      }
      toast.success("Embed settings saved");
      setForm(nextForm);
    } catch (err) {
      toast.error("Failed to save embed settings", {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = async () => {
    await save({ ...emptyForm });
  };

  return (
    <section>
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="embed-title">Title</Label>
          <Input
            id="embed-title"
            value={form.title}
            disabled={loading || saving}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Default embed title"
          />
          <p className="text-xs text-muted-foreground/80">
            Placeholders: {"{name}"} {"{file}"} {"{size}"} {"{slug}"}{" "}
            {"{username}"} {"{app}"} {"{kind}"}
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="embed-description">Description</Label>
          <Textarea
            id="embed-description"
            value={form.description}
            disabled={loading || saving}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Short description for embeds"
          />
          <p className="text-xs text-muted-foreground/80">
            Uses the same placeholders as the title.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="embed-color">Accent color</Label>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-muted/40 p-3">
            <input
              ref={colorInputRef}
              id="embed-color"
              type="color"
              value={form.color || "#000000"}
              disabled={loading || saving}
              onChange={(e) => updateField("color", e.target.value)}
              className="sr-only"
            />
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              disabled={loading || saving}
              aria-label="Pick accent color"
              className="h-11 w-11 rounded-full border border-border/70 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ backgroundColor: form.color || "#0f172a" }}
            />
            <div className="flex min-w-55 flex-1 items-center gap-2">
              <Input
                value={form.color}
                disabled={loading || saving}
                onChange={(e) => updateField("color", e.target.value)}
                placeholder="#1f2937"
                className="font-mono"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Used for the embed theme color. Leave empty to use the default.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="embed-image">Image URL</Label>
          <Input
            id="embed-image"
            value={form.imageUrl}
            disabled={loading || saving}
            onChange={(e) => updateField("imageUrl", e.target.value)}
            placeholder="https://example.com/og.png"
          />
          <p className="text-xs text-muted-foreground">
            Setting an image here overrides the content preview image.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => save(form)}
            disabled={loading || saving}
          >
            {saving ? "Saving..." : "Save settings"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={resetToDefault}
            disabled={loading || saving}
          >
            Reset to default
          </Button>
        </div>
      </div>
    </section>
  );
}
