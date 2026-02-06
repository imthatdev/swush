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
import { getCurrentUser } from "@/lib/client/user";
import { db } from "@/db/client";
import { folders } from "@/db/schemas/core-schema";
import { and, eq } from "drizzle-orm";
import { audit } from "@/lib/api/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { hashPassword } from "@/lib/api/password";
import { generateFunnySlug } from "@/lib/funny-slug";
import { withApiError } from "@/lib/server/api-error";

export const PATCH = withApiError(async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 15;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `user:${user.id}:folder-share`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many folder share attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "folder.share",
      targetType: "folder",
      targetId: user.id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const body = await req.json().catch(() => null);
  const id = body?.id;
  const shareEnabled = body?.shareEnabled;
  const password = body?.password;

  if (!id || typeof id !== "string") {
    await audit({
      action: "folder.share",
      targetType: "folder",
      targetId: String(id ?? ""),
      statusCode: 400,
      meta: { reason: "missing-id" },
    });
    return NextResponse.json(
      { message: "Folder id is required" },
      { status: 400 }
    );
  }

  const owned = await db
    .select({ id: folders.id, shareEnabled: folders.shareEnabled, shareSlug: folders.shareSlug })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)))
    .limit(1);

  if (owned.length === 0) {
    await audit({
      action: "folder.share",
      targetType: "folder",
      targetId: id,
      statusCode: 404,
      meta: { reason: "not-found" },
    });
    return NextResponse.json({ message: "Folder not found" }, { status: 404 });
  }

  const updateValues: Record<string, unknown> = {};
  if (typeof shareEnabled === "boolean") {
    updateValues.shareEnabled = shareEnabled;
    if (!shareEnabled) {
      updateValues.sharePassword = null;
    }
  }

  if (password !== undefined) {
    if (password === null) {
      updateValues.sharePassword = null;
    } else if (typeof password === "string") {
      const trimmed = password.trim();
      updateValues.sharePassword = trimmed
        ? await hashPassword(trimmed)
        : null;
    } else {
      return NextResponse.json(
        { message: "Invalid password" },
        { status: 400 }
      );
    }
  }

  if (!owned[0].shareSlug) {
    const shouldCreate =
      shareEnabled === true || (shareEnabled !== false && owned[0].shareEnabled);
    if (shouldCreate) {
      updateValues.shareSlug = await generateFunnySlug("folders");
    }
  }

  if (Object.keys(updateValues).length === 0) {
    return NextResponse.json(
      { message: "No changes provided" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(folders)
    .set(updateValues)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)))
    .returning({
      shareEnabled: folders.shareEnabled,
      sharePassword: folders.sharePassword,
      shareSlug: folders.shareSlug,
    });

  await audit({
    action: "folder.share",
    targetType: "folder",
    targetId: id,
    statusCode: 200,
    meta: { shareEnabled: updated.shareEnabled },
  });

  return NextResponse.json(
    {
      shareEnabled: updated.shareEnabled,
      hasPassword: Boolean(updated.sharePassword),
      shareSlug: updated.shareSlug,
    },
    { status: 200 }
  );
});
