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

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  serial,
  primaryKey,
  index,
  uniqueIndex,
  varchar,
  json,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  account,
  apikey,
  deviceAuth,
  passkey,
  session,
  twoFactor,
  user,
} from "./auth-schema";

export const userRole = pgEnum("user_role", ["owner", "admin", "user"]);
export const maxViewsAction = pgEnum("max_views_action", [
  "make_private",
  "delete",
]);

export const userInfo = pgTable(
  "user_info",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    role: userRole("role").notNull().default("user"),
    bio: text("bio"),

    maxStorageMb: integer("max_storage_mb"),
    maxUploadMb: integer("max_upload_mb"),
    filesLimit: integer("files_limit"),
    shortLinksLimit: integer("short_links_limit"),
    allowRemoteUpload: boolean("allow_remote_upload"),
    disableApiTokens: boolean("disable_api_tokens").notNull().default(false),
    allowFiles: boolean("allow_files"),
    allowShortlinks: boolean("allow_shortlinks"),
    allowWatchlist: boolean("allow_watchlist"),
    verified: boolean("verified").notNull().default(false),

    banned: boolean("banned").default(false).notNull(),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [index("user_info_role_idx").on(self.role)],
);

export const userInfoRelations = relations(userInfo, ({ one }) => ({
  user: one(user, {
    fields: [userInfo.userId],
    references: [user.id],
  }),
}));

export const userEmbedSettings = pgTable(
  "user_embed_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    description: text("description"),
    siteName: text("site_name"),
    color: text("color"),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [index("user_embed_settings_user_id_idx").on(self.userId)],
);

export const userUploadSettings = pgTable(
  "user_upload_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    nameConvention: text("name_convention").notNull().default("original"),
    slugConvention: text("slug_convention").notNull().default("funny"),
    imageCompressionEnabled: boolean("image_compression_enabled")
      .notNull()
      .default(true),
    imageCompressionQuality: integer("image_compression_quality")
      .notNull()
      .default(85),
    mediaTranscodeEnabled: boolean("media_transcode_enabled")
      .notNull()
      .default(false),
    mediaTranscodeQuality: integer("media_transcode_quality")
      .notNull()
      .default(70),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [index("user_upload_settings_user_idx").on(self.userId)],
);

export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    revealSpoilers: boolean("reveal_spoilers").notNull().default(false),
    hidePreviews: boolean("hide_previews").notNull().default(false),
    vaultView: text("vault_view").notNull().default("list"),
    vaultSort: text("vault_sort").notNull().default("newest"),
    rememberLastFolder: boolean("remember_last_folder")
      .notNull()
      .default(false),
    lastFolder: text("last_folder"),
    autoplayMedia: boolean("autoplay_media").notNull().default(false),
    openSharedInNewTab: boolean("open_shared_in_new_tab")
      .notNull()
      .default(false),
    hidePublicShareConfirmations: boolean("hide_public_share_confirmations")
      .notNull()
      .default(false),
    publicProfileEnabled: boolean("public_profile_enabled")
      .notNull()
      .default(true),
    showSocialsOnShare: boolean("show_socials_on_share")
      .notNull()
      .default(false),
    socialInstagram: text("social_instagram"),
    socialX: text("social_x"),
    socialGithub: text("social_github"),
    socialWebsite: text("social_website"),
    socialOther: text("social_other"),
    defaultUploadVisibility: text("default_upload_visibility")
      .notNull()
      .default("private"),
    defaultUploadFolder: text("default_upload_folder"),
    defaultUploadTags: text("default_upload_tags").array().default([]),
    defaultShortlinkVisibility: text("default_shortlink_visibility")
      .notNull()
      .default("private"),
    defaultShortlinkTags: text("default_shortlink_tags").array().default([]),
    defaultShortlinkMaxClicks: integer("default_shortlink_max_clicks"),
    defaultShortlinkExpireDays: integer("default_shortlink_expire_days"),
    defaultShortlinkSlugPrefix: text("default_shortlink_slug_prefix")
      .notNull()
      .default(""),
    rememberSettingsTab: boolean("remember_settings_tab")
      .notNull()
      .default(true),
    lastSettingsTab: text("last_settings_tab").notNull().default("display"),
    sizeFormat: text("size_format").notNull().default("auto"),
    featureFilesEnabled: boolean("feature_files_enabled")
      .notNull()
      .default(true),
    featureShortlinksEnabled: boolean("feature_shortlinks_enabled")
      .notNull()
      .default(true),
    featureWatchlistEnabled: boolean("feature_watchlist_enabled")
      .notNull()
      .default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [index("user_preferences_user_id_idx").on(self.userId)],
);

export const userEmbedSettingsRelations = relations(
  userEmbedSettings,
  ({ one }) => ({
    user: one(user, {
      fields: [userEmbedSettings.userId],
      references: [user.id],
    }),
  }),
);

