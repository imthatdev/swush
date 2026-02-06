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

export type ServerSettings = DBServerSettings;

const SETTINGS_ID = 1 as const;

async function ensureSettingsRow() {
  await db
    .insert(serverSettings)
    .values({ id: SETTINGS_ID })
    .onConflictDoNothing();
}

function buildPayload(input: Partial<ServerSettings>) {
  const payload: Partial<typeof serverSettings.$inferInsert> = {
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

    allowedMimePrefixes: input.allowedMimePrefixes ?? null,
    disallowedExtensions: input.disallowedExtensions ?? null,
    preservedUsernames: input.preservedUsernames ?? null,
    setupCompleted: input.setupCompleted,
    allowRemoteUpload: input.allowRemoteUpload,
    sponsorBannerEnabled: input.sponsorBannerEnabled,
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
  await ensureSettingsRow();

  const latest = await db.query.serverSettings.findFirst({
    where: eq(serverSettings.id, SETTINGS_ID),
  });

  return { ...latest } as ServerSettings;
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

  return getServerSettings();
}
