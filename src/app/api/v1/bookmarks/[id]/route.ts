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
import { getCurrentUser } from "@/lib/client/user";
import {
  deleteBookmark,
  getBookmarkById,
  updateBookmark,
} from "@/lib/api/bookmarks";
import { audit } from "@/lib/api/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";

type Params = Promise<{ id: string }>;

export const GET = withApiError(async function GET(
  _req: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;
  const row = await getBookmarkById(user.id, id);
  if (!row) {
    await audit({
      action: "bookmark.read",
      targetType: "bookmark",
      targetId: id,
      statusCode: 404,
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await audit({
    action: "bookmark.read",
    targetType: "bookmark",
    targetId: id,
    statusCode: 200,
  });
  return NextResponse.json({ data: row });
});

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

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
      { message: `Too many update attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "bookmark.update",
      targetType: "bookmark",
      targetId: id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });
    return res;
  }

  const body = await req.json();
  const data = await updateBookmark(
    user.id,
    id,
    {
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl,
      slug: body.slug,
      isPublic: body.isPublic,
      isFavorite: body.isFavorite,
      anonymousShareEnabled: body.anonymousShareEnabled,
      password: body.password,
      tags: body.tags,
      maxViews: body.maxViews,
      maxViewsAction: body.maxViewsAction,
    },
    user.username!,
    user.role,
  );
  await audit({
    action: "bookmark.update",
    targetType: "bookmark",
    targetId: id,
    statusCode: 200,
    meta: {
      title: body.title,
      isPublic: body.isPublic,
      isFavorite: body.isFavorite,
    },
  });
  const okRes = NextResponse.json({ data });
  okRes.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
  okRes.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return okRes;
});

export const DELETE = withApiError(async function DELETE(
  _req: NextRequest,
  { params }: { params: Params },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const ip = getClientIp(_req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

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
      { message: `Too many delete attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "bookmark.delete",
      targetType: "bookmark",
      targetId: id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });
    return res;
  }

  await deleteBookmark(user.id, id);
  await audit({
    action: "bookmark.delete",
    targetType: "bookmark",
    targetId: id,
    statusCode: 200,
  });
  const okRes = NextResponse.json({ ok: true });
  okRes.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
  okRes.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return okRes;
});
