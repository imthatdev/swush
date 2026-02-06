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

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { apiV1 } from "@/lib/api-path";
import {
  NAME_CONVENTION_LABELS,
  NAME_CONVENTIONS,
  SLUG_CONVENTION_LABELS,
  SLUG_CONVENTIONS,
} from "@/lib/upload-conventions";
import type { NameConvention, SlugConvention } from "@/lib/upload-conventions";

type UploadSettingsForm = {
  nameConvention: NameConvention;
  slugConvention: SlugConvention;
  imageCompressionEnabled: boolean;
  imageCompressionQuality: number;
  mediaTranscodeEnabled: boolean;
  mediaTranscodeQuality: number;
};

const DEFAULT_FORM: UploadSettingsForm = {
  nameConvention: "original",
  slugConvention: "funny",
  imageCompressionEnabled: true,
  imageCompressionQuality: 85,
  mediaTranscodeEnabled: false,
  mediaTranscodeQuality: 70,
};

export default function UploadSettings() {
  const [form, setForm] = useState<UploadSettingsForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiV1("/profile/upload-settings"), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load upload settings");
        const data = (await res.json()) as { settings?: UploadSettingsForm };
        if (!active) return;
        setForm({
          nameConvention:
            data?.settings?.nameConvention ?? DEFAULT_FORM.nameConvention,
          slugConvention:
            data?.settings?.slugConvention ?? DEFAULT_FORM.slugConvention,
          imageCompressionEnabled:
            typeof data?.settings?.imageCompressionEnabled === "boolean"
              ? data.settings.imageCompressionEnabled
              : DEFAULT_FORM.imageCompressionEnabled,
          imageCompressionQuality:
            typeof data?.settings?.imageCompressionQuality === "number"
              ? data.settings.imageCompressionQuality
              : DEFAULT_FORM.imageCompressionQuality,
          mediaTranscodeEnabled:
            typeof data?.settings?.mediaTranscodeEnabled === "boolean"
              ? data.settings.mediaTranscodeEnabled
              : DEFAULT_FORM.mediaTranscodeEnabled,
          mediaTranscodeQuality:
            typeof data?.settings?.mediaTranscodeQuality === "number"
              ? data.settings.mediaTranscodeQuality
              : DEFAULT_FORM.mediaTranscodeQuality,
        });
      } catch (err) {
        if (!active) return;
        toast.error("Could not load upload settings", {
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

  const save = async (next: UploadSettingsForm) => {
    setSaving(true);
    try {
      const res = await fetch(apiV1("/profile/upload-settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Save failed");
      }
      toast.success("Upload settings saved");
      setForm(next);
    } catch (err) {
      toast.error("Failed to save upload settings", {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiV1("/profile/upload-settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Reset failed");
      }
      toast.success("Upload settings reset");
      setForm({ ...DEFAULT_FORM });
    } catch (err) {
      toast.error("Failed to reset upload settings", {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Name convention</Label>
          <Select
            value={form.nameConvention}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                nameConvention: value as NameConvention,
              }))
            }
          >
            <SelectTrigger className="w-full" disabled={loading || saving}>
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
          <Label>Slug convention</Label>
          <Select
            value={form.slugConvention}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                slugConvention: value as SlugConvention,
              }))
            }
          >
            <SelectTrigger className="w-full" disabled={loading || saving}>
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

        <div className="rounded-md border px-3 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Image compression</div>
              <div className="text-xs text-muted-foreground">
                Lossy optimization for image uploads.
              </div>
            </div>
            <Switch
              checked={form.imageCompressionEnabled}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  imageCompressionEnabled: checked,
                }))
              }
              disabled={loading || saving}
            />
          </div>
          <div className="grid gap-2">
            <Label>Quality: {form.imageCompressionQuality}%</Label>
            <Slider
              value={[form.imageCompressionQuality]}
              min={1}
              max={100}
              step={1}
              disabled={loading || saving || !form.imageCompressionEnabled}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  imageCompressionQuality:
                    value[0] ?? prev.imageCompressionQuality,
                }))
              }
            />
          </div>
        </div>

        <div className="rounded-md border px-3 py-3 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Video/audio transcoding</div>
              <div className="text-xs text-muted-foreground">
                Creates smaller media variants (slower uploads).
              </div>
            </div>
            <Switch
              checked={form.mediaTranscodeEnabled}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, mediaTranscodeEnabled: checked }))
              }
              disabled={loading || saving}
            />
          </div>
          <div className="grid gap-2">
            <Label>Quality: {form.mediaTranscodeQuality}%</Label>
            <Slider
              value={[form.mediaTranscodeQuality]}
              min={1}
              max={100}
              step={1}
              disabled={loading || saving || !form.mediaTranscodeEnabled}
              onValueChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  mediaTranscodeQuality: value[0] ?? prev.mediaTranscodeQuality,
                }))
              }
            />
          </div>
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
            onClick={reset}
            disabled={loading || saving}
          >
            Reset to default
          </Button>
        </div>
      </div>
    </section>
  );
}
