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
import { files, tags, filesToTags } from "@/db/schemas/core-schema";
import { and, eq, sql } from "drizzle-orm";
import { count, sum } from "drizzle-orm/sql/functions";
import { audit } from "@/lib/api/audit";
import { normalizeHexColor } from "@/lib/tag-colors";
import { normalizeTagName } from "@/lib/tag-names";

import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { withApiError } from "@/lib/server/api-error";
import { getCached, setCached } from "@/lib/server/ttl-cache";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const cacheKey = `tags:v1:${user.id}`;
  const cached = getCached<unknown>(cacheKey) as
    | {
        id: string;
        name: string;
        color: string | null;
        fileCount: number;
        totalSize: number;
      }[]
    | null;
  if (cached) {
    await audit({
      action: "tag.list",
      targetType: "tag",
      targetId: user.id,
      statusCode: 200,
      meta: { count: cached.length, cached: true },
    });
    return NextResponse.json(cached);
  }

  const list = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      fileCount: count(files.id).mapWith(Number),
      totalSize: sum(files.size).mapWith(Number),
    })
    .from(tags)
    .leftJoin(filesToTags, eq(filesToTags.tagId, tags.id))
    .leftJoin(
      files,
      and(eq(files.id, filesToTags.fileId), eq(files.userId, user.id))
    )
    .where(eq(tags.userId, user.id))
    .groupBy(tags.id, tags.name, tags.color)
    .orderBy(tags.name);

  await audit({
    action: "tag.list",
    targetType: "tag",
    targetId: user.id,
    statusCode: 200,
    meta: { count: list.length },
  });

  setCached(cacheKey, list, 15_000);
  const getRes = NextResponse.json(list);
  return getRes;
});

export const POST = withApiError(async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `u:${user.id}:tag-create`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many tag create attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "tag.create",
      targetType: "tag",
      targetId: user.id,
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    await audit({
      action: "tag.create",
      targetType: "tag",
      targetId: user.id,
      statusCode: 400,
      meta: { reason: "missing-or-invalid-name" },
    });
    return NextResponse.json(
      { message: "Tag name is required" },
      { status: 400 }
    );
  }

  const name = normalizeTagName(body.name);
  if (!name) {
    await audit({
      action: "tag.create",
      targetType: "tag",
      targetId: user.id,
      statusCode: 400,
      meta: { reason: "empty-name" },
    });
    return NextResponse.json({ message: "Invalid tag name" }, { status: 400 });
  }

  const exists = await db
    .select()
    .from(tags)
    .where(and(eq(tags.userId, user.id), eq(tags.name, name)))
    .limit(1);

  if (exists.length > 0) {
    await audit({
      action: "tag.create",
      targetType: "tag",
      targetId: user.id,
      statusCode: 409,
      meta: { name },
    });
    return NextResponse.json(
      { message: "Tag already exists" },
      { status: 409 }
    );
  }

  const color =
    typeof body.color === "string" ? normalizeHexColor(body.color) : null;
  if (body.color && !color) {
    await audit({
      action: "tag.create",
      targetType: "tag",
      targetId: user.id,
      statusCode: 400,
      meta: { reason: "invalid-color" },
    });
    return NextResponse.json(
      { message: "Invalid tag color" },
      { status: 400 }
    );
  }

  const [created] = await db
    .insert(tags)
    .values({
      userId: user.id,
      name,
      color,
    })
    .returning();

  await audit({
    action: "tag.create",
    targetType: "tag",
    targetId: created.id,
    statusCode: 201,
    meta: { name },
  });

  const postRes = NextResponse.json(created, { status: 201 });
  postRes.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
  postRes.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return postRes;
});

export const PATCH = withApiError(async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `u:${user.id}:tag-update`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many tag update attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "tag.update",
      targetType: "tag",
      targetId: String(user.id),
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });
    return res;
  }

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.id !== "string" ||
    !body.id ||
    typeof body.name !== "string" ||
    !body.name.trim()
  ) {
    await audit({
      action: "tag.update",
      targetType: "tag",
      targetId: String(body?.id ?? ""),
      statusCode: 400,
      meta: { reason: "missing-id-or-name" },
    });
    return NextResponse.json(
      { message: "Tag id and name are required" },
      { status: 400 }
    );
  }

  const id = body.id;
  const name = normalizeTagName(body.name);
  let color: string | null | undefined;
  if ("color" in body) {
    if (body.color == null || body.color === "") {
      color = null;
    } else if (typeof body.color === "string") {
      color = normalizeHexColor(body.color);
      if (!color) {
        await audit({
          action: "tag.update",
          targetType: "tag",
          targetId: body.id,
          statusCode: 400,
          meta: { reason: "invalid-color" },
        });
        return NextResponse.json(
          { message: "Invalid tag color" },
          { status: 400 }
        );
      }
    } else {
      await audit({
        action: "tag.update",
        targetType: "tag",
        targetId: body.id,
        statusCode: 400,
        meta: { reason: "invalid-color" },
      });
      return NextResponse.json(
        { message: "Invalid tag color" },
        { status: 400 }
      );
    }
  }

  const duplicate = await db
    .select()
    .from(tags)
    .where(
      and(
        eq(tags.userId, user.id),
        eq(tags.name, name),
        sql`${tags.id} <> ${id}`
      )
    )
    .limit(1);

  if (duplicate.length > 0) {
    await audit({
      action: "tag.update",
      targetType: "tag",
      targetId: body.id,
      statusCode: 409,
      meta: { name },
    });
    return NextResponse.json(
      { message: "Tag already exists" },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(tags)
    .set({ name, ...(color !== undefined ? { color } : {}) })
    .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
    .returning();

  if (!updated) {
    await audit({
      action: "tag.update",
      targetType: "tag",
      targetId: id,
      statusCode: 404,
    });
    return NextResponse.json({ message: "Tag not found" }, { status: 404 });
  }

  await audit({
    action: "tag.update",
    targetType: "tag",
    targetId: updated.id,
    statusCode: 200,
    meta: { name },
  });

  const patchRes = NextResponse.json(updated);
  patchRes.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
  patchRes.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return patchRes;
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
    key: `u:${user.id}:tag-delete`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many tag delete attempts. Try again in ${retry}s` },
      { status: 429 }
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await audit({
      action: "tag.delete",
      targetType: "tag",
      targetId: String(user.id),
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !body.id) {
    await audit({
      action: "tag.delete",
      targetType: "tag",
      targetId: String(body?.id ?? ""),
      statusCode: 400,
      meta: { reason: "missing-id" },
    });
    return NextResponse.json(
      { message: "Tag id is required" },
      { status: 400 }
    );
  }

  const id = body.id;

  await db.delete(filesToTags).where(eq(filesToTags.tagId, id));

  const [deleted] = await db
    .delete(tags)
    .where(and(eq(tags.id, id), eq(tags.userId, user.id)))
    .returning();

  if (!deleted) {
    await audit({
      action: "tag.delete",
      targetType: "tag",
      targetId: id,
      statusCode: 404,
    });
    return NextResponse.json({ message: "Tag not found" }, { status: 404 });
  }

  await audit({
    action: "tag.delete",
    targetType: "tag",
    targetId: deleted.id,
    statusCode: 200,
    meta: { name: deleted.name },
  });

  const delRes = NextResponse.json(deleted);
  delRes.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
  delRes.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return delRes;
});
