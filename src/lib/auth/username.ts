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
import { user as userTable } from "@/db/schemas/auth-schema";
import { sql } from "drizzle-orm";
import { getServerSettings, isUsernamePreserved } from "@/lib/settings";

const MAX_USERNAME_LENGTH = 32;

function normalizeUsername(input: string) {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, MAX_USERNAME_LENGTH);

  return cleaned || "user";
}

async function usernameExists(username: string) {
  const [row] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(sql`lower(${userTable.username}) = ${username.toLowerCase()}`)
    .limit(1);
  return Boolean(row);
}

async function findAvailableUsername(base: string) {
  const settings = await getServerSettings();
  const safeBase = normalizeUsername(base);
  const baseCandidate = isUsernamePreserved(safeBase, settings)
    ? "user"
    : safeBase;

  for (let i = 0; i < 50; i += 1) {
    const suffix = i === 0 ? "" : String(i + 1);
    const candidate = `${baseCandidate}${suffix}`.slice(0, MAX_USERNAME_LENGTH);

    if (isUsernamePreserved(candidate, settings)) continue;
    if (await usernameExists(candidate)) continue;

    return candidate;
  }

  const fallback = `${baseCandidate}${Math.floor(Math.random() * 10000)}`.slice(
    0,
    MAX_USERNAME_LENGTH
  );
  return fallback;
}

type UserCreateInput = {
  email: string;
  name: string;
  username?: string | null;
} & Record<string, unknown>;

export async function ensureUsernameOnCreate(user: UserCreateInput) {
  if (user.username?.trim()) {
    return { data: user };
  }

  const base = user.name || user.email.split("@")[0] || "user";
  const username = await findAvailableUsername(base);

  return {
    data: {
      ...user,
      username,
    },
  };
}
