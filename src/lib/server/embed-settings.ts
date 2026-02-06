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

import type { Metadata, Viewport } from "next";
import { db } from "@/db/client";
import { user, userEmbedSettings } from "@/db/schemas";
import { eq } from "drizzle-orm";

export type EmbedSettings = {
  title?: string | null;
  description?: string | null;
  color?: string | null;
  imageUrl?: string | null;
};

const colorPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const colorPatternNoHash = /^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function clean(value?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeEmbedSettings(input?: EmbedSettings | null) {
  if (!input) return null;
  const colorRaw = clean(input.color);
  const color = colorRaw
    ? colorPattern.test(colorRaw)
      ? colorRaw
      : colorPatternNoHash.test(colorRaw)
        ? `#${colorRaw}`
        : null
    : null;
  return {
    title: clean(input.title),
    description: clean(input.description),
    color,
    imageUrl: clean(input.imageUrl),
  };
}

export async function getEmbedSettingsByUserId(
  userId?: string | null,
  withoutHead: boolean = false,
  withoutImage: boolean = false,
) {
  if (!userId) return null;
  const row = await db.query.userEmbedSettings.findFirst({
    where: eq(userEmbedSettings.userId, userId),
  });
  if (!row) return null;

  return normalizeEmbedSettings({
    title: withoutHead ? null : row.title,
    description: withoutHead ? null : row.description,
    color: row.color,
    imageUrl: withoutImage ? null : row.imageUrl,
  });
}

export async function getUsernameByUserId(userId?: string | null) {
  if (!userId) return null;
  const row = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { username: true },
  });
  return row?.username ?? null;
}

export type EmbedTemplateVars = Record<
  string,
  string | number | null | undefined
>;

export function applyEmbedTemplates(
  settings: EmbedSettings | null | undefined,
  vars: EmbedTemplateVars,
) {
  if (!settings) return settings ?? null;
  const replace = (value?: string | null) => {
    if (!value) return value ?? null;
    return value.replace(/\{([^}]+)\}/g, (match, rawKey) => {
      const key = String(rawKey).trim();
      if (!Object.prototype.hasOwnProperty.call(vars, key)) return match;
      const val = vars[key];
      return val === null || val === undefined ? "" : String(val);
    });
  };
  return {
    ...settings,
    title: replace(settings.title),
    description: replace(settings.description),
  };
}

export function resolveEmbedThemeColor(settings?: EmbedSettings | null) {
  const normalized = normalizeEmbedSettings(settings);
  return normalized?.color ?? null;
}

export async function resolveEmbedViewport(
  userId?: string | null,
  fallbackColor?: string,
): Promise<Viewport> {
  const settings = await getEmbedSettingsByUserId(userId);
  const themeColor = resolveEmbedThemeColor(settings) ?? fallbackColor;
  return themeColor ? { themeColor } : {};
}

export function applyEmbedSettings(
  metadata: Metadata,
  settings?: EmbedSettings | null,
) {
  const normalized = normalizeEmbedSettings(settings);
  if (!normalized) return metadata;

  const title = normalized.title ?? undefined;
  const description = normalized.description ?? undefined;
  const imageUrl = normalized.imageUrl ?? undefined;

  const nextOpenGraph = {
    ...(metadata.openGraph ?? {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl
      ? {
          images: [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: title || "",
            },
          ],
        }
      : {}),
  };

  const nextTwitter = {
    ...(metadata.twitter ?? {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl ? { images: [imageUrl] } : {}),
  };

  return {
    ...metadata,
    title: title ?? metadata.title,
    description: description ?? metadata.description,
    openGraph: nextOpenGraph,
    twitter: nextTwitter,
  } satisfies Metadata;
}
