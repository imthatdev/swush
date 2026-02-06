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

const DEFAULT_MAX_AGE_DAYS = 30;
const DEFAULT_MAX_FILE_MB = 25;

const truthy = new Set(["1", "true", "yes"]);

export function isAnonymousRequest(req: { url: string }) {
  const value = new URL(req.url).searchParams.get("anon") || "";
  return truthy.has(value.toLowerCase());
}

export function getAnonymousShareMaxAgeDays() {
  const raw =
    process.env.ANON_SHARE_MAX_AGE_DAYS ?? String(DEFAULT_MAX_AGE_DAYS);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export function enforceAnonymousShareAge(createdAt?: Date | string | null) {
  const maxAgeDays = getAnonymousShareMaxAgeDays();
  if (!maxAgeDays || !createdAt) return null;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  if (Date.now() - created.getTime() > maxAgeMs) {
    return "Anonymous share expired.";
  }
  return null;
}

export function enforceAnonymousFileLimits(file: {
  size?: number | null;
  mimeType?: string | null;
  createdAt?: Date | string | null;
}) {
  const ageError = enforceAnonymousShareAge(file.createdAt);
  if (ageError) return ageError;

  const maxMbRaw =
    process.env.ANON_SHARE_MAX_FILE_MB ?? String(DEFAULT_MAX_FILE_MB);
  const maxMb = Number(maxMbRaw);
  if (Number.isFinite(maxMb) && maxMb > 0 && typeof file.size === "number") {
    const maxBytes = maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return `Anonymous share exceeds ${maxMb}MB limit.`;
    }
  }

  const allowlist = (process.env.ANON_SHARE_MIME_ALLOWLIST ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (allowlist.length && file.mimeType) {
    const allowed = allowlist.includes(file.mimeType);
    if (!allowed) return "Anonymous share file type is not allowed.";
  }

  return null;
}

export function stripOwnerDetails<T extends Record<string, unknown>>(data: T) {
  const copy = { ...data };
  delete (copy as Record<string, unknown>).ownerUsername;
  delete (copy as Record<string, unknown>).ownerDisplayName;
  delete (copy as Record<string, unknown>).ownerName;
  delete (copy as Record<string, unknown>).ownerImage;
  delete (copy as Record<string, unknown>).ownerBio;
  delete (copy as Record<string, unknown>).ownerVerified;
  delete (copy as Record<string, unknown>).userId;
  return copy;
}
