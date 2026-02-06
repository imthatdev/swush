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

import { db } from "@/db/client";
import { userInfo } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/client/user";
import { ensureFirstNonAnonymousUserIsOwner } from "@/lib/auth/first-owner";

export async function getUserInfo({ userId }: { userId?: string }) {
  if (!userId) return null;

  const info = await db
    .select()
    .from(userInfo)
    .where(eq(userInfo.userId, userId))
    .limit(1);

  return info[0];
}

export async function updateMyUserInfo(payload: { bio?: string | null }) {
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };

  await db
    .insert(userInfo)
    .values({ userId: me.id, role: me.role ?? "user" })
    .onConflictDoNothing();

  const update: Record<string, unknown> = {};
  if (payload.bio !== undefined) update.bio = payload.bio;

  if (Object.keys(update).length === 0) return { ok: true as const };

  await db.update(userInfo).set(update).where(eq(userInfo.userId, me.id));

  return { ok: true as const };
}

export async function claimFirstUserOwner() {
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };

  const applied = await ensureFirstNonAnonymousUserIsOwner({
    userId: me.id,
    isAnonymous: (me as { isAnonymous?: boolean | null }).isAnonymous,
  });

  return { ok: true as const, applied };
}