export const steamLink = pgTable(
  "steam_link",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    steamId64: text("steam_id_64").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [index("steam_link_steam_id_idx").on(self.steamId64)],
);

export const anilistLink = pgTable(
  "anilist_link",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [index("anilist_link_user_idx").on(self.userId)],
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),

    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    storageDriver: text("storage_driver").notNull().default("local"),
    slug: text("slug").unique().notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),

    description: text("description"),
    password: text("password"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    contentHash: text("content_hash"),

    isPublic: boolean("is_public").default(false),
    anonymousShareEnabled: boolean("anonymous_share_enabled")
      .default(false)
      .notNull(),
    views: integer("views").default(0),
    maxViews: integer("max_views"),
    maxViewsAction: maxViewsAction("max_views_action"),
    maxViewsTriggeredAt: timestamp("max_views_triggered_at"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (self) => [
    index("files_user_id_idx").on(self.userId),
    index("files_folder_id_idx").on(self.folderId),
    index("files_created_at_idx").on(self.createdAt),
    index("files_content_hash_idx").on(self.contentHash),
    index("files_user_created_idx").on(self.userId, self.createdAt),
    index("files_user_public_idx").on(self.userId, self.isPublic),
    index("files_user_favorite_idx").on(self.userId, self.isFavorite),
    index("files_user_mime_idx").on(self.userId, self.mimeType),
    index("files_user_folder_idx").on(self.userId, self.folderId),
  ],
);

export const audioMetadata = pgTable(
  "audio_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    title: text("title"),
    artist: text("artist"),
    album: text("album"),
    pictureDataUrl: text("picture_data_url"),
    gradient: text("gradient"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    uniqueIndex("audio_metadata_file_id_idx").on(self.fileId),
    index("audio_metadata_created_idx").on(self.createdAt),
  ],
);

export const uploadRequests = pgTable(
  "upload_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    slug: text("slug").unique().notNull(),
    folderName: text("folder_name"),
    brandColor: text("brand_color"),
    brandLogoUrl: text("brand_logo_url"),
    maxUploads: integer("max_uploads").default(0),
    uploadsCount: integer("uploads_count").default(0).notNull(),
    viewsCount: integer("views_count").default(0).notNull(),
    requiresApproval: boolean("requires_approval").default(false).notNull(),
    passwordHash: text("password_hash"),
    perUserUploadLimit: integer("per_user_upload_limit").default(0).notNull(),
    perUserWindowHours: integer("per_user_window_hours").default(24).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    index("upload_requests_user_id_idx").on(self.userId),
    index("upload_requests_slug_idx").on(self.slug),
  ],
);

export const uploadRequestItems = pgTable(
  "upload_request_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    uploadRequestId: uuid("upload_request_id")
      .notNull()
      .references(() => uploadRequests.id, { onDelete: "cascade" }),
    fileId: uuid("file_id").references(() => files.id, {
      onDelete: "set null",
    }),
    status: text("status").default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    decidedAt: timestamp("decided_at"),
    decidedBy: text("decided_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (self) => [
    index("upload_request_items_request_idx").on(self.uploadRequestId),
    index("upload_request_items_status_idx").on(self.status),
  ],
);

