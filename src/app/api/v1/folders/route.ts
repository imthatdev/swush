/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/client/user";
import { db } from "@/db/client";
import { files, folders } from "@/db/schemas/core-schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { count, sum } from "drizzle-orm/sql/functions";
import { audit } from "@/lib/api/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { normalizeHexColor } from "@/lib/tag-colors";
import { withApiError } from "@/lib/server/api-error";
import { getCached, setCached } from "@/lib/server/ttl-cache";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const cacheKey = `folders:v1:${user.id}`;
  const cached = getCached<unknown>(cacheKey) as
    | {
        id: string;
        name: string;
        color: string | null;
        shareEnabled: boolean;
        shareSlug: string | null;
        shareHasPassword: boolean;
        fileCount: number;
        totalSize: number;
      }[]
    | null;
  if (cached) {
    await audit({
      action: "folder.list",
      targetType: "folder",
      targetId: user.id,
      statusCode: 200,
      meta: { count: cached.length, cached: true },
    });
    return NextResponse.json(cached);
  }

  const rows = await db
    .select({
      id: folders.id,
      name: folders.name,
      color: folders.color,
      shareEnabled: folders.shareEnabled,
      shareSlug: folders.shareSlug,
      sharePassword: folders.sharePassword,
      fileCount: count(files.id).mapWith(Number),
      totalSize: sum(files.size).mapWith(Number),
    })
    .from(folders)
    .leftJoin(
      files,
      and(eq(files.folderId, folders.id), eq(files.userId, user.id))
    )
    .where(eq(folders.userId, user.id))
    .groupBy(folders.id, folders.name, folders.color)
    .orderBy(sql`lower(${folders.name})`);

  const [unfiled] = await db
    .select({
      fileCount: count(files.id).mapWith(Number),
      totalSize: sum(files.size).mapWith(Number),
    })
    .from(files)
    .where(and(eq(files.userId, user.id), isNull(files.folderId)));

  const result = [
    ...(unfiled && (unfiled.fileCount ?? 0) > 0
      ? [
          {
            id: "unfiled",
            name: "Unfiled",
            color: null,
            shareEnabled: false,
            shareSlug: null,
            shareHasPassword: false,
            fileCount: unfiled.fileCount || 0,
            totalSize: unfiled.totalSize || 0,
          },
        ]
      : []),
    ...rows.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color ?? null,
      shareEnabled: Boolean(r.shareEnabled),
      shareSlug: r.shareSlug ?? null,
      shareHasPassword: Boolean(r.sharePassword),
      fileCount: r.fileCount || 0,
      totalSize: r.totalSize || 0,
    })),
  ];

  await audit({
    action: "folder.list",
    targetType: "folder",
    targetId: user.id,
    statusCode: 200,
    meta: { count: result.length, unfiledCount: unfiled?.fileCount ?? 0 },
  });

  setCached(cacheKey, result, 15_000);
  return NextResponse.json(result);
});

