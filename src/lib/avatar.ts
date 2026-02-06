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

export const DEFAULT_AVATAR_PATH = "/images/default-avatar.png";

export const AVATAR_STORAGE_NAMESPACE = "avatars";

export function avatarApiPath(userId: string) {
  return `/api/v1/avatar/${encodeURIComponent(userId)}`;
}

export function legacyAvatarStoredName(userId: string) {
  return `${userId}.png`;
}

export function avatarFileApiPath(userId: string, file: string) {
  return `/api/v1/avatar/${encodeURIComponent(userId)}/${encodeURIComponent(
    file,
  )}`;
}

export function avatarStoredName(userId: string, file: string) {
  return `${userId}/${file}`;
}

export function isSafeAvatarFileName(file: string) {
  if (!file) return false;
  if (file.length > 200) return false;
  if (file.includes("/") || file.includes("\\") || file.includes(".."))
    return false;
  return /^[A-Za-z0-9._-]+\.png$/i.test(file);
}
