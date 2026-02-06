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

import { useEffect, useMemo, useState } from "react";
import { apiV1 } from "@/lib/api-path";

export type UserFeatureKey =
  | "notes"
  | "bookmarks"
  | "files"
  | "shortlinks"
  | "snippets"
  | "recipes"
  | "watchlist"
  | "gamelists"
  | "meetings";

export type UserFeatureState = {
  isEnabled: boolean;
  canEnable: boolean;
};

export type UserFeatureMap = Record<UserFeatureKey, UserFeatureState>;

const FEATURE_KEYS: UserFeatureKey[] = [
  "notes",
  "bookmarks",
  "files",
  "shortlinks",
  "snippets",
  "recipes",
  "watchlist",
  "gamelists",
  "meetings",
];

const DEFAULT_FEATURES = FEATURE_KEYS.reduce((acc, key) => {
  acc[key] = { isEnabled: true, canEnable: true };
  return acc;
}, {} as UserFeatureMap);

export function useUserFeatures() {
  const [features, setFeatures] = useState<UserFeatureMap>(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

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
          features?: Partial<UserFeatureMap>;
        };
        if (!active) return;
        if (data?.features) {
          setFeatures((prev) => ({ ...prev, ...data.features }));
        }
      } catch {
        if (!active) return;
        setFeatures(DEFAULT_FEATURES);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const featureList = useMemo(() => features, [features]);
  return { features: featureList, setFeatures, loading };
}
