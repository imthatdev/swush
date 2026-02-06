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
import { Switch } from "@/components/ui/switch";
import { apiV1 } from "@/lib/api-path";

type FeatureKey =
  | "notes"
  | "bookmarks"
  | "files"
  | "shortlinks"
  | "snippets"
  | "recipes"
  | "watchlist"
  | "gamelists"
  | "meetings";

type FeatureState = {
  isEnabled: boolean;
  canEnable: boolean;
};

const FEATURE_LIST: Array<{
  key: FeatureKey;
  label: string;
  description: string;
  unavailable?: boolean;
}> = [
  { key: "files", label: "Files", description: "Upload and manage files." },
  {
    key: "notes",
    label: "Notes",
    description: "Not available in CE, only Pro edition.",
    unavailable: true,
  },
  {
    key: "bookmarks",
    label: "Bookmarks",
    description: "Not available in CE, only Pro edition.",
    unavailable: true,
  },
  {
    key: "shortlinks",
    label: "Short links",
    description: "Create short URLs.",
  },
  {
    key: "snippets",
    label: "Snippets",
    description: "Not available in CE, only Pro edition.",
    unavailable: true,
  },
  {
    key: "recipes",
    label: "Recipes",
    description: "Not available in CE, only Pro edition.",
    unavailable: true,
  },
  {
    key: "watchlist",
    label: "Watchlist",
    description: "Track shows and movies.",
  },
  {
    key: "gamelists",
    label: "Game lists",
    description: "Not available in CE, only Pro edition.",
    unavailable: true,
  },
  {
    key: "meetings",
    label: "Meetings",
    description: "Not available in CE, only Pro edition.",
    unavailable: true,
  },
];

export default function FeaturesSettings() {
  const [features, setFeatures] = useState<Record<FeatureKey, FeatureState>>(
    FEATURE_LIST.reduce(
      (acc, feature) => {
        acc[feature.key] = { isEnabled: false, canEnable: true };
        return acc;
      },
      {} as Record<FeatureKey, FeatureState>,
    ),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiV1("/profile/feature-settings"), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load feature settings");
        const data = (await res.json()) as {
          features?: Record<FeatureKey, FeatureState>;
        };
        if (!active) return;
        if (data?.features) {
          setFeatures((prev) => ({ ...prev, ...data.features }));
        }
      } catch (err) {
        if (!active) return;
        toast.error("Could not load features", {
          description: (err as Error).message,
        });
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const toggleFeature = async (key: FeatureKey, enabled: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(apiV1("/profile/feature-settings"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: enabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || body?.message || "Save failed");
      }
      setFeatures((prev) => ({
        ...prev,
        [key]: { ...prev[key], isEnabled: enabled },
      }));
      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error("Failed to update feature", {
        description: (err as Error).message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-md border px-4 py-4 space-y-4">
        {FEATURE_LIST.map((feature) => {
          const state = features[feature.key];
          const disabled =
            loading || saving || !state?.canEnable || feature.unavailable;
          return (
            <div
              key={feature.key}
              className="flex items-center justify-between gap-4"
            >
              <div>
                <div className="text-sm font-medium">{feature.label}</div>
                <div className="text-xs text-muted-foreground">
                  {feature.description}
                </div>
                {!state?.canEnable && (
                  <div className="text-xs text-muted-foreground">
                    Disabled by admin.
                  </div>
                )}
              </div>
              <Switch
                checked={Boolean(state?.isEnabled)}
                onCheckedChange={(val) => toggleFeature(feature.key, val)}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
