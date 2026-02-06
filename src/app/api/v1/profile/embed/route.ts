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
import { userEmbedSettings } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { normalizeEmbedSettings } from "@/lib/server/embed-settings";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await db.query.userEmbedSettings.findFirst({
    where: eq(userEmbedSettings.userId, session.user.id),
  });

  return NextResponse.json({
    settings: {
      title: row?.title ?? null,
      description: row?.description ?? null,
      color: row?.color ?? null,
      imageUrl: row?.imageUrl ?? null,
    },
  });
});

export const PATCH = withApiError(async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const normalized = normalizeEmbedSettings({
    title: body?.title,
    description: body?.description,
    color: body?.color,
    imageUrl: body?.imageUrl,
  });

  if (
    !normalized ||
    (!normalized.title &&
      !normalized.description &&
      !normalized.color &&
      !normalized.imageUrl)
  ) {
    await db
      .delete(userEmbedSettings)
      .where(eq(userEmbedSettings.userId, session.user.id));
    return NextResponse.json({ status: true, cleared: true });
  }

  await db
    .insert(userEmbedSettings)
    .values({
      userId: session.user.id,
      title: normalized.title,
      description: normalized.description,
      siteName: null,
      color: normalized.color,
      imageUrl: normalized.imageUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userEmbedSettings.userId,
      set: {
        title: normalized.title,
        description: normalized.description,
        siteName: null,
        color: normalized.color,
        imageUrl: normalized.imageUrl,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ status: true, cleared: false });
});
