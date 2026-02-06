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

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user, userPreferences } from "@/db/schemas";
import { withApiError } from "@/lib/server/api-error";

type Params = Promise<{ username: string }>;

export const GET = withApiError(async function GET(
  _: Request,
  { params }: { params: Params },
) {
  const { username } = await params;
  const rows = await db
    .select({
      publicProfileEnabled: userPreferences.publicProfileEnabled,
      showSocialsOnShare: userPreferences.showSocialsOnShare,
      socialInstagram: userPreferences.socialInstagram,
      socialX: userPreferences.socialX,
      socialGithub: userPreferences.socialGithub,
      socialWebsite: userPreferences.socialWebsite,
      socialOther: userPreferences.socialOther,
    })
    .from(user)
    .leftJoin(userPreferences, eq(userPreferences.userId, user.id))
    .where(eq(user.username, username))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = rows[0];
  if (row.publicProfileEnabled === false) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const trim = (value: string | null) => (value ? value.trim() : null);
  const socials = {
    instagram: trim(row.socialInstagram),
    x: trim(row.socialX),
    github: trim(row.socialGithub),
    website: trim(row.socialWebsite),
    other: trim(row.socialOther),
  };
  const hasAny = Object.values(socials).some(Boolean);
  const showSocials = Boolean(row.showSocialsOnShare && hasAny);

  return NextResponse.json({
    showSocials,
    socials: showSocials ? socials : {},
  });
});
