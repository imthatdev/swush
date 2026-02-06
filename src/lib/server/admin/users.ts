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

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/security/roles";
import { getCurrentUser } from "@/lib/client/user";
import type { AdminUser } from "@/types/admin";
import { db } from "@/db/client";
import { user as userTable, userInfo } from "@/db/schemas";
import { eq } from "drizzle-orm";
import {
  adminClearUserData,
  adminDeleteUser,
  adminGetUsersList,
  adminUpdateUser,
} from "@/lib/server/admin/actions";

type UserCreateData = {
  email: string;
  name: string;
  username: string;
  password: string;
  role?: "user" | "admin";
};

export type AdminListUsersOptions = {
  searchValue?: string;
  searchField?: "name" | "email" | "username" | "role" | "all";
  searchOperator?: "contains" | "starts_with" | "ends_with" | undefined;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "createdAt" | "lastLoginAt";
  sortDirection?: "asc" | "desc";
};

export type AdminListUsersResult = {
  users: AdminUser[];
  total: number;
  limit?: number;
  offset?: number;
};

const coerceRole = (role: unknown): "owner" | "admin" | "user" =>
  role === "owner" || role === "admin" || role === "user" ? role : "user";

function nameOf(u: AdminUser) {
  return (u.displayName || u.username || u.email || "").toLowerCase();
}

function dateNum(iso: string | null | undefined) {
  if (!iso) return Number.NaN;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NaN : t;
}

function matchesSearch(
  u: AdminUser,
  q: string,
  field: AdminListUsersOptions["searchField"]
) {
  const email = u.email.toLowerCase();
  const username = (u.username ?? "").toLowerCase();
  const displayName = (u.displayName ?? "").toLowerCase();
  const role = (u.role ?? "").toLowerCase();
  const haystack = `${email} ${username} ${displayName} ${role}`;

  switch (field) {
    case "email":
      return email.includes(q);
    case "name":
      return nameOf(u).includes(q);
    case "username":
      return username.includes(q);
    case "role":
      return role.includes(q);
    default:
      return haystack.includes(q);
  }
}

function applySearch(
  list: AdminUser[],
  opts: AdminListUsersOptions
): AdminUser[] {
  const q = opts.searchValue?.trim().toLowerCase();
  if (!q) return list;
  return list.filter((u) => matchesSearch(u, q, opts.searchField));
}

function applySort(
  list: AdminUser[],
  opts: AdminListUsersOptions
): AdminUser[] {
  const dir = opts.sortDirection === "asc" ? 1 : -1;
  const key = opts.sortBy ?? "createdAt";
  const arr = [...list];

  arr.sort((a, b) => {
    let cmp = 0;
    if (key === "name") {
      const an = nameOf(a);
      const bn = nameOf(b);
      cmp = an < bn ? -1 : an > bn ? 1 : 0;
    } else if (key === "lastLoginAt") {
      const at = dateNum(a.lastLoginAt);
      const bt = dateNum(b.lastLoginAt);
      if (Number.isNaN(at) && Number.isNaN(bt)) cmp = 0;
      else if (Number.isNaN(at)) cmp = 1;
      else if (Number.isNaN(bt)) cmp = -1;
      else cmp = at - bt;
    } else {
      const at = dateNum(a.createdAt);
      const bt = dateNum(b.createdAt);
      if (Number.isNaN(at) && Number.isNaN(bt)) cmp = 0;
      else if (Number.isNaN(at)) cmp = 1;
      else if (Number.isNaN(bt)) cmp = -1;
      else cmp = at - bt;
    }
    return cmp * dir;
  });

  return arr;
}

export const adminCreateUser = async ({ user }: { user: UserCreateData }) => {
  await requireAdmin();
  try {
    await auth.api.signUpEmail({
      body: {
        name: user.name,
        email: user.email,
        password: user.password,
        username: user.username,
        rememberMe: false,
      },
      headers: await headers(),
    });

    const [row] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, user.email))
      .limit(1);

    if (row?.id) {
      await db
        .insert(userInfo)
        .values({ userId: row.id, role: user.role ?? "user" })
        .onConflictDoNothing();
    }

    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to create user",
    };
  }
};

export const adminListUsers = async ({
  query,
}: {
  query: AdminListUsersOptions;
}): Promise<AdminListUsersResult> => {
  await requireAdmin();
  const all = await adminGetUsersList();
  const searched = applySearch(all, query);
  const sorted = applySort(searched, query);
  const total = sorted.length;
  const offset = query.offset ?? 0;
  const limit = query.limit ?? total;
  const users = sorted.slice(offset, offset + limit);
  return { users, total, limit, offset };
};

export const adminSetRole = async ({
  userId,
  role,
}: {
  userId: string;
  role: "owner" | "admin" | "user";
}) => {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  const safeRole = coerceRole(admin.role);
  const result = await adminUpdateUser(
    userId,
    { role },
    {
      id: me.id,
      role: safeRole,
    }
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error:
        typeof result.error === "string"
          ? result.error
          : "Failed to update role",
    };
  }
  return { ok: true as const };
};

export const adminBanUser = async ({
  userId,
  reason,
}: {
  userId: string;
  reason?: string;
}) => {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  const result = await adminUpdateUser(
    userId,
    { lock: true, reason },
    { id: me.id, role: coerceRole(admin.role) }
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error:
        typeof result.error === "string" ? result.error : "Failed to ban user",
    };
  }
  return { ok: true as const };
};

export const adminUnbanUser = async ({ userId }: { userId: string }) => {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  const result = await adminUpdateUser(
    userId,
    { lock: false },
    { id: me.id, role: coerceRole(admin.role) }
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error:
        typeof result.error === "string"
          ? result.error
          : "Failed to unban user",
    };
  }
  return { ok: true as const };
};

export const adminRemoveUser = async ({ userId }: { userId: string }) => {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  const result = await adminDeleteUser(userId, {
    id: me.id,
    role: coerceRole(admin.role),
  });
  if (!result.ok) {
    return {
      ok: false as const,
      error:
        typeof result.error === "string"
          ? result.error
          : "Failed to delete user",
    };
  }
  return { ok: true as const };
};

export const adminUpdateUserLimits = async ({
  userId,
  data,
}: {
  userId: string;
  data: Record<string, unknown>;
}) => {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  const safeRole = coerceRole(admin.role);
  const result = await adminUpdateUser(userId, data, {
    id: me.id,
    role: safeRole,
  });
  return result;
};

export const adminDisableUser2FA = async ({ userId }: { userId: string }) => {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  const safeRole = coerceRole(admin.role);
  return adminUpdateUser(
    userId,
    { disable2FA: true },
    { id: me.id, role: safeRole }
  );
};

export const adminClearUser = async ({
  userId,
  options,
}: {
  userId: string;
  options: Record<string, unknown>;
}) => {
  const admin = await requireAdmin();
  const me = await getCurrentUser();
  if (!me) return { ok: false as const, error: "Forbidden" };
  const safeRole = coerceRole(admin.role);
  return adminClearUserData({ id: me.id, role: safeRole }, userId, options);
};
