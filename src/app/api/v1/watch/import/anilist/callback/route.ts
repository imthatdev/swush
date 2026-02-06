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
import { anilistExchangeCode, verifyAniListState } from "@/lib/api/anilist";
import { db } from "@/db/client";
import { anilistLink } from "@/db/schemas";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  const { appUrl } = await getPublicRuntimeSettings();

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  const redirectBase = new URL("/anilist/linked", appUrl);

  if (!code || !state) {
    redirectBase.searchParams.set("error", "missing");
    return NextResponse.redirect(redirectBase);
  }

  const userId = verifyAniListState(state);
  if (!userId) {
    redirectBase.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const token = await anilistExchangeCode(code);
    const expiresAt = token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000)
      : null;

    await db
      .insert(anilistLink)
      .values({
        userId,
        accessToken: token.access_token,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: anilistLink.userId,
        set: {
          accessToken: token.access_token,
          expiresAt,
          updatedAt: new Date(),
        },
      });

    redirectBase.searchParams.set("linked", "1");
  } catch {
    redirectBase.searchParams.set("error", "token_exchange");
  }

  return NextResponse.redirect(redirectBase);
});
