import "server-only";

import { db } from "@/db/client";
import { user as userTable, userInfo } from "@/db/schemas";
import { eq, sql } from "drizzle-orm";
import { getServerSettings } from "@/lib/settings";

const FIRST_OWNER_LOCK_KEY = 991_447_321;

export async function ensureFirstNonAnonymousUserIsOwner(input: {
  userId: string;
  isAnonymous?: boolean | null;
}) {
  const { userId, isAnonymous } = input;
  if (!userId) return false;
  if (isAnonymous) return false;
  const settings = await getServerSettings();
  if (!settings.setupCompleted) return false;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${FIRST_OWNER_LOCK_KEY})`);

    const [owner] = await tx
      .select({ userId: userInfo.userId })
      .from(userInfo)
      .where(eq(userInfo.role, "owner"))
      .limit(1);
    if (owner) return false;

    const [countRow] = await tx
      .select({ total: sql<number>`count(*)` })
      .from(userTable)
      .where(sql`coalesce(${userTable.isAnonymous}, false) = false`);

    if (Number(countRow?.total ?? 0) !== 1) return false;

    await tx
      .insert(userInfo)
      .values({ userId, role: "owner" })
      .onConflictDoUpdate({
        target: userInfo.userId,
        set: { role: "owner" },
      });

    return true;
  });
}
