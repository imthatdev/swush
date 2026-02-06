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

import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { userInfo, userPreferences } from "@/db/schemas/core-schema";
import { eq } from "drizzle-orm";

export type UserFeatureKey = "files" | "shortlinks" | "watchlist";

const preferenceKeyMap: Record<
  UserFeatureKey,
  keyof typeof userPreferences.$inferSelect
> = {
  files: "featureFilesEnabled",
  shortlinks: "featureShortlinksEnabled",
  watchlist: "featureWatchlistEnabled",
};

const allowKeyMap: Record<UserFeatureKey, keyof typeof userInfo.$inferSelect> =
  {
    files: "allowFiles",
    shortlinks: "allowShortlinks",
    watchlist: "allowWatchlist",
  };

export type UserFeatureState = {
  isEnabled: boolean;
  canEnable: boolean;
};

export async function getUserFeatureState(
  userId: string,
  key: UserFeatureKey,
): Promise<UserFeatureState> {
  const [info] = await db
    .select({
      allow: userInfo[allowKeyMap[key]],
    })
    .from(userInfo)
    .where(eq(userInfo.userId, userId))
    .limit(1);

  const [prefs] = await db
    .select({
      enabled: userPreferences[preferenceKeyMap[key]],
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  const canEnable = info?.allow !== false;
  const prefEnabled = prefs?.enabled !== false;
  return {
    canEnable,
    isEnabled: canEnable && prefEnabled,
  };
}

export async function requireUserFeature(userId: string, key: UserFeatureKey) {
  const { isEnabled } = await getUserFeatureState(userId, key);
  if (!isEnabled) {
    return NextResponse.json(
      { message: "Feature not enabled for this account." },
      { status: 403 },
    );
  }
  return null;
}
