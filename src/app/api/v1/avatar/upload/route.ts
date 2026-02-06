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
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { user as userTable } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import {
  deleteFileFromStorage,
  getDefaultStorageDriver,
  putFileToStorage,
} from "@/lib/storage";
import { getClientIp } from "@/lib/security/ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { withApiError } from "@/lib/server/api-error";
import {
  AVATAR_STORAGE_NAMESPACE,
  DEFAULT_AVATAR_PATH,
  avatarApiPath,
  avatarFileApiPath,
  avatarStoredName,
  isSafeAvatarFileName,
  legacyAvatarStoredName,
} from "@/lib/avatar";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
const AVATAR_SIZE = 256;

function isAllowedMime(mime: string) {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}

export const POST = withApiError(async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const windowMs = 60_000;
  const ipLimit = 20;

  const ipRL = await rateLimit({
    key: `ip:${ip}:avatar-upload`,
    limit: ipLimit,
    windowMs,
  });

  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many avatar uploads. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["avatar"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") ?? form.get("avatar");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No file provided" }, { status: 400 });
  }
  if (typeof file.size === "number" && file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { message: "Avatar is too large (max 10MB)" },
      { status: 413 },
    );
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());
  const sig = await fileTypeFromBuffer(inputBuf);
  const effectiveMime = sig?.mime || file.type || "application/octet-stream";

  if (!isAllowedMime(effectiveMime)) {
    return NextResponse.json(
      { message: `Unsupported avatar type (${effectiveMime})` },
      { status: 400 },
    );
  }

  const outBuf = await sharp(inputBuf)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const oldFileToDelete = (() => {
    const img = user?.image;
    if (typeof img !== "string" || !img.trim()) return null;
    try {
      const u = new URL(img, req.nextUrl.origin);
      const parts = u.pathname.split("/").filter(Boolean);
      if (
        parts.length === 5 &&
        parts[0] === "api" &&
        parts[1] === "v1" &&
        parts[2] === "avatar" &&
        parts[3] === user.id
      ) {
        const file = parts[4] ?? "";
        return isSafeAvatarFileName(file) ? file : null;
      }
    } catch {
      return null;
    }
    return null;
  })();

  const fileName = `${Date.now()}-${nanoid(10)}.png`;
  const target = {
    userId: AVATAR_STORAGE_NAMESPACE,
    storedName: avatarStoredName(user.id, fileName),
  };
  const driver = await getDefaultStorageDriver();

  await putFileToStorage({
    target,
    buffer: outBuf,
    contentType: "image/png",
    cacheControl: "public, max-age=31536000, immutable",
    driver,
  });

  const imageUrl = avatarFileApiPath(user.id, fileName);

  await Promise.allSettled([
    oldFileToDelete
      ? deleteFileFromStorage(
          {
            userId: AVATAR_STORAGE_NAMESPACE,
            storedName: avatarStoredName(user.id, oldFileToDelete),
          },
          { driver },
        )
      : Promise.resolve(),
    deleteFileFromStorage(
      {
        userId: AVATAR_STORAGE_NAMESPACE,
        storedName: legacyAvatarStoredName(user.id),
      },
      { driver },
    ),
  ]);

  const now = new Date();
  await db
    .update(userTable)
    .set({ image: imageUrl, updatedAt: now })
    .where(eq(userTable.id, user.id));

  const res = NextResponse.json(
    { url: imageUrl, defaultUrl: DEFAULT_AVATAR_PATH },
    { status: 200 },
  );
  res.headers.set("RateLimit-Limit", String(ipLimit));
  res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return res;
});

export const DELETE = withApiError(async function DELETE(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["avatar"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const oldFileToDelete = (() => {
    const img = user?.image;
    if (typeof img !== "string" || !img.trim()) return null;
    try {
      const u = new URL(img, req.nextUrl.origin);
      const parts = u.pathname.split("/").filter(Boolean);
      if (
        parts.length === 5 &&
        parts[0] === "api" &&
        parts[1] === "v1" &&
        parts[2] === "avatar" &&
        parts[3] === user.id
      ) {
        const file = parts[4] ?? "";
        return isSafeAvatarFileName(file) ? file : null;
      }
    } catch {
      return null;
    }
    return null;
  })();

  const imageUrl = avatarApiPath(user.id);
  const target = {
    userId: AVATAR_STORAGE_NAMESPACE,
    storedName: legacyAvatarStoredName(user.id),
  };
  const driver = await getDefaultStorageDriver();

  await Promise.allSettled([
    deleteFileFromStorage(target, { driver }),
    oldFileToDelete
      ? deleteFileFromStorage(
          {
            userId: AVATAR_STORAGE_NAMESPACE,
            storedName: avatarStoredName(user.id, oldFileToDelete),
          },
          { driver },
        )
      : Promise.resolve(),
  ]);
  await db
    .update(userTable)
    .set({ image: imageUrl, updatedAt: new Date() })
    .where(eq(userTable.id, user.id));

  return NextResponse.json({
    ok: true,
    url: imageUrl,
    defaultUrl: DEFAULT_AVATAR_PATH,
  });
});
