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
import {
  anilistFetchUserAnime,
  anilistFetchViewerAnime,
} from "@/lib/providers/anilist";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { anilistLink } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("user")?.trim();
  if (!username) {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [link] = await db
      .select({
        accessToken: anilistLink.accessToken,
        expiresAt: anilistLink.expiresAt,
      })
      .from(anilistLink)
      .where(eq(anilistLink.userId, session.user.id))
      .limit(1);

    if (!link?.accessToken) {
      return NextResponse.json(
        { error: "AniList not linked" },
        { status: 401 }
      );
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "AniList token expired" },
        { status: 401 }
      );
    }

    try {
      const items = await anilistFetchViewerAnime(link.accessToken);
      return NextResponse.json({ items });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
  try {
    const items = await anilistFetchUserAnime(username);
    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
