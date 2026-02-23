/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { deviceAuth } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { normalizeUserCode } from "@/lib/auth/device-flow";
import { withApiError } from "@/lib/server/api-error";

type VerifyAction = "approve" | "deny";

export const POST = withApiError(async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  let payload: { user_code?: string; action?: VerifyAction } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const normalized = normalizeUserCode(payload.user_code || "");
  if (!normalized) {
    return NextResponse.json({ error: "Invalid user code" }, { status: 400 });
  }

  const [record] = await db
    .select()
    .from(deviceAuth)
    .where(eq(deviceAuth.userCode, normalized))
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Code not found" }, { status: 404 });
  }

  const expiresAt = record.expiresAt instanceof Date ? record.expiresAt : null;
  if (!expiresAt || expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Code expired" }, { status: 410 });
  }

  if (record.status === "consumed") {
    return NextResponse.json({ error: "Code already used" }, { status: 409 });
  }

  if (record.status === "denied") {
    return NextResponse.json({ error: "Code already denied" }, { status: 409 });
  }

  if (record.status === "approved") {
    return NextResponse.json({ status: "approved" });
  }

  const action: VerifyAction = payload.action === "deny" ? "deny" : "approve";
  const status = action === "deny" ? "denied" : "approved";

  await db
    .update(deviceAuth)
    .set({
      status,
      userId: session.user.id,
      updatedAt: new Date(),
    })
    .where(eq(deviceAuth.id, record.id));

  return NextResponse.json({ status });
});
