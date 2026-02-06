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

import { db } from "@/db/client";
import { files as filesTbl } from "@/db/schemas";
import { eq, sql } from "drizzle-orm";
import { handleFileMaxViews } from "@/lib/server/max-views";

export async function addViewBySlug(slug: string) {
  const file = await db
    .select()
    .from(filesTbl)
    .where(eq(filesTbl.slug, slug))
    .limit(1);

  if (!file.length)
    return { status: 404 as const, body: { message: "File not found" } };

  const updated = await db
    .update(filesTbl)
    .set({ views: sql`${filesTbl.views} + 1` })
    .where(eq(filesTbl.slug, slug))
    .returning();

  if (updated[0]) {
    await handleFileMaxViews(updated[0]);
  }

  return { status: 200 as const, body: updated[0] };
}
