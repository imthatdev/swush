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
import { user, userInfo } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { getSetupStatus } from "@/lib/server/setup";
import { updateServerSettings } from "@/lib/settings";
import { withApiError } from "@/lib/server/api-error";

export const POST = withApiError(async function POST(req: NextRequest) {
  const setup = await getSetupStatus();
  if (setup.setupCompleted || setup.hasOwner) {
    return NextResponse.json(
      { message: "Setup already completed" },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ message: "Missing userId" }, { status: 400 });
  }

  const [row] = await db
    .select({ id: user.id, isAnonymous: user.isAnonymous })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  if (!row) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }
  if (row.isAnonymous) {
    return NextResponse.json(
      { message: "Anonymous users cannot be owner" },
      { status: 400 },
    );
  }

  await db
    .insert(userInfo)
    .values({ userId, role: "owner" })
    .onConflictDoUpdate({
      target: userInfo.userId,
      set: { role: "owner" },
    });

  await updateServerSettings({ setupCompleted: true });

  return NextResponse.json({ ok: true });
});
