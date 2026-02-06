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

"use server";

import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "../auth";
import { db } from "@/db/client";
import { user, userInfo, session as sessionTable } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { ensureFirstNonAnonymousUserIsOwner } from "@/lib/auth/first-owner";
import { toast } from "sonner";
import {
  hasRequiredApiKeyScopes,
  normalizeApiKeyScopes,
} from "@/lib/api-key-scopes";

type UserInfoFields = {
  role: "owner" | "admin" | "user";
  bio?: string | null;
  maxStorageMb?: number | null;
  maxUploadMb?: number | null;
  filesLimit?: number | null;
  notesLimit?: number | null;
  shortLinksLimit?: number | null;
  snippetsLimit?: number | null;
  bookmarksLimit?: number | null;
  recipesLimit?: number | null;
  allowRemoteUpload?: boolean | null;
  allowMeetings?: boolean | null;
  disableApiTokens?: boolean | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
};

export const getCurrentSession = async () => {
  return await auth.api.getSession({ headers: await headers() });
};

async function getUserWithInfoById(
  userId: string,
): Promise<(typeof user.$inferSelect & UserInfoFields) | null> {
  const [baseUser] = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!baseUser) return null;

  const becameOwner = await ensureFirstNonAnonymousUserIsOwner({
    userId: baseUser.id,
    isAnonymous: baseUser.isAnonymous,
  });

  const [info] = await db
    .select({
      userId: userInfo.userId,
      role: userInfo.role,
      bio: userInfo.bio,
      maxStorageMb: userInfo.maxStorageMb,
      maxUploadMb: userInfo.maxUploadMb,
      filesLimit: userInfo.filesLimit,
      shortLinksLimit: userInfo.shortLinksLimit,
      allowRemoteUpload: userInfo.allowRemoteUpload,
      disableApiTokens: userInfo.disableApiTokens,
      banned: userInfo.banned,
      banReason: userInfo.banReason,
      banExpires: userInfo.banExpires,
    })
    .from(userInfo)
    .where(eq(userInfo.userId, baseUser.id))
    .limit(1);

  if (!info) {
    await db
      .insert(userInfo)
      .values({ userId: baseUser.id, role: becameOwner ? "owner" : "user" })
      .onConflictDoNothing();
    return { ...baseUser, role: becameOwner ? "owner" : "user" };
  }

  const { userId: _userId, ...rest } = info;
  void _userId;

  if (rest.banned) {
    try {
      await db.delete(sessionTable).where(eq(sessionTable.userId, baseUser.id));
    } catch {
      toast.error("Failed to revoke user sessions.");
    }
    return null;
  }

  return {
    ...baseUser,
    ...rest,
    role: (becameOwner
      ? "owner"
      : (rest.role ?? "user")) as UserInfoFields["role"],
    banned: !!rest.banned,
  };
}

export const getCurrentUser = async (): Promise<
  (typeof user.$inferSelect & UserInfoFields) | null
> => {
  const session = await getCurrentSession();

  if (!session) return null;
  return getUserWithInfoById(session.user.id);
};

type ApiKeyPermissions = Record<string, string[]>;

function extractApiKey(req: NextRequest): string | null {
  const headerKey = req.headers.get("x-api-key")?.trim();
  if (headerKey) return headerKey;

  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearer?.[1]) return bearer[1].trim();

  const apiKeyHeader = authHeader.match(/^ApiKey\s+(.+)$/i);
  if (apiKeyHeader?.[1]) return apiKeyHeader[1].trim();

  return null;
}

function isApiKeyRequestAllowed(req: NextRequest) {
  const method = req.method.toUpperCase();
  const pathname = req.nextUrl?.pathname || "";
  const allowlist = [
    { prefix: "/api/v1/upload", methods: ["POST", "PUT"] },
    { prefix: "/api/v1/shorten", methods: ["POST"] },
    { prefix: "/api/v1/shorten/p", methods: ["POST"] },
    { prefix: "/api/v1/notes", methods: ["POST"] },
    { prefix: "/api/v1/bookmarks", methods: ["POST"] },
    { prefix: "/api/graphql", methods: ["POST"] },
    { prefix: "/api/v1/avatar/upload", methods: ["POST"] },
  ];
  return allowlist.some(
    (route) =>
      pathname.startsWith(route.prefix) && route.methods.includes(method),
  );
}

export const getCurrentUserFromToken = async (
  req: NextRequest,
  permissions?: ApiKeyPermissions,
  requiredScopes?: string[],
) => {
  const { getServerSettings } = await import("@/lib/settings");
  const settings = await getServerSettings();
  if (settings.disableApiTokens) return null;
  const key = extractApiKey(req);
  if (!key) return null;
  if (!isApiKeyRequestAllowed(req)) return null;

  const result = await auth.api.verifyApiKey({
    body: {
      key,
      permissions,
    },
  });

  if (!result?.valid || !result?.key?.userId) return null;

  if (requiredScopes?.length) {
    const assignedScopes = normalizeApiKeyScopes(
      (result.key as { permissions?: string | null }).permissions,
    );
    if (!hasRequiredApiKeyScopes(assignedScopes, requiredScopes)) return null;
  }

  const resolved = await getUserWithInfoById(result.key.userId);
  if (resolved?.disableApiTokens) return null;
  return resolved;
};
