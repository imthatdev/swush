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

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  role: string;
  image: string | null;
  isBanned: boolean;
  banReason?: string | null;
  banExpires?: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  maxStorageMb: number | null;
  maxUploadMb: number | null;
  filesLimit: number | null;
  shortLinksLimit: number | null;
  allowRemoteUpload: boolean | null;
  allowFiles: boolean | null;
  allowShortlinks: boolean | null;
  allowWatchlist: boolean | null;
  disableApiTokens: boolean;
  twoFactor: boolean;
  verified: boolean;
  usage: {
    files: number;
    storageBytes: number;
    links: number;
    clicks: number;
  };
}
