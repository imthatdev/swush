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
