/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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
import { enforceCreateLimit, LimitPolicyError } from "@/lib/security/policy";
import { createBookmark, listBookmarks } from "@/lib/api/bookmarks";
import { audit } from "@/lib/api/audit";
import { getClientIp } from "@/lib/security/ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";
import {
  createBookmarkSnapshot,
  normalizeBookmarkSnapshotMode,
} from "@/lib/server/bookmark-snapshot";
import { db } from "@/db/client";
import { bookmarks } from "@/db/schemas/core-schema";
import { and, eq } from "drizzle-orm";

export const GET = withApiError(async function GET(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user)
    user = await getCurrentUserFromToken(req, undefined, ["bookmarks"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || undefined;
  const favoriteOnly = ["1", "true", "yes"].includes(
    (searchParams.get("favorite") || "").toLowerCase(),
  );
  const publicOnly = ["1", "true", "yes"].includes(
    (searchParams.get("public") || "").toLowerCase(),
  );
  const limit = Number(searchParams.get("limit") || "0");
  const offset = Number(searchParams.get("offset") || "0");
  const tagsParam = searchParams.get("tags") || "";
  const tags = tagsParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const result = await listBookmarks({
    userId: user.id,
    q,
    favoriteOnly,
    publicOnly,
    tags,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  });

  await audit({
    action: "bookmark.list",
    targetType: "bookmark",
    targetId: user.id,
    statusCode: 200,
    meta: {
      q,
      favoriteOnly,
      publicOnly,
      tags,
      count: result.items.length,
      total: result.total,
    },
  });

  return NextResponse.json({
    data: result.items,
    total: result.total,
    tags: result.tags,
    tagColors: result.tagColors,
  });
});

export const POST = withApiError(async function POST(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user)
    user = await getCurrentUserFromToken(req, undefined, ["bookmarks"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const ip = getClientIp(req);
  const ipLimit = 30,
    userLimit = 15,
    windowMs = 60_000;
  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `u:${user.id}`,
    limit: userLimit,
    windowMs,
  });
  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  try {
    await enforceCreateLimit({
      userId: user.id,
      role: user.role,
      kind: "bookmark",
    });

    const body = await req.json();
    const snapshotMode = normalizeBookmarkSnapshotMode(body.snapshotMode);

    let row = await createBookmark(
      {
        userId: user.id,
        url: body.url,
        title: body.title,
        description: body.description,
        imageUrl: body.imageUrl,
        slug: body.slug,
        isPublic: body.isPublic,
        isFavorite: body.isFavorite,
        password: body.password,
        tags: body.tags,
        maxViews: body.maxViews,
        maxViewsAction: body.maxViewsAction,
      },
      user.username!,
      user.role,
    );

    const snapshotResult =
      snapshotMode !== "none"
        ? await createBookmarkSnapshot({
            url: row.url,
            mode: snapshotMode,
          })
        : undefined;

    if (snapshotResult?.local?.ok && snapshotResult.local.payload) {
      const [updatedRow] = await db
        .update(bookmarks)
        .set(snapshotResult.local.payload)
        .where(and(eq(bookmarks.id, row.id), eq(bookmarks.userId, user.id)))
        .returning();
      if (updatedRow) row = updatedRow;
    }

    const snapshotSummary = snapshotResult
      ? {
          mode: snapshotMode,
          local: snapshotResult.local
            ? {
                ok: snapshotResult.local.ok,
                error: snapshotResult.local.error || null,
              }
            : null,
          internetArchive: snapshotResult.internetArchive
            ? {
                ok: snapshotResult.internetArchive.ok,
                error: snapshotResult.internetArchive.error || null,
                snapshotUrl: snapshotResult.internetArchive.snapshotUrl || null,
              }
            : null,
        }
      : null;

    await audit({
      action: "bookmark.create",
      targetType: "bookmark",
      targetId: row.id,
      statusCode: 201,
      meta: {
        title: row.title,
        tags: row.tags,
        snapshotMode,
        snapshotLocalOk: snapshotSummary?.local?.ok ?? null,
        snapshotInternetArchiveOk: snapshotSummary?.internetArchive?.ok ?? null,
      },
    });

    return NextResponse.json(
      { data: row, snapshot: snapshotSummary },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof LimitPolicyError) {
      await audit({
        action: "bookmark.create",
        targetType: "bookmark",
        targetId: user.id,
        statusCode: 429,
        meta: { error: e.message },
      });
      return NextResponse.json({ error: e.message }, { status: 429 });
    }
    await audit({
      action: "bookmark.create",
      targetType: "bookmark",
      targetId: user.id,
      statusCode: 500,
      meta: { error: (e as Error)?.message ?? "unknown" },
    });
    throw e;
  }
});
