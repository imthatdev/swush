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
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { audit } from "@/lib/api/audit";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";
import {
  createBookmarkRssFeed,
  kickBookmarkRssRunner,
  listBookmarkRssFeeds,
} from "@/lib/server/bookmark-rss";

export const GET = withApiError(async function GET(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user)
    user = await getCurrentUserFromToken(req, undefined, ["bookmarks"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const data = await listBookmarkRssFeeds(user.id);

  await audit({
    action: "bookmark_feed.list",
    targetType: "bookmark_feed",
    targetId: user.id,
    statusCode: 200,
    meta: { count: data.length },
  });

  return NextResponse.json({ data });
});

export const POST = withApiError(async function POST(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user)
    user = await getCurrentUserFromToken(req, undefined, ["bookmarks"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  if (!body || typeof body.feedUrl !== "string" || !body.feedUrl.trim()) {
    return NextResponse.json({ error: "feedUrl is required" }, { status: 400 });
  }

  try {
    const data = await createBookmarkRssFeed({
      userId: user.id,
      feedUrl: body.feedUrl,
      feedTitle: typeof body.feedTitle === "string" ? body.feedTitle : null,
      intervalMinutes:
        typeof body.intervalMinutes === "number" ? body.intervalMinutes : null,
      maxItemsPerFetch:
        typeof body.maxItemsPerFetch === "number"
          ? body.maxItemsPerFetch
          : null,
      defaultTags: Array.isArray(body.defaultTags) ? body.defaultTags : null,
      snapshotMode:
        typeof body.snapshotMode === "string" ? body.snapshotMode : null,
      isEnabled: typeof body.isEnabled === "boolean" ? body.isEnabled : true,
    });

    if (data.isEnabled) {
      await kickBookmarkRssRunner({ feedId: data.id });
    }

    await audit({
      action: "bookmark_feed.create",
      targetType: "bookmark_feed",
      targetId: data.id,
      statusCode: 201,
      meta: {
        feedUrl: data.feedUrl,
        intervalMinutes: data.intervalMinutes,
      },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const message = (error as Error)?.message || "Failed to create feed";
    const status = message === "Feed already exists" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});
