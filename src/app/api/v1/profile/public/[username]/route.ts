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
import { db } from "@/db/client";
import { files, user, userInfo, userPreferences } from "@/db/schemas";
import { and, count, eq } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const [owner] = await db
    .select({
      id: user.id,
      username: user.username,
      displayName: user.displayUsername,
      name: user.name,
      image: user.image,
      bio: userInfo.bio,
      verified: userInfo.verified,
    })
    .from(user)
    .leftJoin(userInfo, eq(userInfo.userId, user.id))
    .where(eq(user.username, username))
    .limit(1);

  if (!owner)
    return NextResponse.json({ message: "Not found" }, { status: 404 });

  const [prefs] = await db
    .select({
      publicProfileEnabled: userPreferences.publicProfileEnabled,
    })
    .from(userPreferences)
    .where(eq(userPreferences.userId, owner.id))
    .limit(1);

  if (prefs?.publicProfileEnabled === false) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const [fileCount] = await Promise.all([
    db
      .select({ total: count(files.id).mapWith(Number) })
      .from(files)
      .where(and(eq(files.userId, owner.id), eq(files.isPublic, true))),
  ]);

  const [fileItems] = await Promise.all([
    db.query.files.findMany({
      where: and(eq(files.userId, owner.id), eq(files.isPublic, true)),
      columns: { id: true, originalName: true, slug: true },
      limit: 3,
      orderBy: (f, { desc }) => [desc(f.createdAt)],
    }),
  ]);

  return NextResponse.json({
    owner: {
      ...owner,
      displayName: owner.name || owner.displayName,
    },
    counts: {
      files: fileCount?.[0]?.total ?? 0,
    },
    recent: {
      files: fileItems,
    },
  });
});
