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

"use server";

import { headers } from "next/headers";
import { and, eq, notInArray } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "@/db/client";
import { APIKey } from "@/types/schema";
import { apiKeySecrets, apikey } from "@/db/schemas";
import { encryptApiKey } from "@/lib/security/api-key-secrets";
import { getCurrentUser } from "./user";
import { getServerSettings } from "@/lib/settings";
import {
  DEFAULT_API_KEY_SCOPES,
  type ApiKeyScope,
  sanitizeApiKeyScopes,
  serializeApiKeyScopes,
} from "@/lib/api-key-scopes";

export const listedApiKeys = async () => {
  const data = await auth.api.listApiKeys({
    headers: await headers(),
  });
  return data as APIKey[];
};

export const createApiKey = async ({
  name,
  expiresIn,
  scopes,
}: {
  name: string;
  expiresIn?: number | null;
  scopes?: ApiKeyScope[];
}) => {
  const settings = await getServerSettings();
  if (settings.disableApiTokens) {
    throw new Error("API tokens are disabled by the administrator.");
  }
  const user = await getCurrentUser();
  if (user?.disableApiTokens) {
    throw new Error("API tokens are disabled for this account.");
  }
  const existing = await listedApiKeys();
  const MAX_KEYS = 9;
  if (existing.length >= MAX_KEYS) {
    throw new Error(
      `API key limit reached (${MAX_KEYS}). Revoke existing keys to create new ones.`,
    );
  }
  const resolvedScopes = sanitizeApiKeyScopes(
    scopes?.length ? scopes : Array.from(DEFAULT_API_KEY_SCOPES),
  );
  const body: Record<string, unknown> = {
    name,
    userId: user?.id,
    prefix: "swush_",
    rateLimitEnabled: false,
    permissions: Object.fromEntries(
      resolvedScopes.map((scope) => [scope, ["*"]]),
    ),
  };
  if (typeof expiresIn === "number") body.expiresIn = expiresIn;

  const data = await auth.api.createApiKey({
    body,
  });

  if (data?.id && data?.key && user?.id) {
    const encrypted = encryptApiKey(data.key);
    await db
      .insert(apiKeySecrets)
      .values({
        keyId: data.id,
        userId: user.id,
        encryptedKey: encrypted.encrypted,
        iv: encrypted.iv,
        tag: encrypted.tag,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: apiKeySecrets.keyId,
        set: {
          encryptedKey: encrypted.encrypted,
          iv: encrypted.iv,
          tag: encrypted.tag,
          updatedAt: new Date(),
        },
      });
  }

  return data;
};

export const createApiKeyForUser = async ({
  userId,
  name,
  expiresIn,
  scopes,
}: {
  userId: string;
  name: string;
  expiresIn?: number | null;
  scopes?: ApiKeyScope[];
}) => {
  const settings = await getServerSettings();
  if (settings.disableApiTokens) {
    throw new Error("API tokens are disabled by the administrator.");
  }
  const { userInfo } = await import("@/db/schemas");
  const [info] = await db
    .select({ disableApiTokens: userInfo.disableApiTokens })
    .from(userInfo)
    .where(eq(userInfo.userId, userId))
    .limit(1);
  if (info?.disableApiTokens) {
    throw new Error("API tokens are disabled for this account.");
  }
  const MAX_KEYS = 5;
  const existing = await db
    .select({ id: apikey.id })
    .from(apikey)
    .where(eq(apikey.userId, userId));
  if (existing.length >= MAX_KEYS) {
    throw new Error(
      `API key limit reached (${MAX_KEYS}). Revoke existing keys to create new ones.`,
    );
  }

  const resolvedScopes = sanitizeApiKeyScopes(
    scopes?.length ? scopes : Array.from(DEFAULT_API_KEY_SCOPES),
  );
  const body: Record<string, unknown> = {
    name,
    userId,
    prefix: "swush_",
    rateLimitEnabled: false,
    permissions: Object.fromEntries(
      resolvedScopes.map((scope) => [scope, ["*"]]),
    ),
  };
  if (typeof expiresIn === "number") body.expiresIn = expiresIn;

  const data = await auth.api.createApiKey({
    body,
  });

  if (data?.id && data?.key) {
    const encrypted = encryptApiKey(data.key);
    await db
      .insert(apiKeySecrets)
      .values({
        keyId: data.id,
        userId,
        encryptedKey: encrypted.encrypted,
        iv: encrypted.iv,
        tag: encrypted.tag,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: apiKeySecrets.keyId,
        set: {
          encryptedKey: encrypted.encrypted,
          iv: encrypted.iv,
          tag: encrypted.tag,
          updatedAt: new Date(),
        },
      });
  }

  return data;
};

export const revokeApiKey = async (apiKeyId: string) => {
  const user = await getCurrentUser();
  const data = await auth.api.updateApiKey({
    body: {
      keyId: apiKeyId,
      userId: user?.id,
      enabled: false,
    },
  });
  return data;
};

export const deleteApiKey = async (apiKeyId: string) => {
  const data = await auth.api.deleteApiKey({
    body: {
      keyId: apiKeyId,
    },
    headers: await headers(),
  });
  await db.delete(apiKeySecrets).where(eq(apiKeySecrets.keyId, apiKeyId));
  return data;
};

export const clearExpiredApiKeys = async () => {
  const data = await auth.api.deleteAllExpiredApiKeys();
  const user = await getCurrentUser();
  if (user?.id) {
    const existing = await db
      .select({ id: apikey.id })
      .from(apikey)
      .where(eq(apikey.userId, user.id));
    const ids = existing.map((row) => row.id);
    if (ids.length === 0) {
      await db.delete(apiKeySecrets).where(eq(apiKeySecrets.userId, user.id));
    } else {
      await db
        .delete(apiKeySecrets)
        .where(
          and(
            eq(apiKeySecrets.userId, user.id),
            notInArray(apiKeySecrets.keyId, ids),
          ),
        );
    }
  }
  return data;
};
