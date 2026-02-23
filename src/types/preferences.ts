/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

export type VaultSortOrder =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "size-asc"
  | "size-desc";
export type VisibilityDefault = "private" | "public";
export type SizeFormat = "auto" | "bytes" | "metric";
export type VaultViewMode = "list" | "grid";

export type UserPreferences = {
  revealSpoilers?: boolean;
  hidePreviews?: boolean;
  vaultView: VaultViewMode;
  vaultSort: VaultSortOrder;
  rememberLastFolder: boolean;
  lastFolder: string | null;
  autoplayMedia: boolean;
  openSharedInNewTab: boolean;
  hidePublicShareConfirmations: boolean;
  publicProfileEnabled: boolean;
  showSocialsOnShare?: boolean;
  socialInstagram?: string | null;
  socialX?: string | null;
  socialGithub?: string | null;
  socialWebsite?: string | null;
  socialOther?: string | null;
  defaultUploadVisibility: VisibilityDefault;
  defaultUploadFolder: string | null;
  defaultUploadTags: string[];
  defaultShortlinkVisibility: VisibilityDefault;
  defaultShortlinkTags: string[];
  defaultShortlinkMaxClicks: number | null;
  defaultShortlinkExpireDays: number | null;
  defaultShortlinkSlugPrefix: string;
  rememberSettingsTab: boolean;
  lastSettingsTab: "display" | "behavior" | "defaults";
  sizeFormat: SizeFormat;
  featureFilesEnabled: boolean;
  featureShortlinksEnabled: boolean;
  featureWatchlistEnabled: boolean;
};
