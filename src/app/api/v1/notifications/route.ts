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
import { db } from "@/db/client";
import { notifications } from "@/db/schemas";
import { auth } from "@/lib/auth";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(25, Number(url.searchParams.get("limit")) || 8);

  const items = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      message: notifications.message,
      type: notifications.type,
      data: notifications.data,
      createdAt: notifications.createdAt,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, session.user.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  const [{ unread = 0 } = {}] = await db
    .select({ unread: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt)
      )
    );

  return NextResponse.json({ items, unread });
});

export const PATCH = withApiError(async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : null;
  const markAll = Boolean(body?.markAll);

  const where = markAll
    ? and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt)
      )
    : ids && ids.length > 0
    ? and(
        eq(notifications.userId, session.user.id),
        inArray(notifications.id, ids)
      )
    : null;

  if (!where) {
    return NextResponse.json({ status: false, updated: 0 });
  }

  const result = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(where);

  return NextResponse.json({ status: true, updated: result.rowCount ?? 0 });
});

export const DELETE = withApiError(async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await db
    .delete(notifications)
    .where(eq(notifications.userId, session.user.id));

  return NextResponse.json({ status: true, deleted: result.rowCount ?? 0 });
});