export const folders = pgTable(
  "folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    shareEnabled: boolean("share_enabled").default(false).notNull(),
    sharePassword: text("share_password"),
    shareSlug: text("share_slug").unique(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (self) => [index("folders_user_id_idx").on(self.userId)],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (self) => [index("tags_user_name_idx").on(self.userId, self.name)],
);

export const filesToTags = pgTable(
  "files_to_tags",
  {
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (self) => [
    primaryKey({ columns: [self.fileId, self.tagId] }),
    index("files_to_tags_file_id_idx").on(self.fileId),
    index("files_to_tags_tag_id_idx").on(self.tagId),
    index("files_to_tags_tag_file_idx").on(self.tagId, self.fileId),
  ],
);

export const serverSettings = pgTable("server_settings", {
  id: serial("id").primaryKey(),

  appName: text("app_name"),
  supportName: text("support_name"),
  supportEmail: text("support_email"),

  maxUploadMb: integer("max_upload_mb").notNull().default(1024),
  maxFilesPerUpload: integer("max_files_per_upload").notNull().default(25),
  allowPublicRegistration: boolean("allow_public_registration")
    .notNull()
    .default(true),
  passwordPolicyMinLength: integer("password_policy_min_length")
    .notNull()
    .default(10),
  preservedUsernames: text("preserved_usernames")
    .array()
    .default(process.env.PRESERVED_USERNAMES?.split(",") || []),

  userMaxStorageMb: integer("user_max_storage_mb").notNull().default(5120),
  adminMaxStorageMb: integer("admin_max_storage_mb").notNull().default(10240),
  userDailyQuotaMb: integer("user_daily_quota_mb").notNull().default(1024),
  adminDailyQuotaMb: integer("admin_daily_quota_mb").notNull().default(2048),
  shortLinksLimitUser: integer("short_links_limit_user").notNull().default(50),
  shortLinksLimitAdmin: integer("short_links_limit_admin")
    .notNull()
    .default(100),
  filesLimitUser: integer("files_limit_user").notNull().default(250),
  filesLimitAdmin: integer("files_limit_admin").notNull().default(500),

  allowedMimePrefixes: text("allowed_mime_prefixes").array(),
  disallowedExtensions: text("disallowed_extensions").array(),
  setupCompleted: boolean("setup_completed").notNull().default(false),
  allowRemoteUpload: boolean("allow_remote_upload").default(false),
  sponsorBannerEnabled: boolean("sponsor_banner_enabled")
    .notNull()
    .default(true),
  disableApiTokens: boolean("disable_api_tokens").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const shortLinks = pgTable(
  "short_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id),
    originalUrl: text("original_url").notNull(),
    slug: text("slug").unique().notNull(),
    isPublic: boolean("is_public").default(false),
    isFavorite: boolean("is_favorite").default(false),
    anonymousShareEnabled: boolean("anonymous_share_enabled")
      .default(false)
      .notNull(),

    description: text("description"),
    password: text("password"),
    maxClicks: integer("max_clicks"),
    clickCount: integer("click_count").default(0),
    maxViewsAction: maxViewsAction("max_views_action"),
    maxViewsTriggeredAt: timestamp("max_views_triggered_at"),
    tags: text("tags").array(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (self) => [
    index("short_links_user_id_idx").on(self.userId),
    index("short_links_created_at_idx").on(self.createdAt),
    index("short_links_expires_at_idx").on(self.expiresAt),
  ],
);

export const shortLinkTags = pgTable(
  "short_link_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (self) => [index("short_link_tags_user_name_idx").on(self.userId, self.name)],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 20 }).notNull().default("tmdb"),
    mediaType: varchar("media_type", { length: 20 }).notNull(),
    providerId: varchar("provider_id", { length: 64 }).notNull(),
    title: text("title").notNull(),
    posterPath: text("poster_path"),
    overview: text("overview"),
    year: integer("year"),
    status: varchar("status", { length: 20 }).notNull().default("planned"),
    rating: integer("rating"),
    notes: text("notes"),
    isPublic: boolean("is_public").notNull().default(true),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("watch_user_idx").on(t.userId),
    index("watch_public_idx").on(t.isPublic),
    index("watch_updated_idx").on(t.updatedAt),
  ],
);

export const watchProgress = pgTable(
  "watch_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => watchlistItems.id, { onDelete: "cascade" }),
    season: integer("season").notNull().default(0),
    episode: integer("episode").notNull(),
    watchedAt: timestamp("watched_at").defaultNow(),
  },
  (t) => [index("progress_item_idx").on(t.itemId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 255 }).notNull().primaryKey(),
  hits: integer("hits").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chainId: uuid("chain_id"),
    seq: integer("seq"),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 32 }),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 64 }).notNull(),
    targetId: text("target_id").notNull(),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 512 }),
    statusCode: varchar("status_code", { length: 3 }),
    meta: json("meta").default({}),
    previousHash: text("previous_hash"),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("audit_chain_idx").on(t.chainId, t.seq)],
);

export const integrationWebhooks = pgTable(
  "integration_webhooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secret: text("secret"),
    format: varchar("format", { length: 32 }).notNull().default("json"),
    events: json("events").default([]),
    enabled: boolean("enabled").notNull().default(true),
    lastStatus: integer("last_status"),
    lastError: text("last_error"),
    lastDeliveredAt: timestamp("last_delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (t) => [index("integration_webhooks_user_idx").on(t.userId)],
);

export const inviteTokens = pgTable("invite_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  note: text("note"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  maxUses: integer("max_uses"),
  usesCount: integer("uses_count").notNull().default(0),
  isDisabled: boolean("is_disabled").notNull().default(false),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  twoFactors: many(twoFactor),
  passkeys: many(passkey),
  apikeys: many(apikey),
  deviceAuth: many(deviceAuth),
  files: many(files),
  folders: many(folders),
  shortLinks: many(shortLinks),
  tags: many(tags, { relationName: "user_tags" }),
  integrationWebhooks: many(integrationWebhooks),
}));

export const filesRelations = relations(files, ({ one, many }) => ({
  owner: one(user, { fields: [files.userId], references: [user.id] }),
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
  tags: many(filesToTags),
  audioMeta: one(audioMetadata, {
    fields: [files.id],
    references: [audioMetadata.fileId],
  }),
}));

