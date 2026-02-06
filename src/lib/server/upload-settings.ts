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
import { userUploadSettings } from "@/db/schemas";
import { eq } from "drizzle-orm";
import {
  NAME_CONVENTIONS,
  SLUG_CONVENTIONS,
  type NameConvention,
  type SlugConvention,
} from "@/lib/upload-conventions";

export type UploadSettings = {
  nameConvention: NameConvention;
  slugConvention: SlugConvention;
  imageCompressionEnabled: boolean;
  imageCompressionQuality: number;
  mediaTranscodeEnabled: boolean;
  mediaTranscodeQuality: number;
};

const DEFAULT_SETTINGS: UploadSettings = {
  nameConvention: "original",
  slugConvention: "funny",
  imageCompressionEnabled: true,
  imageCompressionQuality: 85,
  mediaTranscodeEnabled: false,
  mediaTranscodeQuality: 70,
};

export function normalizeNameConvention(
  value?: string | null
): NameConvention | null {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  const hit = NAME_CONVENTIONS.find((c) => c === token);
  return hit ?? null;
}

export function normalizeSlugConvention(
  value?: string | null
): SlugConvention | null {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  const hit = SLUG_CONVENTIONS.find((c) => c === token);
  return hit ?? null;
}

function normalizeBoolean(value?: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }
  return null;
}

function normalizePercent(value?: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(100, Math.max(1, Math.round(value)));
  }
  if (typeof value === "string" && value.trim()) {
    const num = Number(value);
    if (Number.isFinite(num)) {
      return Math.min(100, Math.max(1, Math.round(num)));
    }
  }
  return null;
}

export function normalizeUploadSettings(input: {
  nameConvention?: string | null;
  slugConvention?: string | null;
  imageCompressionEnabled?: boolean | string | null;
  imageCompressionQuality?: number | string | null;
  mediaTranscodeEnabled?: boolean | string | null;
  mediaTranscodeQuality?: number | string | null;
}) {
  const nameConvention = normalizeNameConvention(input.nameConvention);
  const slugConvention = normalizeSlugConvention(input.slugConvention);
  const imageCompressionEnabled = normalizeBoolean(
    input.imageCompressionEnabled
  );
  const imageCompressionQuality = normalizePercent(
    input.imageCompressionQuality
  );
  const mediaTranscodeEnabled = normalizeBoolean(input.mediaTranscodeEnabled);
  const mediaTranscodeQuality = normalizePercent(input.mediaTranscodeQuality);
  return {
    nameConvention,
    slugConvention,
    imageCompressionEnabled,
    imageCompressionQuality,
    mediaTranscodeEnabled,
    mediaTranscodeQuality,
  };
}

export async function getUserUploadSettings(userId: string): Promise<UploadSettings> {
  const row = await db.query.userUploadSettings.findFirst({
    where: eq(userUploadSettings.userId, userId),
  });

  return {
    nameConvention:
      normalizeNameConvention(row?.nameConvention) ??
      DEFAULT_SETTINGS.nameConvention,
    slugConvention:
      normalizeSlugConvention(row?.slugConvention) ??
      DEFAULT_SETTINGS.slugConvention,
    imageCompressionEnabled:
      typeof row?.imageCompressionEnabled === "boolean"
        ? row.imageCompressionEnabled
        : DEFAULT_SETTINGS.imageCompressionEnabled,
    imageCompressionQuality:
      typeof row?.imageCompressionQuality === "number"
        ? row.imageCompressionQuality
        : DEFAULT_SETTINGS.imageCompressionQuality,
    mediaTranscodeEnabled:
      typeof row?.mediaTranscodeEnabled === "boolean"
        ? row.mediaTranscodeEnabled
        : DEFAULT_SETTINGS.mediaTranscodeEnabled,
    mediaTranscodeQuality:
      typeof row?.mediaTranscodeQuality === "number"
        ? row.mediaTranscodeQuality
        : DEFAULT_SETTINGS.mediaTranscodeQuality,
  };
}

export function resolveUploadSettings(
  preferred: Partial<UploadSettings> | null | undefined
) {
  return {
    nameConvention:
      preferred?.nameConvention ?? DEFAULT_SETTINGS.nameConvention,
    slugConvention:
      preferred?.slugConvention ?? DEFAULT_SETTINGS.slugConvention,
    imageCompressionEnabled:
      preferred?.imageCompressionEnabled ??
      DEFAULT_SETTINGS.imageCompressionEnabled,
    imageCompressionQuality:
      preferred?.imageCompressionQuality ??
      DEFAULT_SETTINGS.imageCompressionQuality,
    mediaTranscodeEnabled:
      preferred?.mediaTranscodeEnabled ?? DEFAULT_SETTINGS.mediaTranscodeEnabled,
    mediaTranscodeQuality:
      preferred?.mediaTranscodeQuality ?? DEFAULT_SETTINGS.mediaTranscodeQuality,
  };
}
