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
import { uploadRequestItems, uploadRequests } from "@/db/schemas";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { hashPassword } from "@/lib/api/password";

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const rows = await db.query.uploadRequests.findMany({
    where: eq(uploadRequests.userId, user.id),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
  });

  const pendingCounts = new Map<string, number>();
  await Promise.all(
    rows.map(async (row) => {
      const [{ count = 0 } = {}] = await db
        .select({ count: sql<number>`count(*)` })
        .from(uploadRequestItems)
        .where(
          and(
            eq(uploadRequestItems.uploadRequestId, row.id),
            eq(uploadRequestItems.status, "pending"),
          ),
        );
      pendingCounts.set(row.id, Number(count || 0));
    }),
  );

  return NextResponse.json({
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      slug: row.slug,
      isActive: row.isActive,
      expiresAt: row.expiresAt,
      folderName: row.folderName,
      brandColor: row.brandColor,
      brandLogoUrl: row.brandLogoUrl,
      maxUploads: row.maxUploads,
      uploadsCount: row.uploadsCount,
      viewsCount: row.viewsCount,
      requiresApproval: row.requiresApproval,
      passwordEnabled: Boolean(row.passwordHash),
      perUserUploadLimit: row.perUserUploadLimit,
      perUserWindowHours: row.perUserWindowHours,
      pendingCount: pendingCounts.get(row.id) || 0,
      createdAt: row.createdAt,
    })),
  });
});

export const POST = withApiError(async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

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

  if (!body?.title?.trim()) {
    return NextResponse.json({ message: "Title is required" }, { status: 400 });
  }

  const baseSlug = normalizeSlug(body.title);
  const slug = `${baseSlug || "upload"}-${nanoid(6)}`;

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const passwordHash = body?.password?.trim()
    ? await hashPassword(body.password.trim())
    : null;

  const [row] = await db
    .insert(uploadRequests)
    .values({
      userId: user.id,
      title: body.title.trim(),
      description: body.description?.trim() || null,
      folderName: body.folderName?.trim() || null,
      brandColor: body.brandColor?.trim() || null,
      brandLogoUrl: body.brandLogoUrl?.trim() || null,
      maxUploads: Number.isFinite(body.maxUploads)
        ? Math.max(0, Number(body.maxUploads))
        : 0,
      perUserUploadLimit: Number.isFinite(body.perUserUploadLimit)
        ? Math.max(0, Number(body.perUserUploadLimit))
        : 0,
      perUserWindowHours: Number.isFinite(body.perUserWindowHours)
        ? Math.max(1, Number(body.perUserWindowHours))
        : 24,
      requiresApproval: Boolean(body.requiresApproval),
      passwordHash,
      slug,
      isActive: body.isActive !== false,
      expiresAt:
        expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
    })
    .returning();

  return NextResponse.json({
    id: row.id,
    title: row.title,
    description: row.description,
    slug: row.slug,
    isActive: row.isActive,
    expiresAt: row.expiresAt,
    folderName: row.folderName,
    brandColor: row.brandColor,
    brandLogoUrl: row.brandLogoUrl,
    maxUploads: row.maxUploads,
    uploadsCount: row.uploadsCount,
    viewsCount: row.viewsCount,
    requiresApproval: row.requiresApproval,
    passwordEnabled: Boolean(row.passwordHash),
    perUserUploadLimit: row.perUserUploadLimit,
    perUserWindowHours: row.perUserWindowHours,
  });
});
