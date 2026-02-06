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

import "server-only";

import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import {
  filesToTags as ftTags,
  tags as tagsTbl,
  user as usersTbl,
  folders as foldersTbl,
  userInfo,
  audioMetadata,
} from "@/db/schemas";
import { eq } from "drizzle-orm";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { findFileByKey } from "./shared";
import { verifyPasswordHash } from "@/lib/api/password";
import {
  enforceAnonymousFileLimits,
  isAnonymousRequest,
} from "@/lib/server/anonymous-share";
import { isMedia } from "@/lib/mime-types";

export async function getFile(req: NextRequest, key: string) {
  const rows = await findFileByKey(key);
  if (rows.length === 0)
    return { status: 404 as const, body: { message: "Not found" } };
  const f = rows[0];

  const isAnonymous =
    isAnonymousRequest(req) || f.anonymousShareEnabled === true;

  const includeOwner =
    !isAnonymous &&
    (req.nextUrl.searchParams.get("include") || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes("owner");

  if (f.password) {
    const passwordRaw = req.nextUrl.searchParams.get("p");
    if (!passwordRaw || !(await verifyPasswordHash(passwordRaw, f.password))) {
      return {
        status: 403 as const,
        body: { message: "Invalid or missing password" },
      };
    }
  }

  if (!f.isPublic) {
    let user = await getCurrentUser();
    if (!user) user = await getCurrentUserFromToken(req);
    if (!user || user.id !== f.userId) {
      return { status: 403 as const, body: { message: "Private file" } };
    }
  }

  if (isAnonymous) {
    const limitError = enforceAnonymousFileLimits({
      size: f.size,
      mimeType: f.mimeType,
      createdAt: f.createdAt ?? null,
    });
    if (limitError) {
      return { status: 403 as const, body: { message: limitError } };
    }
  }

  let ownerUsername: string | null = null;
  let ownerDisplayName: string | null = null;
  let ownerImage: string | null = null;
  let ownerBio: string | null = null;
  let ownerVerified: boolean | null = null;
  if (includeOwner) {
    const owner = await db
      .select({
        username: usersTbl.username,
        displayUsername: usersTbl.displayUsername,
        name: usersTbl.name,
        image: usersTbl.image,
        bio: userInfo.bio,
        verified: userInfo.verified,
      })
      .from(usersTbl)
      .leftJoin(userInfo, eq(userInfo.userId, usersTbl.id))
      .where(eq(usersTbl.id, f.userId))
      .limit(1);
    if (owner.length) {
      ownerUsername = owner[0].username ?? null;
      ownerDisplayName = owner[0].name || owner[0].displayUsername || null;
      ownerImage = owner[0].image ?? null;
      ownerBio = owner[0].bio ?? null;
      ownerVerified = owner[0].verified ?? null;
    }
  }

  const tagRows = await db
    .select({ name: tagsTbl.name })
    .from(ftTags)
    .leftJoin(tagsTbl, eq(ftTags.tagId, tagsTbl.id))
    .where(eq(ftTags.fileId, f.id));
  const tagNames = tagRows.map((r) => r.name).filter((n): n is string => !!n);

  let folderName: string | null = null;
  if (f.folderId) {
    const folderRows = await db
      .select({ name: foldersTbl.name })
      .from(foldersTbl)
      .where(eq(foldersTbl.id, f.folderId))
      .limit(1);
    folderName = folderRows[0]?.name ?? null;
  }

  let audioMeta: {
    title?: string;
    artist?: string;
    album?: string;
    pictureDataUrl?: string;
    gradient?: string;
  } | null = null;
  if (isMedia("audio", f.mimeType, f.originalName)) {
    const metaRows = await db
      .select()
      .from(audioMetadata)
      .where(eq(audioMetadata.fileId, f.id))
      .limit(1);
    const meta = metaRows[0];
    if (meta) {
      audioMeta = {
        title: meta.title ?? undefined,
        artist: meta.artist ?? undefined,
        album: meta.album ?? undefined,
        pictureDataUrl: meta.pictureDataUrl ?? undefined,
        gradient: meta.gradient ?? undefined,
      };
    }
  }

  return {
    status: 200 as const,
    body: {
      id: f.id,
      userId: f.userId,
      slug: f.slug,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      description: f.description,
      createdAt: f.createdAt,
      isPublic: f.isPublic,
      tags: tagNames,
      folderId: f.folderId ?? null,
      maxViews: f.maxViews ?? null,
      maxViewsAction: f.maxViewsAction || null,
      folderName,
      audioMeta,
      views: f.views,
      anonymousShareEnabled: f.anonymousShareEnabled ?? false,
      ownerUsername,
      ownerDisplayName,
      ownerImage,
      ownerBio,
      ownerVerified,
    },
  };
}
