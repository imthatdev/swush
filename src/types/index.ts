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

import type { AudioTrackMeta } from "@/types/player";

export interface Upload {
  id: string;
  userId: string;
  originalName: string;
  customName: string;
  description: string | null;
  isFavorite: boolean;
  mimeType: string;
  size: number;
  slug: string;
  isPublic: boolean;
  anonymousShareEnabled?: boolean | null;
  hasPassword?: boolean;
  views?: number;
  maxViews?: number | null;
  maxViewsAction?: "make_private" | "delete" | null;
  contentHash?: string | null;
  createdAt: Date;
  audioMeta?: AudioTrackMeta | null;
}

export interface UploadWrapper {
  file: File;
  customName: string;
  description: string;
  isPublic: boolean;
}

export type FolderMeta = { id: string; name: string; color?: string | null };
export type TagMeta = { id: string; name: string; color?: string | null };
