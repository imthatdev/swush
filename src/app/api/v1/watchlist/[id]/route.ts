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
import { removeWatchlistItem, updateWatchlistItem } from "@/lib/api/watchlist";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { audit } from "@/lib/api/audit";
import { withApiError } from "@/lib/server/api-error";

type Params = Promise<{ id: string }>;

export const PATCH = withApiError(async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;

  const ip = getClientIp(req);
  const ipLimit = 20;
  const windowMs = 60_000;

  const ipRL = await rateLimit({
    key: `ip:${ip}:watchlist-update`,
    limit: ipLimit,
    windowMs,
  });
  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many watchlist update attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "watchlist.update",
      targetType: "watchlist",
      targetId: id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const patch = await req.json();
  const result = await updateWatchlistItem(id, patch);
  const okRes = NextResponse.json(result.body, { status: result.status });
  okRes.headers.set("RateLimit-Limit", String(ipLimit));
  okRes.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return okRes;
});

export const DELETE = withApiError(async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;

  const ip = getClientIp(req);
  const ipLimit = 20;
  const windowMs = 60_000;

  const ipRL = await rateLimit({
    key: `ip:${ip}:watchlist-delete`,
    limit: ipLimit,
    windowMs,
  });
  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many watchlist delete attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "watchlist.delete",
      targetType: "watchlist",
      targetId: id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const result = await removeWatchlistItem(id);
  const okRes = NextResponse.json(result.body, { status: result.status });
  okRes.headers.set("RateLimit-Limit", String(ipLimit));
  okRes.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return okRes;
});
