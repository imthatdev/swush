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
import { withApiError } from "@/lib/server/api-error";
import { getCurrentUser } from "@/lib/client/user";
import { db } from "@/db/client";
import { uploadRequests } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "@/lib/api/password";

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    title?: string;
    description?: string | null;
    folderName?: string | null;
    brandColor?: string | null;
    brandLogoUrl?: string | null;
    maxUploads?: number | null;
    requiresApproval?: boolean;
    password?: string | null;
    perUserUploadLimit?: number | null;
    perUserWindowHours?: number | null;
    isActive?: boolean;
    expiresAt?: string | null;
  } | null;

  const expiresAt = body?.expiresAt ? new Date(body.expiresAt) : null;

  const passwordHash =
    typeof body?.password === "string"
      ? body.password.trim()
        ? await hashPassword(body.password.trim())
        : null
      : undefined;

  await db
    .update(uploadRequests)
    .set({
      title: body?.title?.trim() || undefined,
      description: body?.description?.trim() || null,
      folderName: body?.folderName?.trim() || null,
      brandColor:
        typeof body?.brandColor === "string"
          ? body.brandColor.trim() || null
          : undefined,
      brandLogoUrl:
        typeof body?.brandLogoUrl === "string"
          ? body.brandLogoUrl.trim() || null
          : undefined,
      maxUploads: Number.isFinite(body?.maxUploads)
        ? Math.max(0, Number(body?.maxUploads))
        : undefined,
      perUserUploadLimit: Number.isFinite(body?.perUserUploadLimit)
        ? Math.max(0, Number(body?.perUserUploadLimit))
        : undefined,
      perUserWindowHours: Number.isFinite(body?.perUserWindowHours)
        ? Math.max(1, Number(body?.perUserWindowHours))
        : undefined,
      requiresApproval:
        typeof body?.requiresApproval === "boolean"
          ? body.requiresApproval
          : undefined,
      passwordHash,
      isActive: typeof body?.isActive === "boolean" ? body.isActive : undefined,
      expiresAt:
        expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(uploadRequests.id, id), eq(uploadRequests.userId, user.id)));

  return NextResponse.json({ ok: true });
});

export const DELETE = withApiError(async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db
    .delete(uploadRequests)
    .where(and(eq(uploadRequests.id, id), eq(uploadRequests.userId, user.id)));

  return NextResponse.json({ ok: true });
});