export const audioMetadataRelations = relations(audioMetadata, ({ one }) => ({
  file: one(files, {
    fields: [audioMetadata.fileId],
    references: [files.id],
  }),
}));

export const foldersRelations = relations(folders, ({ many, one }) => ({
  files: many(files),
  owner: one(user, { fields: [folders.userId], references: [user.id] }),
}));

export const tagsRelations = relations(tags, ({ many, one }) => ({
  owner: one(user, {
    fields: [tags.userId],
    references: [user.id],
    relationName: "user_tags",
  }),
  files: many(filesToTags),
}));

export const filesToTagsRelations = relations(filesToTags, ({ one }) => ({
  file: one(files, { fields: [filesToTags.fileId], references: [files.id] }),
  tag: one(tags, { fields: [filesToTags.tagId], references: [tags.id] }),
}));

export const shortLinksRelations = relations(shortLinks, ({ one }) => ({
  owner: one(user, { fields: [shortLinks.userId], references: [user.id] }),
}));

export const anilistLinkRelations = relations(anilistLink, ({ one }) => ({
  user: one(user, {
    fields: [anilistLink.userId],
    references: [user.id],
  }),
}));

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message"),
    type: text("type").default("system").notNull(),
    data: json("data"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (self) => [
    index("notifications_user_idx").on(self.userId),
    index("notifications_read_idx").on(self.readAt),
    index("notifications_created_idx").on(self.createdAt),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    index("push_subscriptions_user_idx").on(self.userId),
    uniqueIndex("push_subscriptions_endpoint_idx").on(self.endpoint),
  ],
);

export const mediaJobs = pgTable(
  "media_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    kind: text("kind").notNull(),
    quality: integer("quality").notNull(),
    outputMimeType: text("output_mime_type"),
    outputSize: integer("output_size"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    index("media_jobs_user_idx").on(self.userId),
    index("media_jobs_file_idx").on(self.fileId),
    index("media_jobs_status_idx").on(self.status),
    index("media_jobs_created_idx").on(self.createdAt),
  ],
);

export const previewJobs = pgTable(
  "preview_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    outputMimeType: text("output_mime_type"),
    outputSize: integer("output_size"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    index("preview_jobs_user_idx").on(self.userId),
    index("preview_jobs_file_idx").on(self.fileId),
    index("preview_jobs_status_idx").on(self.status),
    index("preview_jobs_created_idx").on(self.createdAt),
  ],
);

export const streamJobs = pgTable(
  "stream_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    quality: integer("quality"),
    outputMimeType: text("output_mime_type"),
    outputSize: integer("output_size"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    index("stream_jobs_user_idx").on(self.userId),
    index("stream_jobs_file_idx").on(self.fileId),
    index("stream_jobs_status_idx").on(self.status),
    index("stream_jobs_created_idx").on(self.createdAt),
  ],
);

export const storageCleanupJobs = pgTable(
  "storage_cleanup_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    storedName: text("stored_name").notNull(),
    storageDriver: text("storage_driver").notNull().default("local"),
    isPrefix: boolean("is_prefix").notNull().default(false),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    index("storage_cleanup_jobs_user_idx").on(self.userId),
    index("storage_cleanup_jobs_status_idx").on(self.status),
    index("storage_cleanup_jobs_created_idx").on(self.createdAt),
  ],
);

export const exportJobs = pgTable(
  "export_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("queued"),
    fileName: text("file_name"),
    storedName: text("stored_name"),
    storageDriver: text("storage_driver"),
    size: integer("size"),
    error: text("error"),
    options: json("options"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (self) => [
    index("export_jobs_user_idx").on(self.userId),
    index("export_jobs_status_idx").on(self.status),
    index("export_jobs_created_idx").on(self.createdAt),
  ],
);

export const adminJobRuns = pgTable(
  "admin_job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    job: text("job").notNull(),
    status: text("status").notNull(),
    result: json("result"),
    error: text("error"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
  },
  (self) => [index("admin_job_runs_created_idx").on(self.startedAt)],
);

export const importRuns = pgTable(
  "import_runs",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    userId: text("user_id").references(() => user.id),
    itemsTotal: integer("items_total").notNull().default(0),
    itemsOk: integer("items_ok").notNull().default(0),
    itemsFail: integer("items_fail").notNull().default(0),
    result: json("result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (self) => [
    index("import_runs_user_idx").on(self.userId),
    index("import_runs_created_idx").on(self.createdAt),
  ],
);

export const remoteUploadJobs = pgTable("remote_upload_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  url: text("url").notNull(),
  name: text("name"),
  status: text("status").notNull(),
  percent: integer("percent").notNull(),
  fileId: text("file_id"),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
