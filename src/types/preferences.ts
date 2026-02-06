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
