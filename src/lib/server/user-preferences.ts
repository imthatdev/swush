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

import "server-only";

import { db } from "@/db/client";
import { userPreferences } from "@/db/schemas/core-schema";
import { eq } from "drizzle-orm";
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
  showSocialsOnShare: false,
  socialInstagram: null,
  socialX: null,
  socialGithub: null,
  socialWebsite: null,
  socialOther: null,
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

async function ensurePreferencesRow(userId: string) {
  await db.insert(userPreferences).values({ userId }).onConflictDoNothing();
}

function normalizePreferences(
  input: Partial<UserPreferences>,
): Partial<UserPreferences> {
  const toBool = (value: unknown) =>
    typeof value === "boolean" ? value : undefined;
  const toEnum = <T extends string>(
    value: unknown,
    allowed: T[],
  ): T | undefined =>
    typeof value === "string" && allowed.includes(value as T)
      ? (value as T)
      : undefined;
  const toTrim = (value: unknown) =>
    typeof value === "string" ? value.trim() : undefined;
  const toNullableString = (value: unknown) => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };
  const toNum = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : undefined;
  const toStringArray = (value: unknown) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter(Boolean)
      : undefined;
  const vaultSortRaw =
    typeof input.vaultSort === "string"
      ? (input.vaultSort as string)
      : undefined;

  return {
    revealSpoilers: toBool(input.revealSpoilers),
    hidePreviews: toBool(input.hidePreviews),
    vaultView: toEnum(input.vaultView, ["list", "grid"]),
    vaultSort:
      vaultSortRaw === "name"
        ? "name-desc"
        : vaultSortRaw === "size"
          ? "size-desc"
          : toEnum(vaultSortRaw, [
              "newest",
              "oldest",
              "name-asc",
              "name-desc",
              "size-asc",
              "size-desc",
            ]),
    rememberLastFolder: toBool(input.rememberLastFolder),
    lastFolder: toTrim(input.lastFolder) ?? null,
    autoplayMedia: toBool(input.autoplayMedia),
    openSharedInNewTab: toBool(input.openSharedInNewTab),
    hidePublicShareConfirmations: toBool(input.hidePublicShareConfirmations),
    publicProfileEnabled: toBool(input.publicProfileEnabled),
    showSocialsOnShare: toBool(input.showSocialsOnShare),
    socialInstagram: toNullableString(input.socialInstagram),
    socialX: toNullableString(input.socialX),
    socialGithub: toNullableString(input.socialGithub),
    socialWebsite: toNullableString(input.socialWebsite),
    socialOther: toNullableString(input.socialOther),
    defaultUploadVisibility: toEnum(input.defaultUploadVisibility, [
      "private",
      "public",
    ]),
    defaultUploadFolder: toTrim(input.defaultUploadFolder) ?? null,
    defaultUploadTags: toStringArray(input.defaultUploadTags),
    defaultShortlinkVisibility: toEnum(input.defaultShortlinkVisibility, [
      "private",
      "public",
    ]),
    defaultShortlinkTags: toStringArray(input.defaultShortlinkTags),
    defaultShortlinkMaxClicks: toNum(input.defaultShortlinkMaxClicks) ?? null,
    defaultShortlinkExpireDays: toNum(input.defaultShortlinkExpireDays) ?? null,
    defaultShortlinkSlugPrefix:
      toTrim(input.defaultShortlinkSlugPrefix) ?? undefined,
    rememberSettingsTab: toBool(input.rememberSettingsTab),
    lastSettingsTab: toEnum(input.lastSettingsTab, [
      "display",
      "behavior",
      "defaults",
    ]),
    sizeFormat: toEnum(input.sizeFormat, ["auto", "bytes", "metric"]),
    featureFilesEnabled: toBool(input.featureFilesEnabled),
    featureShortlinksEnabled: toBool(input.featureShortlinksEnabled),
    featureWatchlistEnabled: toBool(input.featureWatchlistEnabled),
  };
}

