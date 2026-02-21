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
import { audioMetadata } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { verifyPasswordHash } from "@/lib/api/password";
import { enforceAnonymousFileLimits } from "@/lib/server/anonymous-share";
import {
  computeAudioGradient,
  extractAudioMetadata,
} from "@/lib/server/audio-metadata";
import { isMedia } from "@/lib/mime-types";
import { findFileByKey } from "./shared";

type AudioMetaResponse = {
  title?: string;
  artist?: string;
  album?: string;
  pictureDataUrl?: string;
  gradient?: string;
} | null;

export async function getAudioMetadata(req: NextRequest, key: string) {
  const rows = await findFileByKey(key);
  if (rows.length === 0)
    return { status: 404 as const, body: { message: "Not found" } };
  const f = rows[0];

  const hasPassword = Boolean(f.password);
  const suppliedPassword = req.nextUrl.searchParams.get("p") || undefined;

  if (hasPassword) {
    const ok =
      suppliedPassword &&
      (await verifyPasswordHash(suppliedPassword, f.password));
    if (!ok) {
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

  const isAnonymous = f.anonymousShareEnabled === true;
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

  if (!isMedia("audio", f.mimeType, f.originalName)) {
    return { status: 200 as const, body: null };
  }

  const existing = await db
    .select()
    .from(audioMetadata)
    .where(eq(audioMetadata.fileId, f.id))
    .limit(1);
  if (existing.length) {
    const meta = existing[0];
    let gradient = meta.gradient ?? null;
    if (
      !gradient &&
      meta.pictureDataUrl !== null &&
      meta.pictureDataUrl !== undefined
    ) {
      gradient = await computeAudioGradient(meta.pictureDataUrl);
      if (gradient) {
        await db
          .update(audioMetadata)
          .set({ gradient, updatedAt: new Date() })
          .where(eq(audioMetadata.id, meta.id));
      }
    }
    return {
      status: 200 as const,
      body: {
        title: meta.title ?? undefined,
        artist: meta.artist ?? undefined,
        album: meta.album ?? undefined,
        pictureDataUrl: meta.pictureDataUrl ?? undefined,
        gradient: gradient ?? undefined,
      } satisfies AudioMetaResponse,
    };
  }

  const driver = f.storageDriver === "s3" ? "s3" : "local";
  const extracted = await extractAudioMetadata(
    { userId: f.userId, storedName: f.storedName },
    driver,
  );

  if (!extracted) {
    return { status: 200 as const, body: null };
  }

  await db
    .insert(audioMetadata)
    .values({
      fileId: f.id,
      title: extracted.title ?? null,
      artist: extracted.artist ?? null,
      album: extracted.album ?? null,
      pictureDataUrl: extracted.pictureDataUrl ?? null,
      gradient: extracted.gradient ?? null,
    })
    .onConflictDoNothing();

  return { status: 200 as const, body: extracted satisfies AudioMetaResponse };
}
