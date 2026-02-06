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
import { createShortLink, listShortLinks } from "@/lib/api/shorten";
import { audit } from "@/lib/api/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";

export const GET = withApiError(async function GET(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["shorten"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "shortlinks");
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

  const result = await listShortLinks({
    userId: user.id,
    q,
    tagFilter: tags,
    favoriteOnly,
    publicOnly,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  });

  await audit({
    action: "shortlink.list",
    targetType: "shortlink",
    targetId: user.id,
    statusCode: 200,
    meta: {
      q,
      tags,
      favoriteOnly,
      publicOnly,
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
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["shorten"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "shortlinks");
  if (blocked) return blocked;

  const ip = getClientIp(req);
  const ipLimit = 15;
  const userLimit = 10;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `u:${user.id}:shortlink-create`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many shortlink create attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "shortlink.create",
      targetType: "shortlink",
      targetId: user.id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  try {
    await enforceCreateLimit({
      userId: user.id,
      role: user.role,
      kind: "shortLink",
    });

    const body = await req.json();
    const row = await createShortLink(
      {
        userId: user.id,
        originalUrl: body.originalUrl,
        description: body.description,
        tags: body.tags,
        maxClicks: body.maxClicks,
        clickCount: body.clickCount,
        expiresAt: body.expiresAt,
        slug: body.slug,
        isPublic: body.isPublic,
        isFavorite: body.isFavorite,
        password: body.password,
        maxViewsAction: body.maxViewsAction,
      },
      user.username!,
      user.role,
    );

    const origin = req.nextUrl.origin.replace(/\/+$/, "");
    const shortUrl = `${origin}/s/${row.slug}`;

    await audit({
      action: "shortlink.create",
      targetType: "shortlink",
      targetId: row.id!,
      statusCode: 201,
      meta: { title: row.originalUrl },
    });

    const res = NextResponse.json(
      { data: { ...row, url: shortUrl }, url: shortUrl },
      { status: 201 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
    return res;
  } catch (e) {
    const err = e as { code?: string; message?: string; constraint?: string };
    const isDuplicate =
      err?.code === "23505" ||
      (err?.message && err.message.toLowerCase().includes("duplicate"));
    const isSlug =
      (err?.constraint && err.constraint.includes("short_links_slug")) ||
      (err?.message && err.message.toLowerCase().includes("slug"));

    if (isDuplicate && isSlug) {
      await audit({
        action: "shortlink.create",
        targetType: "shortlink",
        targetId: user.id,
        statusCode: 409,
        meta: { error: "slug_exists" },
      });
      return NextResponse.json(
        { error: "Slug already exists" },
        { status: 409 },
      );
    }

    if (e instanceof LimitPolicyError) {
      await audit({
        action: "shortlink.create",
        targetType: "shortlink",
        targetId: user.id,
        statusCode: 429,
        meta: { error: e.message },
      });
      const res = NextResponse.json({ error: e.message }, { status: 429 });
      res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
      res.headers.set("RateLimit-Remaining", "0");
      res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
      res.headers.set("Retry-After", String(Math.ceil(windowMs / 1000)));
      return res;
    }
    await audit({
      action: "shortlink.create",
      targetType: "shortlink",
      targetId: user.id,
      statusCode: 500,
      meta: { error: (e as Error)?.message ?? "unknown" },
    });
    throw e;
  }
});
