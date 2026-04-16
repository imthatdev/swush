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

import "server-only";
import { serverSettings } from "@/db/schemas/core-schema";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { DBServerSettings } from "@/types/schema";
import { getCached, setCached, clearCached } from "@/lib/server/ttl-cache";
import { redisDelete, redisGetJson, redisSetJson } from "@/lib/server/redis";
import { normalizeHttpUrl, normalizeSharingDomain } from "@/lib/api/helpers";

export type ServerSettings = DBServerSettings;

const SETTINGS_ID = 1 as const;
const SERVER_SETTINGS_CACHE_KEY = "settings:server";
const SERVER_SETTINGS_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.SERVER_SETTINGS_CACHE_TTL_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 30_000;
  return Math.floor(parsed);
})();

async function readServerSettingsFromDb(): Promise<ServerSettings> {
  await ensureSettingsRow();

  const latest = await db.query.serverSettings.findFirst({
    where: eq(serverSettings.id, SETTINGS_ID),
  });

  return { ...latest } as ServerSettings;
}

async function setServerSettingsCache(value: ServerSettings) {
  setCached(SERVER_SETTINGS_CACHE_KEY, value, SERVER_SETTINGS_CACHE_TTL_MS);
  await redisSetJson(
    SERVER_SETTINGS_CACHE_KEY,
    value,
    SERVER_SETTINGS_CACHE_TTL_MS,
  );
}

async function clearServerSettingsCache() {
  clearCached(SERVER_SETTINGS_CACHE_KEY);
  await redisDelete(SERVER_SETTINGS_CACHE_KEY);
}

async function ensureSettingsRow() {
  await db
    .insert(serverSettings)
    .values({ id: SETTINGS_ID })
    .onConflictDoNothing();
}

function buildPayload(input: Partial<ServerSettings>) {
  const hasSharingDomain = Object.prototype.hasOwnProperty.call(
    input,
    "sharingDomain",
  );
  const hasSharingDomainFallbackUrl = Object.prototype.hasOwnProperty.call(
    input,
    "sharingDomainFallbackUrl",
  );

  const payload: Partial<typeof serverSettings.$inferInsert> = {
    sharingDomain: hasSharingDomain
      ? normalizeSharingDomain(input.sharingDomain) || null
      : undefined,
    sharingDomainFallbackUrl: hasSharingDomainFallbackUrl
      ? normalizeHttpUrl(input.sharingDomainFallbackUrl) || null
      : undefined,
    maxUploadMb: input.maxUploadMb,
    maxFilesPerUpload: input.maxFilesPerUpload,
    allowPublicRegistration: input.allowPublicRegistration,
    passwordPolicyMinLength: input.passwordPolicyMinLength,

    userMaxStorageMb: input.userMaxStorageMb,
    adminMaxStorageMb: input.adminMaxStorageMb,
    userDailyQuotaMb: input.userDailyQuotaMb,
    adminDailyQuotaMb: input.adminDailyQuotaMb,
    filesLimitUser: input.filesLimitUser,
    filesLimitAdmin: input.filesLimitAdmin,
    shortLinksLimitUser: input.shortLinksLimitUser,
    shortLinksLimitAdmin: input.shortLinksLimitAdmin,
    bookmarksLimitUser: input.bookmarksLimitUser,
    bookmarksLimitAdmin: input.bookmarksLimitAdmin,

    allowedMimePrefixes: input.allowedMimePrefixes ?? null,
    disallowedExtensions: input.disallowedExtensions ?? null,
    preservedUsernames: input.preservedUsernames ?? null,
    setupCompleted: input.setupCompleted,
    allowRemoteUpload: input.allowRemoteUpload,
    disableApiTokens: input.disableApiTokens,

    updatedAt: new Date(),
  };
  return payload;
}

export function isUsernamePreserved(
  name: string,
  settings: ServerSettings,
): boolean {
  const n = (name || "").trim().toLowerCase();
  const list = (settings.preservedUsernames ?? [])
    .map((s: string) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!n) return false;

  return list.some((pattern: string) => {
    if (!pattern) return false;
    if (pattern.endsWith("^")) {
      const token = pattern.slice(0, -1).trim();
      return token ? n.includes(token) : false;
    }
    if (pattern.startsWith("*") && pattern.endsWith("*")) {
      const token = pattern.slice(1, -1).trim();
      return token ? n.includes(token) : false;
    }
    if (pattern.startsWith("*")) {
      const token = pattern.slice(1).trim();
      return token ? n.endsWith(token) : false;
    }
    if (pattern.endsWith("*")) {
      const token = pattern.slice(0, -1).trim();
      return token ? n.startsWith(token) : false;
    }
    return n === pattern;
  });
}

export async function getServerSettings(): Promise<ServerSettings> {
  const memoryCached = getCached<ServerSettings>(SERVER_SETTINGS_CACHE_KEY);
  if (memoryCached) return memoryCached;

  const redisCached = await redisGetJson<ServerSettings>(
    SERVER_SETTINGS_CACHE_KEY,
  );
  if (redisCached) {
    setCached(
      SERVER_SETTINGS_CACHE_KEY,
      redisCached,
      SERVER_SETTINGS_CACHE_TTL_MS,
    );
    return redisCached;
  }

  const latest = await readServerSettingsFromDb();
  await setServerSettingsCache(latest);

  return latest;
}

export async function updateServerSettings(input: Partial<ServerSettings>) {
  const payload = buildPayload(input);

  const existing = await db.query.serverSettings.findFirst({
    where: eq(serverSettings.id, SETTINGS_ID),
  });

  if (!existing) {
    await db.insert(serverSettings).values({ id: SETTINGS_ID, ...payload });
  } else {
    await db
      .update(serverSettings)
      .set(payload)
      .where(eq(serverSettings.id, SETTINGS_ID));
  }

  await clearServerSettingsCache();
  const latest = await readServerSettingsFromDb();
  await setServerSettingsCache(latest);
  return latest;
}
