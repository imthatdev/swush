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
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";
import { getShortLinkAnalytics } from "@/lib/server/shortlink-analytics";

export const GET = withApiError(async function GET(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["shorten"]);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = await requireUserFeature(user.id, "shortlinks");
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!ids.length) {
    return NextResponse.json(
      { error: "Provide at least one short link id in ids" },
      { status: 400 },
    );
  }

  const daysRaw = Number(searchParams.get("days") || "30");
  const days = Number.isFinite(daysRaw)
    ? Math.min(Math.max(Math.trunc(daysRaw), 1), 365)
    : 30;

  const data = await getShortLinkAnalytics({
    userId: user.id,
    shortLinkIds: ids,
    days,
  });

  return NextResponse.json({ data });
});
