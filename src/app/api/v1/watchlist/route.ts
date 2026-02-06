/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

import { NextRequest, NextResponse } from "next/server";
import { addToWatchlist, listMyWatchlist } from "@/lib/api/watchlist";
import { audit } from "@/lib/api/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const limit = Number(params.get("limit") || "0");
  const offset = Number(params.get("offset") || "0");
  const mediaType = params.get("mediaType") || params.get("tab") || "all";
  const q = params.get("q") || undefined;

  const result = await listMyWatchlist({
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
    mediaType: mediaType as "movie" | "tv" | "anime" | "all",
    q,
  });
  await audit({
    action: "watchlist.list",
    targetType: "watchlist",
    targetId: "self",
    statusCode: result.status,
    meta: {
      count: Array.isArray((result.body as { items?: unknown[] })?.items)
        ? (result.body as { items: unknown[] }).items.length
        : undefined,
    },
  });
  const res = NextResponse.json(result.body, { status: result.status });
  return res;
});

export const POST = withApiError(async function POST(req: NextRequest) {
  const body = await req.json();

  const ip = getClientIp(req);
  const ipLimit = 20;
  const windowMs = 60_000;

  const ipRL = await rateLimit({
    key: `ip:${ip}:watchlist-add`,
    limit: ipLimit,
    windowMs,
  });
  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many watchlist add attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "watchlist.add.rate_limited",
      targetType: "watchlist",
      targetId: "unknown",
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const result = await addToWatchlist(body);
  await audit({
    action: "watchlist.add",
    targetType: "watchlist",
    targetId: result.body && "id" in result.body ? result.body.id : "unknown",
    statusCode: result.status,
    meta: body,
  });
  const res = NextResponse.json(result.body, { status: result.status });
  res.headers.set("RateLimit-Limit", String(ipLimit));
  res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return res;
});
