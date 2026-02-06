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

import { UploadWrapper } from "@/types";

export type Summary = {
  resources: {
    files: { used: number; limit: number; remaining: number | typeof Infinity };
    shortLink: {
      used: number;
      limit: number;
      remaining: number | typeof Infinity;
    };
    recipe: {
      used: number;
      limit: number;
      remaining: number | typeof Infinity;
    };
    note: { used: number; limit: number; remaining: number | typeof Infinity };
    snippet: {
      used: number;
      limit: number;
      remaining: number | typeof Infinity;
    };
    bookmark: {
      used: number;
      limit: number;
      remaining: number | typeof Infinity;
    };
  };
  storage: {
    maxStorageMb: number | typeof Infinity;
    usedStorageMb: number;
    remainingStorageMb: number | typeof Infinity;
  };
  dailyQuota: {
    dailyQuotaMb: number | typeof Infinity;
    usedTodayMb: number;
    remainingTodayMb: number | typeof Infinity;
  };
  perUpload: {
    maxUploadMb: number;
    maxFilesPerUpload: number;
  };
  features: {
    remoteUpload: boolean;
  };
};

export type UploadPayload = {
  name?: string;
  description: string;
  isPublic: boolean;
  maxViews?: number | null;
  maxViewsAction?: "make_private" | "delete" | "";
  folderId?: string;
  folderName?: string;
  tagIds: string[];
  newTags: string[];
  slug: string;
  nameConvention?: string;
  slugConvention?: string;
  file: File;
};

export type MaxViewsAction = "make_private" | "delete" | "";

export type UploadItem = UploadWrapper & {
  progress?: number;
  uploaded?: boolean;
  error?: string;
  shareUrl?: string;
  folderName?: string;
  tags?: string[];
  vanitySlug?: string;
  nameConvention?: string;
  slugConvention?: string;
  nameOverride?: boolean;
  id?: string;
  slug?: string;
  storedName?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  url?: string;
  maxViews?: number | "" | null;
  maxViewsAction?: MaxViewsAction;
};

export type UploadApiResponse = {
  id?: string;
  slug?: string;
  originalName?: string;
  storedName?: string;
  mimeType?: string;
  size?: number;
  description?: string | null;
  isPublic?: boolean;
  maxViews?: number | null;
  maxViewsAction?: "make_private" | "delete" | null;
  folder?: string | null;
  tags?: string[];
  url?: string;
  message?: string;
  error?: string;
};

export type ChunkInitResponse = {
  uploadId: string;
  chunkSize: number;
  totalParts: number;
  ttlSeconds?: number;
  expiresAt?: string | null;
  retry?: {
    baseMs?: number;
    maxMs?: number;
    jitter?: boolean;
    maxRetries?: number;
  };
  slug?: string;
  storedName?: string;
};