export async function getUserPreferences(
  userId: string,
): Promise<UserPreferences> {
  await ensurePreferencesRow(userId);
  const row = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, userId),
  });
  if (!row) return { ...DEFAULT_PREFERENCES };

  return {
    revealSpoilers:
      typeof row.revealSpoilers === "boolean"
        ? row.revealSpoilers
        : DEFAULT_PREFERENCES.revealSpoilers,
    hidePreviews:
      typeof row.hidePreviews === "boolean"
        ? row.hidePreviews
        : DEFAULT_PREFERENCES.hidePreviews,
    vaultView:
      row.vaultView === "grid" || row.vaultView === "list"
        ? row.vaultView
        : DEFAULT_PREFERENCES.vaultView,
    vaultSort:
      row.vaultSort === "newest" ||
      row.vaultSort === "oldest" ||
      row.vaultSort === "name-asc" ||
      row.vaultSort === "name-desc" ||
      row.vaultSort === "size-asc" ||
      row.vaultSort === "size-desc"
        ? row.vaultSort
        : row.vaultSort === "name"
          ? "name-desc"
          : row.vaultSort === "size"
            ? "size-desc"
            : DEFAULT_PREFERENCES.vaultSort,
    rememberLastFolder:
      typeof row.rememberLastFolder === "boolean"
        ? row.rememberLastFolder
        : DEFAULT_PREFERENCES.rememberLastFolder,
    lastFolder: row.lastFolder ?? DEFAULT_PREFERENCES.lastFolder,
    autoplayMedia:
      typeof row.autoplayMedia === "boolean"
        ? row.autoplayMedia
        : DEFAULT_PREFERENCES.autoplayMedia,
    openSharedInNewTab:
      typeof row.openSharedInNewTab === "boolean"
        ? row.openSharedInNewTab
        : DEFAULT_PREFERENCES.openSharedInNewTab,
    hidePublicShareConfirmations:
      typeof row.hidePublicShareConfirmations === "boolean"
        ? row.hidePublicShareConfirmations
        : DEFAULT_PREFERENCES.hidePublicShareConfirmations,
    publicProfileEnabled:
      typeof row.publicProfileEnabled === "boolean"
        ? row.publicProfileEnabled
        : DEFAULT_PREFERENCES.publicProfileEnabled,
    showSocialsOnShare:
      typeof row.showSocialsOnShare === "boolean"
        ? row.showSocialsOnShare
        : DEFAULT_PREFERENCES.showSocialsOnShare,
    socialInstagram: row.socialInstagram ?? DEFAULT_PREFERENCES.socialInstagram,
    socialX: row.socialX ?? DEFAULT_PREFERENCES.socialX,
    socialGithub: row.socialGithub ?? DEFAULT_PREFERENCES.socialGithub,
    socialWebsite: row.socialWebsite ?? DEFAULT_PREFERENCES.socialWebsite,
    socialOther: row.socialOther ?? DEFAULT_PREFERENCES.socialOther,
    defaultUploadVisibility:
      row.defaultUploadVisibility === "public" ||
      row.defaultUploadVisibility === "private"
        ? row.defaultUploadVisibility
        : DEFAULT_PREFERENCES.defaultUploadVisibility,
    defaultUploadFolder: row.defaultUploadFolder ?? null,
    defaultUploadTags: Array.isArray(row.defaultUploadTags)
      ? row.defaultUploadTags.filter(Boolean)
      : DEFAULT_PREFERENCES.defaultUploadTags,
    defaultShortlinkVisibility:
      row.defaultShortlinkVisibility === "public" ||
      row.defaultShortlinkVisibility === "private"
        ? row.defaultShortlinkVisibility
        : DEFAULT_PREFERENCES.defaultShortlinkVisibility,
    defaultShortlinkTags:
      Array.isArray(row.defaultShortlinkTags) &&
      row.defaultShortlinkTags.length > 0
        ? row.defaultShortlinkTags
        : DEFAULT_PREFERENCES.defaultShortlinkTags,
    defaultShortlinkMaxClicks:
      typeof row.defaultShortlinkMaxClicks === "number"
        ? row.defaultShortlinkMaxClicks
        : DEFAULT_PREFERENCES.defaultShortlinkMaxClicks,
    defaultShortlinkExpireDays:
      typeof row.defaultShortlinkExpireDays === "number"
        ? row.defaultShortlinkExpireDays
        : DEFAULT_PREFERENCES.defaultShortlinkExpireDays,
    defaultShortlinkSlugPrefix:
      row.defaultShortlinkSlugPrefix?.trim() ||
      DEFAULT_PREFERENCES.defaultShortlinkSlugPrefix,
    rememberSettingsTab:
      typeof row.rememberSettingsTab === "boolean"
        ? row.rememberSettingsTab
        : DEFAULT_PREFERENCES.rememberSettingsTab,
    lastSettingsTab:
      row.lastSettingsTab === "display" ||
      row.lastSettingsTab === "behavior" ||
      row.lastSettingsTab === "defaults"
        ? row.lastSettingsTab
        : DEFAULT_PREFERENCES.lastSettingsTab,
    sizeFormat:
      row.sizeFormat === "bytes" ||
      row.sizeFormat === "metric" ||
      row.sizeFormat === "auto"
        ? row.sizeFormat
        : DEFAULT_PREFERENCES.sizeFormat,
    featureFilesEnabled:
      typeof row.featureFilesEnabled === "boolean"
        ? row.featureFilesEnabled
        : DEFAULT_PREFERENCES.featureFilesEnabled,
    featureShortlinksEnabled:
      typeof row.featureShortlinksEnabled === "boolean"
        ? row.featureShortlinksEnabled
        : DEFAULT_PREFERENCES.featureShortlinksEnabled,
    featureWatchlistEnabled:
      typeof row.featureWatchlistEnabled === "boolean"
        ? row.featureWatchlistEnabled
        : DEFAULT_PREFERENCES.featureWatchlistEnabled,
  };
}

export async function updateUserPreferences(
  userId: string,
  input: Partial<UserPreferences>,
): Promise<UserPreferences> {
  await ensurePreferencesRow(userId);
  const normalized = normalizePreferences(input);
  await db
    .update(userPreferences)
    .set({ ...normalized, updatedAt: new Date() })
    .where(eq(userPreferences.userId, userId));
  return getUserPreferences(userId);
}
