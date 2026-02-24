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

import type { AdminUser } from "@/types/admin";
import type { AdminMetrics } from "@/types/admin-metrics";
import type { AdminJobRun, AdminJobName } from "@/types/admin-jobs";
import { apiV1 } from "@/lib/api-path";
import { getApiErrorMessage, readApiError } from "@/lib/client/api-error";
import { fetchSafeInternalApi } from "@/lib/security/http-client";

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

export type AdminSettingsPayload = {
  maxUploadMb: number;
  maxFilesPerUpload: number;
  allowPublicRegistration: boolean;
  passwordPolicyMinLength: number;
  sponsorBannerEnabled: boolean;
  userDailyQuotaMb: number;
  adminDailyQuotaMb: number;
  userMaxStorageMb: number;
  adminMaxStorageMb: number;
  filesLimitUser: number | null;
  filesLimitAdmin: number | null;
  shortLinksLimitUser: number | null;
  shortLinksLimitAdmin: number | null;
  allowedMimePrefixes: string[] | null;
  disallowedExtensions: string[] | null;
  preservedUsernames: string[] | null;
};

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function readErrorMessage(res: Response, fallback: string) {
  const err = await readApiError(res, fallback);
  return err.message || fallback;
}

export async function adminListUsers({
  query,
}: {
  query: AdminListUsersOptions;
}): Promise<AdminListUsersResult> {
  const params = new URLSearchParams();
  if (query.searchValue) params.set("searchValue", query.searchValue);
  if (query.searchField) params.set("searchField", query.searchField);
  if (query.searchOperator) params.set("searchOperator", query.searchOperator);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDirection) params.set("sortDirection", query.sortDirection);

  const res = await fetch(apiV1(`/admin/users?${params.toString()}`));
  if (!res.ok) throw await readApiError(res, "Failed to load users");
  const data = await readJson<AdminListUsersResult>(res);
  if (!data) throw new Error("Failed to load users");
  return data;
}

export async function adminGetMetrics(): Promise<AdminMetrics> {
  const res = await fetch(apiV1("/admin/metrics"), { cache: "no-store" });
  if (!res.ok) throw await readApiError(res, "Failed to load metrics");
  const data = await readJson<AdminMetrics>(res);
  if (!data) throw new Error("Failed to load metrics");
  return data;
}

export async function adminCreateUser({
  user,
}: {
  user: {
    email: string;
    name: string;
    username: string;
    password: string;
    role?: "user" | "admin";
  };
}) {
  const res = await fetch(apiV1("/admin/users"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user }),
  });
  const data = await readJson<{
    ok?: boolean;
    message?: string;
    error?: string;
  }>(res);
  if (!res.ok || data?.ok === false) {
    return {
      ok: false as const,
      error: getApiErrorMessage(data, "Failed to create user"),
    };
  }
  return { ok: true as const };
}

export async function adminSetRole({
  userId,
  role,
}: {
  userId: string;
  role: "owner" | "admin" | "user";
}) {
  return adminPatchUser(userId, { role });
}

export async function adminSetVerified({
  userId,
  verified,
}: {
  userId: string;
  verified: boolean;
}) {
  return adminPatchUser(userId, { verified });
}

export async function adminBanUser({
  userId,
  reason,
}: {
  userId: string;
  reason?: string;
}) {
  return adminPatchUser(userId, { lock: true, reason });
}

export async function adminUnbanUser({ userId }: { userId: string }) {
  return adminPatchUser(userId, { lock: false });
}

export async function adminRemoveUser({ userId }: { userId: string }) {
  const res = await fetch(apiV1(`/admin/users/${userId}`), {
    method: "DELETE",
  });
  if (!res.ok) {
    return {
      ok: false as const,
      error: await readErrorMessage(res, "Failed to delete user"),
    };
  }
  return { ok: true as const };
}

