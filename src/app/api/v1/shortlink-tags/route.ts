/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { db } from "@/db/client";
import { shortLinks, shortLinkTags } from "@/db/schemas/core-schema";
import { and, eq, sql } from "drizzle-orm";
import { count } from "drizzle-orm/sql/functions";
import { audit } from "@/lib/api/audit";
import { normalizeHexColor } from "@/lib/tag-colors";
import { normalizeTagName } from "@/lib/tag-names";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "shortlinks");
  if (blocked) return blocked;

  const list = await db
    .select({
      id: shortLinkTags.id,
      name: shortLinkTags.name,
      color: shortLinkTags.color,
      shortlinkCount: count(shortLinks.id).mapWith(Number),
    })
    .from(shortLinkTags)
    .leftJoin(
      shortLinks,
      and(
        eq(shortLinks.userId, shortLinkTags.userId),
        sql`${shortLinks.tags} @> ${sql`ARRAY[${shortLinkTags.name}]`}`,
      ),
    )
    .where(eq(shortLinkTags.userId, user.id))
    .groupBy(shortLinkTags.id, shortLinkTags.name, shortLinkTags.color)
    .orderBy(shortLinkTags.name);

  await audit({
    action: "shortlink_tag.list",
    targetType: "shortlink_tag",
    targetId: user.id,
    statusCode: 200,
    meta: { count: list.length },
  });

  return NextResponse.json(list);
});

export const POST = withApiError(async function POST(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req);
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "shortlinks");
  if (blocked) return blocked;

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `u:${user.id}:shortlink-tag-create`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many tag create attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return NextResponse.json(
      { message: "Tag name is required" },
      { status: 400 },
    );
  }

  const name = normalizeTagName(body.name);
  if (!name) {
    return NextResponse.json({ message: "Invalid tag name" }, { status: 400 });
  }

  const exists = await db
    .select()
    .from(shortLinkTags)
    .where(and(eq(shortLinkTags.userId, user.id), eq(shortLinkTags.name, name)))
    .limit(1);
  if (exists.length > 0) {
    return NextResponse.json(
      { message: "Tag already exists" },
      { status: 409 },
    );
  }

  const color =
    typeof body.color === "string" ? normalizeHexColor(body.color) : null;
  if (body.color && !color) {
    return NextResponse.json({ message: "Invalid tag color" }, { status: 400 });
  }

  const [created] = await db
    .insert(shortLinkTags)
    .values({ userId: user.id, name, color })
    .returning();

  await audit({
    action: "shortlink_tag.create",
    targetType: "shortlink_tag",
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
  const blocked = await requireUserFeature(user.id, "shortlinks");
  if (blocked) return blocked;

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `u:${user.id}:shortlink-tag-update`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many tag update attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !body.id) {
    return NextResponse.json(
      { message: "Tag id is required" },
      { status: 400 },
    );
  }

  const id = body.id;
  const color =
    "color" in body
      ? body.color == null || body.color === ""
        ? null
        : typeof body.color === "string"
          ? normalizeHexColor(body.color)
          : null
      : undefined;

  if (body.color && color === null) {
    return NextResponse.json({ message: "Invalid tag color" }, { status: 400 });
  }

  const name =
    typeof body.name === "string" ? normalizeTagName(body.name) : undefined;
  if (typeof body.name === "string" && !name) {
    return NextResponse.json({ message: "Invalid tag name" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(shortLinkTags)
    .where(and(eq(shortLinkTags.id, id), eq(shortLinkTags.userId, user.id)))
    .limit(1);
  if (!existing) {
    return NextResponse.json({ message: "Tag not found" }, { status: 404 });
  }

  if (name) {
    const duplicate = await db
      .select()
      .from(shortLinkTags)
      .where(
        and(
          eq(shortLinkTags.userId, user.id),
          eq(shortLinkTags.name, name),
          sql`${shortLinkTags.id} <> ${id}`,
        ),
      )
      .limit(1);
    if (duplicate.length > 0) {
      return NextResponse.json(
        { message: "Tag already exists" },
        { status: 409 },
      );
    }
  }

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(shortLinkTags)
      .set({
        ...(name ? { name } : {}),
        ...(color !== undefined ? { color } : {}),
      })
      .where(and(eq(shortLinkTags.id, id), eq(shortLinkTags.userId, user.id)))
      .returning();

    if (name && name !== existing.name) {
      await tx.execute(sql`
        update ${shortLinks}
        set tags = array_replace(tags, ${existing.name}, ${name})
        where ${shortLinks.userId} = ${user.id}
          and ${shortLinks.tags} @> ${sql`ARRAY[${existing.name}]`}
      `);
    }

    return row;
  });

  await audit({
    action: "shortlink_tag.update",
    targetType: "shortlink_tag",
    targetId: updated.id,
    statusCode: 200,
    meta: { name: updated.name },
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiError(async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "shortlinks");
  if (blocked) return blocked;

  const ip = getClientIp(req);
  const ipLimit = 20;
  const userLimit = 10;
  const windowMs = 60_000;

  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const usrRL = await rateLimit({
    key: `u:${user.id}:shortlink-tag-delete`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !usrRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, usrRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many tag delete attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(Math.min(ipLimit, userLimit)));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || !body.id) {
    return NextResponse.json(
      { message: "Tag id is required" },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(shortLinkTags)
    .where(
      and(eq(shortLinkTags.id, body.id), eq(shortLinkTags.userId, user.id)),
    )
    .limit(1);
  if (!existing) {
    return NextResponse.json({ message: "Tag not found" }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    await tx.delete(shortLinkTags).where(eq(shortLinkTags.id, body.id));
    await tx.execute(sql`
      update ${shortLinks}
      set tags = array_remove(tags, ${existing.name})
      where ${shortLinks.userId} = ${user.id}
        and ${shortLinks.tags} @> ${sql`ARRAY[${existing.name}]`}
    `);
  });

  await audit({
    action: "shortlink_tag.delete",
    targetType: "shortlink_tag",
    targetId: existing.id,
    statusCode: 200,
    meta: { name: existing.name },
  });

  return NextResponse.json(existing);
});
