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

import { requireAdmin } from "@/lib/security/roles";
import { getCurrentUser } from "@/lib/client/user";
import {
  adminCreateInvite,
  adminDeleteInvite,
  adminListInvites,
} from "@/lib/server/admin/actions";

export async function adminFetchInvites() {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  return adminListInvites({ id: me.id, role: admin.role });
}

export async function adminCreateInviteAction(data: {
  durationHours: number;
  maxUses: number | null;
  note?: string;
}) {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  return adminCreateInvite({ id: me.id, role: admin.role }, data);
}

export async function adminDeleteInviteAction(id: number) {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  return adminDeleteInvite({ id: me.id, role: admin.role }, id);
}
