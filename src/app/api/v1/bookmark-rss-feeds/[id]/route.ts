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
  deleteBookmarkRssFeed,
  kickBookmarkRssRunner,
  updateBookmarkRssFeed,
} from "@/lib/server/bookmark-rss";

type Params = Promise<{ id: string }>;

async function getAuthorizedUser(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user)
    user = await getCurrentUserFromToken(req, undefined, ["bookmarks"]);
  return user;
}

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const user = await getAuthorizedUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  try {
    const data = await updateBookmarkRssFeed(user.id, id, {
      feedUrl: typeof body?.feedUrl === "string" ? body.feedUrl : undefined,
      feedTitle:
        typeof body?.feedTitle === "string" || body?.feedTitle === null
          ? body.feedTitle
          : undefined,
      intervalMinutes:
        typeof body?.intervalMinutes === "number"
          ? body.intervalMinutes
          : undefined,
      maxItemsPerFetch:
        typeof body?.maxItemsPerFetch === "number"
          ? body.maxItemsPerFetch
          : undefined,
      defaultTags:
        Array.isArray(body?.defaultTags) || body?.defaultTags === null
          ? body.defaultTags
          : undefined,
      snapshotMode:
        typeof body?.snapshotMode === "string" ? body.snapshotMode : undefined,
      isEnabled:
        typeof body?.isEnabled === "boolean" ? body.isEnabled : undefined,
      runNow: body?.runNow === true,
    });

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body?.runNow === true && data.isEnabled) {
      await kickBookmarkRssRunner({ feedId: data.id });
    }

    await audit({
      action: "bookmark_feed.update",
      targetType: "bookmark_feed",
      targetId: data.id,
      statusCode: 200,
      meta: {
        intervalMinutes: data.intervalMinutes,
        isEnabled: data.isEnabled,
        runNow: body?.runNow === true,
      },
    });

    return NextResponse.json({ data });
  } catch (error) {
    const message = (error as Error)?.message || "Failed to update feed";
    const status = message === "Feed already exists" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
});

export const POST = withApiError(async function POST(
  req: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const user = await getAuthorizedUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const data = await updateBookmarkRssFeed(user.id, id, { runNow: true });
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (data.isEnabled) {
    await kickBookmarkRssRunner({ feedId: data.id });
  }

  await audit({
    action: "bookmark_feed.run",
    targetType: "bookmark_feed",
    targetId: data.id,
    statusCode: 200,
  });

  return NextResponse.json({ data, queued: data.isEnabled });
});

export const DELETE = withApiError(async function DELETE(
  req: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const user = await getAuthorizedUser(req);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const ok = await deleteBookmarkRssFeed(user.id, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await audit({
    action: "bookmark_feed.delete",
    targetType: "bookmark_feed",
    targetId: id,
    statusCode: 200,
  });

  return NextResponse.json({ ok: true });
});
