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
import { eq } from "drizzle-orm";
import { assertSafeExternalHttpUrl } from "@/lib/security/url";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(integrationWebhooks)
    .where(eq(integrationWebhooks.userId, user.id));

  return NextResponse.json({ webhooks: rows });
});

export const POST = withApiError(async function POST(req: NextRequest) {
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

  if (!body?.name?.trim() || !body?.url?.trim()) {
    return NextResponse.json(
      { message: "Name and URL are required" },
      { status: 400 },
    );
  }

  let safeUrl = "";
  try {
    safeUrl = assertSafeExternalHttpUrl(body.url);
  } catch {
    return NextResponse.json({ message: "Invalid URL" }, { status: 400 });
  }

  const events = Array.isArray(body.events)
    ? body.events.filter((e) => typeof e === "string" && e.trim())
    : ["file.uploaded"];

  const [row] = await db
    .insert(integrationWebhooks)
    .values({
      userId: user.id,
      name: body.name.trim(),
      url: safeUrl,
      secret: body.secret?.trim() || null,
      format: body.format === "discord" ? "discord" : "json",
      events,
      enabled: body.enabled !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ webhook: row }, { status: 201 });
});
