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
import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { importRuns } from "@/db/schemas";
import { requireOwner } from "@/lib/security/roles";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  await requireOwner();
  const url = new URL(req.url);
  const limit = Math.min(50, Number(url.searchParams.get("limit") || 10));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  const rows = await db
    .select()
    .from(importRuns)
    .orderBy(desc(importRuns.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(importRuns);

  return NextResponse.json({ items: rows, total, limit, offset });
});

export const DELETE = withApiError(async function DELETE() {
  await requireOwner();
  await db.delete(importRuns);
  return NextResponse.json({ status: true });
});