export const POST = withApiError(async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const ipLimit = 10;
  const userLimit = 5;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `user:${user.id}:folder-create`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many folder create attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "folder.create",
      targetType: "folder",
      targetId: user.id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    await audit({
      action: "folder.create",
      targetType: "folder",
      targetId: user.id,
      statusCode: 400,
      meta: { reason: "missing-name" },
    });
    return NextResponse.json(
      { message: "Folder name is required" },
      { status: 400 }
    );
  }

  const name = body.name.trim();
  if (!name) {
    await audit({
      action: "folder.create",
      targetType: "folder",
      targetId: user.id,
      statusCode: 400,
      meta: { reason: "invalid-name" },
    });
    return NextResponse.json(
      { message: "Invalid folder name" },
      { status: 400 }
    );
  }

  const exists = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.userId, user.id), eq(folders.name, name)))
    .limit(1);

  if (exists.length > 0) {
    await audit({
      action: "folder.create",
      targetType: "folder",
      targetId: user.id,
      statusCode: 409,
      meta: { name },
    });
    return NextResponse.json(
      { message: "Folder already exists" },
      { status: 409 }
    );
  }

  const color =
    typeof body.color === "string" ? normalizeHexColor(body.color) : null;
  if (body.color && !color) {
    await audit({
      action: "folder.create",
      targetType: "folder",
      targetId: user.id,
      statusCode: 400,
      meta: { reason: "invalid-color" },
    });
    return NextResponse.json(
      { message: "Invalid folder color" },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(folders)
    .values({ userId: user.id, name, color })
    .returning();

  await audit({
    action: "folder.create",
    targetType: "folder",
    targetId: created.id,
    statusCode: 201,
    meta: { name },
  });

  return NextResponse.json(created, { status: 201 });
});

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
    key: `user:${user.id}:folder-update`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many folder update attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "folder.update",
      targetType: "folder",
      targetId: user.id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const body = await req.json().catch(() => null);
  const id = body?.id;
  const nameRaw = body?.name;
  const colorRaw = body?.color;

  if (!id || typeof id !== "string") {
    await audit({
      action: "folder.update",
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

  if (!nameRaw || typeof nameRaw !== "string") {
    await audit({
      action: "folder.update",
      targetType: "folder",
      targetId: String(id ?? ""),
      statusCode: 400,
      meta: { reason: "missing-name" },
    });
    return NextResponse.json(
      { message: "Folder name is required" },
      { status: 400 }
    );
  }

  const name = nameRaw.trim();
  if (!name) {
    await audit({
      action: "folder.update",
      targetType: "folder",
      targetId: id,
      statusCode: 400,
      meta: { reason: "invalid-name" },
    });
    return NextResponse.json(
      { message: "Invalid folder name" },
      { status: 400 }
    );
  }

  let color: string | null | undefined;
  if ("color" in body) {
    if (colorRaw == null || colorRaw === "") {
      color = null;
    } else if (typeof colorRaw === "string") {
      color = normalizeHexColor(colorRaw);
      if (!color) {
        await audit({
          action: "folder.update",
          targetType: "folder",
          targetId: id,
          statusCode: 400,
          meta: { reason: "invalid-color" },
        });
        return NextResponse.json(
          { message: "Invalid folder color" },
          { status: 400 }
        );
      }
    } else {
      await audit({
        action: "folder.update",
        targetType: "folder",
        targetId: id,
        statusCode: 400,
        meta: { reason: "invalid-color" },
      });
      return NextResponse.json(
        { message: "Invalid folder color" },
        { status: 400 }
      );
    }
  }

  const existingFolder = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)))
    .limit(1);

  if (existingFolder.length === 0) {
    await audit({
      action: "folder.update",
      targetType: "folder",
      targetId: id,
      statusCode: 404,
      meta: { reason: "not-found" },
    });
    return NextResponse.json({ message: "Folder not found" }, { status: 404 });
  }

  const nameClash = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.userId, user.id),
        eq(folders.name, name),
        sql`${folders.id} <> ${id}`
      )
    )
    .limit(1);

  if (nameClash.length > 0) {
    await audit({
      action: "folder.update",
      targetType: "folder",
      targetId: id,
      statusCode: 409,
      meta: { name },
    });
    return NextResponse.json(
      { message: "Another folder with this name already exists" },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(folders)
    .set({ name, ...(color !== undefined ? { color } : {}) })
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)))
    .returning();

  await audit({
    action: "folder.update",
    targetType: "folder",
    targetId: id,
    statusCode: 200,
    meta: { name },
  });

  return NextResponse.json(updated, { status: 200 });
});

export const DELETE = withApiError(async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `user:${user.id}:folder-delete`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many folder delete attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "folder.delete",
      targetType: "folder",
      targetId: user.id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const body = await req.json().catch(() => null);
  const id = body?.id;

  if (!id || typeof id !== "string") {
    await audit({
      action: "folder.delete",
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
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)))
    .limit(1);

  if (owned.length === 0) {
    await audit({
      action: "folder.delete",
      targetType: "folder",
      targetId: id,
      statusCode: 404,
      meta: { reason: "not-found" },
    });
    return NextResponse.json({ message: "Folder not found" }, { status: 404 });
  }

  await db
    .update(files)
    .set({ folderId: null })
    .where(and(eq(files.folderId, id), eq(files.userId, user.id)));

  await db
    .delete(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.id)));

  await audit({
    action: "folder.delete",
    targetType: "folder",
    targetId: id,
    statusCode: 200,
  });

  return NextResponse.json({ success: true });
});
