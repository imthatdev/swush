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

import "server-only";

import { db } from "@/db/client";
import { userInfo } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { getServerSettings } from "@/lib/settings";

export async function getSetupStatus() {
  const settings = await getServerSettings();
  const [owner] = await db
    .select({ userId: userInfo.userId })
    .from(userInfo)
    .where(eq(userInfo.role, "owner"))
    .limit(1);
  const hasOwner = Boolean(owner?.userId);
  const setupCompleted = Boolean(settings.setupCompleted || hasOwner);
  return {
    hasOwner,
    setupCompleted,
    needsSetup: !setupCompleted,
  };
}
