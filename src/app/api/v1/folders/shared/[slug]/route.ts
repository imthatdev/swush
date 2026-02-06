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
import { verifyPasswordHash } from "@/lib/api/password";
import { db } from "@/db/client";
import { files, folders, user as users, userInfo } from "@/db/schemas";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";

type Params = Promise<{ slug: string }>;

export const GET = withApiError(async function GET(
  req: NextRequest,
  { params }: { params: Params },
) {
  const resolved = await params;
  const slug = decodeURIComponent(resolved.slug || "");
  if (!slug) {
    return NextResponse.json({ message: "Missing folder id" }, { status: 400 });
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      slug,
    );
  const folder = await db
    .select({
      id: folders.id,
      userId: folders.userId,
      name: folders.name,
      shareEnabled: folders.shareEnabled,
      sharePassword: folders.sharePassword,
      shareSlug: folders.shareSlug,
    })
    .from(folders)
    .where(
      isUuid
        ? or(eq(folders.id, slug), eq(folders.shareSlug, slug))
        : eq(folders.shareSlug, slug),
    )
    .limit(1);

  if (!folder.length || !folder[0].shareEnabled) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (folder[0].sharePassword) {
    const password = req.nextUrl.searchParams.get("p");
    if (
      !password ||
      !(await verifyPasswordHash(password, folder[0].sharePassword))
    ) {
      return NextResponse.json(
        { message: "Invalid or missing password" },
        { status: 403 },
      );
    }
  }

  const owner = await db
    .select({
      username: users.username,
      displayUsername: users.displayUsername,
      name: users.name,
      image: users.image,
      bio: userInfo.bio,
      verified: userInfo.verified,
    })
    .from(users)
    .leftJoin(userInfo, eq(userInfo.userId, users.id))
    .where(eq(users.id, folder[0].userId))
    .limit(1);

  const fileRows = await db
    .select({
      id: files.id,
      slug: files.slug,
      originalName: files.originalName,
      mimeType: files.mimeType,
      size: files.size,
      isPublic: files.isPublic,
      createdAt: files.createdAt,
      hasPassword: sql<boolean>`(${files.password} is not null)`,
    })
    .from(files)
    .where(
      and(
        eq(files.folderId, folder[0].id),
        eq(files.userId, folder[0].userId),
        eq(files.isPublic, true),
        isNull(files.password),
      ),
    )
    .orderBy(desc(files.createdAt));

  return NextResponse.json({
    folder: {
      id: folder[0].id,
      userId: folder[0].userId,
      name: folder[0].name,
      shareSlug: folder[0].shareSlug,
      ownerUsername: owner[0]?.username ?? null,
      ownerDisplayName: owner[0]?.name || owner[0]?.displayUsername || null,
      ownerImage: owner[0]?.image ?? null,
      ownerBio: owner[0]?.bio ?? null,
      ownerVerified: owner[0]?.verified ?? null,
      hasPassword: Boolean(folder[0].sharePassword),
    },
    files: fileRows.map((f) => ({
      ...f,
      createdAt: f.createdAt ? f.createdAt.toISOString() : null,
    })),
  });
});
