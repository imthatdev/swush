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
import { apiV1 } from "@/lib/api-path";
import type { UserPreferences } from "@/types/preferences";

const DEFAULT_PREFERENCES: UserPreferences = {
  revealSpoilers: false,
  hidePreviews: false,
  vaultView: "list",
  vaultSort: "newest",
  rememberLastFolder: false,
  lastFolder: null,
  autoplayMedia: false,
  openSharedInNewTab: false,
  hidePublicShareConfirmations: false,
  publicProfileEnabled: true,
  defaultUploadVisibility: "private",
  defaultUploadFolder: null,
  defaultUploadTags: [],
  defaultShortlinkVisibility: "private",
  defaultShortlinkTags: [],
  defaultShortlinkMaxClicks: null,
  defaultShortlinkExpireDays: null,
  defaultShortlinkSlugPrefix: "",
  rememberSettingsTab: true,
  lastSettingsTab: "display",
  sizeFormat: "auto",
  featureFilesEnabled: true,
  featureShortlinksEnabled: true,
  featureWatchlistEnabled: true,
};

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiV1("/profile/preferences"), {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load preferences");
        const data = (await res.json()) as { settings?: UserPreferences };
        if (!active) return;
        setPrefs({ ...DEFAULT_PREFERENCES, ...(data?.settings ?? {}) });
      } catch {
        if (!active) return;
        setPrefs(DEFAULT_PREFERENCES);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const savePreferences = async (next: UserPreferences) => {
    const res = await fetch(apiV1("/profile/preferences"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) throw new Error("Failed to save preferences");
    const data = (await res.json()) as { settings?: UserPreferences };
    const updated = { ...DEFAULT_PREFERENCES, ...(data?.settings ?? next) };
    setPrefs(updated);
    return updated;
  };

  return { prefs, setPrefs, savePreferences, loading };
}