export async function adminUpdateUserLimits({
  userId,
  data,
}: {
  userId: string;
  data: Record<string, unknown>;
}) {
  return adminPatchUser(userId, data);
}

export async function adminDisableUser2FA({ userId }: { userId: string }) {
  return adminPatchUser(userId, { disable2FA: true });
}

export async function adminClearUser({
  userId,
  options,
}: {
  userId: string;
  options: Record<string, unknown>;
}) {
  const res = await fetchSafeInternalApi(apiV1(`/admin/users/${userId}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "clear", options }),
  });
  const data = await readJson<{
    ok?: boolean;
    message?: string;
    error?: string;
  }>(res);
  if (!res.ok || data?.ok === false) {
    return {
      ok: false as const,
      error: getApiErrorMessage(data, "Failed to clear data"),
    };
  }
  return { ok: true as const };
}

async function adminPatchUser(userId: string, body: Record<string, unknown>) {
  const res = await fetchSafeInternalApi(apiV1(`/admin/users/${userId}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<{
    ok?: boolean;
    message?: string;
    error?: string;
  }>(res);
  if (!res.ok || data?.ok === false) {
    return {
      ok: false as const,
      error: getApiErrorMessage(data, "Failed to update user"),
    };
  }
  return { ok: true as const };
}

export async function adminUpdateSettings(payload: AdminSettingsPayload) {
  const res = await fetch(apiV1("/admin/settings"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await readJson<{ error?: string; message?: string }>(res);
    return {
      ok: false as const,
      error: getApiErrorMessage(data, "Failed to save settings"),
    };
  }
  return { ok: true as const };
}

export async function adminListJobRuns({
  limit = 10,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}): Promise<{
  items: AdminJobRun[];
  total: number;
  limit: number;
  offset: number;
}> {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const res = await fetch(apiV1(`/admin/jobs?${params.toString()}`), {
    cache: "no-store",
  });
  if (!res.ok) throw await readApiError(res, "Failed to load job runs");
  const data = await readJson<{
    items: AdminJobRun[];
    total: number;
    limit: number;
    offset: number;
  }>(res);
  if (!data) throw new Error("Failed to load job runs");
  return data;
}

export async function adminRunJob({
  job,
  limit,
}: {
  job: AdminJobName;
  limit?: number;
}) {
  const res = await fetch(apiV1("/admin/jobs"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job, limit }),
  });
  const data = await readJson<{
    status?: boolean;
    error?: string;
    run?: AdminJobRun;
  }>(res);
  if (!res.ok || data?.status === false) {
    return {
      ok: false as const,
      error: getApiErrorMessage(data, "Failed to run job"),
    };
  }
  return { ok: true as const, run: data?.run ?? null };
}

export async function adminClearJobRuns() {
  const res = await fetch(apiV1("/admin/jobs"), { method: "DELETE" });
  const data = await readJson<{ status?: boolean; error?: string }>(res);
  if (!res.ok || data?.status === false) {
    return {
      ok: false as const,
      error: getApiErrorMessage(data, "Failed to clear job runs"),
    };
  }
  return { ok: true as const };
}

export async function adminListImportRuns({
  limit = 10,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const res = await fetch(apiV1(`/admin/import-runs?${params.toString()}`), {
    cache: "no-store",
  });
  if (!res.ok) throw await readApiError(res, "Failed to load import runs");
  const data = await readJson<{
    items: [];
    total: number;
    limit: number;
    offset: number;
  }>(res);
  if (!data) throw new Error("Failed to load import runs");
  return data;
}

export async function adminClearImportRuns() {
  const res = await fetch(apiV1(`/admin/import-runs`), { method: "DELETE" });
  const data = await readJson<{ status?: boolean; error?: string }>(res);
  if (!res.ok || data?.status === false) {
    return {
      ok: false as const,
      error: getApiErrorMessage(data, "Failed to clear import runs"),
    };
  }
  return { ok: true as const };
}
