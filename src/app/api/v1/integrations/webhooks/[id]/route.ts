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
import { integrationWebhooks } from "@/db/schemas/core-schema";
import { getCurrentUser } from "@/lib/client/user";
import { withApiError } from "@/lib/server/api-error";
import { and, eq } from "drizzle-orm";

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    url?: string;
    events?: string[];
    secret?: string | null;
    format?: "json" | "discord";
    enabled?: boolean;
  } | null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body?.name === "string") updates.name = body.name.trim();
  if (typeof body?.url === "string") {
    try {
      new URL(body.url);
      updates.url = body.url.trim();
    } catch {
      return NextResponse.json({ message: "Invalid URL" }, { status: 400 });
    }
  }
  if (Array.isArray(body?.events)) {
    updates.events = body.events.filter((e) => typeof e === "string" && e);
  }
  if (typeof body?.secret === "string") updates.secret = body.secret.trim();
  if (body?.secret === null) updates.secret = null;
  if (body?.format === "discord") updates.format = "discord";
  if (body?.format === "json") updates.format = "json";
  if (typeof body?.enabled === "boolean") updates.enabled = body.enabled;

  const [row] = await db
    .update(integrationWebhooks)
    .set(updates)
    .where(
      and(
        eq(integrationWebhooks.id, id),
        eq(integrationWebhooks.userId, user.id),
      ),
    )
    .returning();

  if (!row) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ webhook: row });
});

export const DELETE = withApiError(async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [row] = await db
    .delete(integrationWebhooks)
    .where(
      and(
        eq(integrationWebhooks.id, id),
        eq(integrationWebhooks.userId, user.id),
      ),
    )
    .returning();

  if (!row) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
});
