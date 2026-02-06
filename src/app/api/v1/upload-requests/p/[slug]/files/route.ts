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
import { db } from "@/db/client";
import {
  uploadRequestItems,
  uploadRequests,
  user,
  userInfo,
} from "@/db/schemas";
import { eq, sql } from "drizzle-orm";
import { uploadFileForUser } from "@/lib/api/files/upload";
import { verifyCaptchaPassToken } from "@/lib/server/captcha";
import { verifyPasswordHash } from "@/lib/api/password";
import { createNotification } from "@/lib/server/notifications";
import { rateLimit } from "@/lib/security/rate-limit";

function getRemoteIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip");
}

export const POST = withApiError(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [row] = await db
    .select({
      id: uploadRequests.id,
      userId: uploadRequests.userId,
      isActive: uploadRequests.isActive,
      expiresAt: uploadRequests.expiresAt,
      folderName: uploadRequests.folderName,
      maxUploads: uploadRequests.maxUploads,
      uploadsCount: uploadRequests.uploadsCount,
      requiresApproval: uploadRequests.requiresApproval,
      passwordHash: uploadRequests.passwordHash,
      perUserUploadLimit: uploadRequests.perUserUploadLimit,
      perUserWindowHours: uploadRequests.perUserWindowHours,
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

  if (row.maxUploads && row.uploadsCount >= row.maxUploads) {
    return NextResponse.json(
      { message: "Upload limit reached" },
      { status: 403 },
    );
  }

  if (row.passwordHash) {
    const password = req.headers.get("x-upload-password") || "";
    const ok = await verifyPasswordHash(password, row.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { message: "Password required" },
        { status: 401 },
      );
    }
  }

  const [owner] = await db
    .select({
      id: user.id,
      username: user.username,
      role: userInfo.role,
    })
    .from(user)
    .leftJoin(userInfo, eq(userInfo.userId, user.id))
    .where(eq(user.id, row.userId))
    .limit(1);

  if (!owner) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const passToken = req.headers.get("x-captcha-pass");
  const passResult = verifyCaptchaPassToken(passToken, getRemoteIp(req));
  if (!passResult.ok) {
    return NextResponse.json({ message: "Captcha required" }, { status: 400 });
  }

  if (row.perUserUploadLimit && row.perUserUploadLimit > 0) {
    const ipKey = getRemoteIp(req) || "unknown";
    const windowHours = row.perUserWindowHours || 24;
    const limitResult = await rateLimit({
      key: `upload-request:${row.id}:${ipKey}`,
      limit: row.perUserUploadLimit,
      windowMs: windowHours * 60 * 60 * 1000,
    });
    if (!limitResult.success) {
      return NextResponse.json(
        {
          message: "Rate limit reached",
          retryAfter: limitResult.retryAfter,
        },
        { status: 429 },
      );
    }
  }

  const result = await uploadFileForUser(
    req,
    {
      id: owner.id,
      username: owner.username || "",
      role: owner.role || "user",
    },
    {
      folderName: row.folderName ?? null,
      forcePrivate: true,
    },
  );

  if (result.status === 201 && "id" in result.body) {
    const status = row.requiresApproval ? "pending" : "approved";
    await db.insert(uploadRequestItems).values({
      uploadRequestId: row.id,
      fileId: result.body.id,
      status,
      createdAt: new Date(),
    });

    await db
      .update(uploadRequests)
      .set({
        uploadsCount: sql`${uploadRequests.uploadsCount} + 1`,
        isActive:
          row.maxUploads && row.uploadsCount + 1 >= row.maxUploads
            ? false
            : row.isActive,
      })
      .where(eq(uploadRequests.id, row.id));

    await createNotification({
      userId: owner.id,
      title: "New upload received",
      message: row.requiresApproval
        ? "A file is waiting for approval."
        : "A file was uploaded via your upload link.",
      type: "upload-request",
      data: {
        uploadRequestId: row.id,
        fileId: result.body.id,
        status,
      },
    });
  }

  return NextResponse.json(result.body, { status: result.status });
});
