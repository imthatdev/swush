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

"use server";

import { db } from "@/db/client";
import { inviteTokens } from "@/db/schemas";
import { eq, sql } from "drizzle-orm";

export const checkInvitation = async (token: string) => {
  const [tokenAvailable] = await db
    .select()
    .from(inviteTokens)
    .where(eq(inviteTokens.token, token));

  if (!tokenAvailable) {
    return { valid: false, reason: "This token is not valid." };
  }

  if (tokenAvailable.expiresAt < new Date()) {
    return { valid: false, reason: "This token has expired." };
  }

  if (
    tokenAvailable.maxUses &&
    tokenAvailable.maxUses <= tokenAvailable.usesCount
  ) {
    return { valid: false, reason: "This token has reached its maximum uses." };
  }

  return { valid: true, reason: `This token is valid.` };
};

export const incrementInviteUsage = async (token: string) => {
  await db
    .update(inviteTokens)
    .set({
      usesCount: sql`${inviteTokens.usesCount} + 1`,
    })
    .where(eq(inviteTokens.token, token));
};
