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
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { userUploadSettings } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";
import {
  getUserUploadSettings,
  normalizeUploadSettings,
  resolveUploadSettings,
} from "@/lib/server/upload-settings";

export const GET = withApiError(async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getUserUploadSettings(session.user.id);
  return NextResponse.json({ settings });
});

export const PATCH = withApiError(async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const normalized = normalizeUploadSettings({
    nameConvention: body?.nameConvention,
    slugConvention: body?.slugConvention,
    imageCompressionEnabled: body?.imageCompressionEnabled,
    imageCompressionQuality: body?.imageCompressionQuality,
    mediaTranscodeEnabled: body?.mediaTranscodeEnabled,
    mediaTranscodeQuality: body?.mediaTranscodeQuality,
  });

  if (
    !normalized.nameConvention &&
    !normalized.slugConvention &&
    normalized.imageCompressionEnabled === null &&
    normalized.imageCompressionQuality === null &&
    normalized.mediaTranscodeEnabled === null &&
    normalized.mediaTranscodeQuality === null
  ) {
    await db
      .delete(userUploadSettings)
      .where(eq(userUploadSettings.userId, session.user.id));
    const defaults = resolveUploadSettings(null);
    return NextResponse.json({
      status: true,
      cleared: true,
      settings: defaults,
    });
  }

  const next = resolveUploadSettings({
    nameConvention: normalized.nameConvention ?? undefined,
    slugConvention: normalized.slugConvention ?? undefined,
    imageCompressionEnabled: normalized.imageCompressionEnabled ?? undefined,
    imageCompressionQuality: normalized.imageCompressionQuality ?? undefined,
    mediaTranscodeEnabled: normalized.mediaTranscodeEnabled ?? undefined,
    mediaTranscodeQuality: normalized.mediaTranscodeQuality ?? undefined,
  });

  await db
    .insert(userUploadSettings)
    .values({
      userId: session.user.id,
      nameConvention: next.nameConvention,
      slugConvention: next.slugConvention,
      imageCompressionEnabled: next.imageCompressionEnabled,
      imageCompressionQuality: next.imageCompressionQuality,
      mediaTranscodeEnabled: next.mediaTranscodeEnabled,
      mediaTranscodeQuality: next.mediaTranscodeQuality,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userUploadSettings.userId,
      set: {
        nameConvention: next.nameConvention,
        slugConvention: next.slugConvention,
        imageCompressionEnabled: next.imageCompressionEnabled,
        imageCompressionQuality: next.imageCompressionQuality,
        mediaTranscodeEnabled: next.mediaTranscodeEnabled,
        mediaTranscodeQuality: next.mediaTranscodeQuality,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ status: true, cleared: false, settings: next });
});
