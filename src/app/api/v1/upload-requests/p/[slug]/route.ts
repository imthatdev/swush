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
import { withApiError } from "@/lib/server/api-error";
import { db } from "@/db/client";
import { uploadRequests, user } from "@/db/schemas";
import { eq, sql } from "drizzle-orm";
import { getServerSettings } from "@/lib/settings";
import { verifyPasswordHash } from "@/lib/api/password";

export const GET = withApiError(async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [row] = await db
    .select({
      id: uploadRequests.id,
      title: uploadRequests.title,
      description: uploadRequests.description,
      slug: uploadRequests.slug,
      isActive: uploadRequests.isActive,
      expiresAt: uploadRequests.expiresAt,
      brandColor: uploadRequests.brandColor,
      brandLogoUrl: uploadRequests.brandLogoUrl,
      maxUploads: uploadRequests.maxUploads,
      uploadsCount: uploadRequests.uploadsCount,
      viewsCount: uploadRequests.viewsCount,
      requiresApproval: uploadRequests.requiresApproval,
      passwordHash: uploadRequests.passwordHash,
      perUserUploadLimit: uploadRequests.perUserUploadLimit,
      perUserWindowHours: uploadRequests.perUserWindowHours,
      userId: uploadRequests.userId,
    })
    .from(uploadRequests)
    .where(eq(uploadRequests.slug, slug))
    .limit(1);

  if (!row || !row.isActive) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ message: "Expired" }, { status: 404 });
  }

  const [owner] = await db
    .select({ username: user.username, displayName: user.displayUsername })
    .from(user)
    .where(eq(user.id, row.userId))
    .limit(1);

  const settings = await getServerSettings();

  const password = req.headers.get("x-upload-password") || "";
  const requiresPassword = Boolean(row.passwordHash);
  const authorized = requiresPassword
    ? await verifyPasswordHash(password, row.passwordHash)
    : true;

  if (authorized) {
    await db
      .update(uploadRequests)
      .set({ viewsCount: sql`${uploadRequests.viewsCount} + 1` })
      .where(eq(uploadRequests.id, row.id));
  }

  return NextResponse.json({
    title: row.title,
    description: row.description,
    owner: {
      username: owner?.username || "",
      displayName: owner?.displayName || null,
    },
    limits: {
      maxUploadMb: settings.maxUploadMb,
      maxFilesPerUpload: settings.maxFilesPerUpload,
    },
    isActive: row.isActive,
    expiresAt: row.expiresAt,
    brandColor: row.brandColor,
    brandLogoUrl: row.brandLogoUrl,
    maxUploads: row.maxUploads ?? 0,
    uploadsCount: row.uploadsCount ?? 0,
    viewsCount: row.viewsCount ?? 0,
    requiresApproval: row.requiresApproval,
    requiresPassword,
    authorized,
    perUserUploadLimit: row.perUserUploadLimit ?? 0,
    perUserWindowHours: row.perUserWindowHours ?? 24,
  });
});
