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
import {
  getPublicBookmarkBySlug,
  incrementBookmarkViews,
} from "@/lib/api/bookmarks";
import { verifyPasswordHash } from "@/lib/api/password";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { withApiError } from "@/lib/server/api-error";
import {
  enforceAnonymousShareAge,
  isAnonymousRequest,
  stripOwnerDetails,
} from "@/lib/server/anonymous-share";
import { recordContentViewEvent } from "@/lib/server/content-view-analytics";
import { recordItemAnalyticsHit } from "@/lib/server/item-analytics";

type Params = Promise<{ slug: string }>;

export const POST = withApiError(async function POST(
  req: NextRequest,
  { params }: { params: Params },
) {
  const isAnonymous = isAnonymousRequest(req);
  const { slug } = await params;

  const ip = getClientIp(req);
  const ipLimit = 30;
  const slugLimit = 15;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const slugRL = await rateLimit({
    key: `slug:${slug}`,
    limit: slugLimit,
    windowMs,
  });

  if (!ipRL.success || !slugRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, slugRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, slugLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const body = await req.json().catch(() => ({}) as { password?: string });
  const candidate = body?.password;

  const row = await getPublicBookmarkBySlug(slug);
  if (!row || !row.isPublic)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const anonymous = isAnonymous || row.anonymousShareEnabled === true;
  if (anonymous) {
    const ageError = enforceAnonymousShareAge(row.createdAt ?? null);
    if (ageError)
      return NextResponse.json({ error: ageError }, { status: 410 });
  }

  if (row.passwordHash) {
    if (!candidate)
      return NextResponse.json({ error: "Password required" }, { status: 401 });

    if (!verifyPasswordHash(candidate, row.passwordHash)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
  }

  const { tagColors, ...rest } = row as typeof row & {
    tagColors?: Record<string, string | null>;
  };
  const safe = anonymous ? stripOwnerDetails(rest) : rest;

  await incrementBookmarkViews(safe.id);
  await recordContentViewEvent({
    ownerUserId: row.userId,
    itemType: "bookmark",
    itemId: row.id,
    slug,
    headers: req.headers,
  });
  await recordItemAnalyticsHit({
    itemType: "bookmark",
    itemId: row.id,
    headers: req.headers,
    context: "public_view",
  });

  const res = NextResponse.json({ data: safe, tagColors: tagColors ?? {} });
  res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, slugLimit)));
  res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return res;
});
