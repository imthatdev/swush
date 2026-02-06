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

import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/server/api-error";
import { getCurrentUser } from "@/lib/client/user";
import {
  getUserPreferences,
  updateUserPreferences,
} from "@/lib/server/user-preferences";
import { db } from "@/db/client";
import { userInfo } from "@/db/schemas/core-schema";
import { eq } from "drizzle-orm";

const FEATURE_KEYS = ["files", "shortlinks", "watchlist"] as const;

type FeatureKey = (typeof FEATURE_KEYS)[number];

const PREFERENCE_KEYS = ["files", "shortlinks", "watchlist"] as const;

type PreferenceKey = (typeof PREFERENCE_KEYS)[number];

const preferenceMap: Record<
  PreferenceKey,
  keyof Awaited<ReturnType<typeof getUserPreferences>>
> = {
  files: "featureFilesEnabled",
  shortlinks: "featureShortlinksEnabled",
  watchlist: "featureWatchlistEnabled",
};

type AllowInfo = {
  allowFiles: boolean | null;
  allowShortlinks: boolean | null;
  allowWatchlist: boolean | null;
};

const allowMap: Record<FeatureKey, keyof AllowInfo> = {
  files: "allowFiles",
  shortlinks: "allowShortlinks",
  watchlist: "allowWatchlist",
};

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await getUserPreferences(user.id);
  const [info] = (await db
    .select({
      allowFiles: userInfo.allowFiles,
      allowShortlinks: userInfo.allowShortlinks,
    })
    .from(userInfo)
    .where(eq(userInfo.userId, user.id))
    .limit(1)) as AllowInfo[];

  const features = FEATURE_KEYS.reduce<
    Record<string, { isEnabled: boolean; canEnable: boolean }>
  >((acc, key) => {
    const canEnable = info?.[allowMap[key]] !== false;
    const enabled =
      (prefs[preferenceMap[key as PreferenceKey]] ?? true) !== false;
    acc[key] = {
      canEnable,
      isEnabled: canEnable ? enabled : false,
    };
    return acc;
  }, {});

  return NextResponse.json({ features });
});

export const PATCH = withApiError(async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const [info] = (await db
    .select({
      allowFiles: userInfo.allowFiles,
      allowShortlinks: userInfo.allowShortlinks,
    })
    .from(userInfo)
    .where(eq(userInfo.userId, user.id))
    .limit(1)) as AllowInfo[];

  const next: Record<string, unknown> = {};
  for (const key of PREFERENCE_KEYS) {
    if (typeof body[key] !== "boolean") continue;
    const canEnable = info?.[allowMap[key]] !== false;
    if (!canEnable && body[key] === true) {
      return NextResponse.json(
        {
          error: `${key} is disabled for your account, or any available for Swush Pro Version`,
        },
        { status: 403 },
      );
    }
    next[preferenceMap[key]] = body[key];
  }

  const settings = await updateUserPreferences(user.id, next);
  return NextResponse.json({ settings });
});
