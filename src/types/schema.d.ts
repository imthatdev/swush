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

import {
  files,
  audioMetadata,
  filesToTags,
  folders,
  serverSettings,
  tags,
  shortLinks,
  rateLimits,
  apiTokens,
  inviteTokens,
  auditLog,
  userEmbedSettings,
  exportJobs,
  userUploadSettings,
  apiKeySecrets,
  pushSubscriptions,
  mediaJobs,
  user,
} from "@/db/schemas";
import type { auth } from "@/lib/auth";
import { ApiKey } from "better-auth/plugins";

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof user.$inferSelect;

export type APIKey = ApiKey;

export interface Summary {
  storage: {
    usedStorageMb: number;
    maxStorageMb: number | null;
    remainingStorageMb?: number | null;
  };
  dailyQuota: {
    usedTodayMb: number;
    dailyQuotaMb: number | null;
    remainingTodayMb?: number | null;
  };
  perUpload: {
    maxUploadMb: number | null;
    maxFilesPerUpload: number | null;
  };
  resources: {
    files: { used: number; limit: number | null; remaining?: number | null };
    shortLink: {
      used: number;
      limit: number | null;
      remaining?: number | null;
    };
  };
  features: {
    remoteUpload?: boolean;
  };
}

export type DBFile = InferSelectModel<typeof files>;
export type NewDBFile = InferInsertModel<typeof files>;

export type DBAudioMetadata = InferSelectModel<typeof audioMetadata>;
export type NewDBAudioMetadata = InferInsertModel<typeof audioMetadata>;

export type DBFolder = InferSelectModel<typeof folders>;
export type NewDBFolder = InferInsertModel<typeof folders>;

export type DBTag = InferSelectModel<typeof tags>;
export type NewDBTag = InferInsertModel<typeof tags>;

export type DBFileToTag = InferSelectModel<typeof filesToTags>;
export type NewDBFileToTag = InferInsertModel<typeof filesToTags>;

export type DBServerSettings = InferSelectModel<typeof serverSettings>;
export type NewDBServerSettings = InferInsertModel<typeof serverSettings>;

export type DBShortLink = InferSelectModel<typeof shortLinks>;
export type NewDBShortLink = InferInsertModel<typeof shortLinks>;

export type DBRateLimit = InferSelectModel<typeof rateLimits>;
export type NewDBRateLimit = InferInsertModel<typeof rateLimits>;

export type DBApiToken = InferSelectModel<typeof apiTokens>;
export type NewDBApiToken = InferInsertModel<typeof apiTokens>;

export type DBNote = InferSelectModel<typeof notes>;
export type NewDBNote = InferInsertModel<typeof notes>;

export type DBBookmark = InferSelectModel<typeof bookmarks>;
export type NewDBBookmark = InferInsertModel<typeof bookmarks>;

export type DBSnippet = InferSelectModel<typeof snippets>;
export type NewDBSnippet = InferInsertModel<typeof snippets>;

export type DBRecipe = InferSelectModel<typeof recipes>;
export type NewDBRecipe = InferInsertModel<typeof recipes>;

export type DBUserEmbedSettings = InferSelectModel<typeof userEmbedSettings>;
export type NewDBUserEmbedSettings = InferInsertModel<typeof userEmbedSettings>;

export type DBUserUploadSettings = InferSelectModel<typeof userUploadSettings>;
export type NewDBUserUploadSettings = InferInsertModel<
  typeof userUploadSettings
>;

export type DBPushSubscription = InferSelectModel<typeof pushSubscriptions>;
export type NewDBPushSubscription = InferInsertModel<typeof pushSubscriptions>;

export type DBMediaJob = InferSelectModel<typeof mediaJobs>;
export type NewDBMediaJob = InferInsertModel<typeof mediaJobs>;

export type DBInviteToken = InferSelectModel<typeof inviteTokens>;
export type NewDBInviteToken = InferInsertModel<typeof inviteTokens>;

export type DBExportJob = InferSelectModel<typeof exportJobs>;
export type NewDBExportJob = InferInsertModel<typeof exportJobs>;

export type DBApiKeySecret = InferSelectModel<typeof apiKeySecrets>;
export type NewDBApiKeySecret = InferInsertModel<typeof apiKeySecrets>;

export type DBAuditLog = InferSelectModel<typeof auditLog>;
export type NewDBAuditLog = InferInsertModel<typeof auditLog>;
