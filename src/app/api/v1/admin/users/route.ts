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
import { requireAdmin } from "@/lib/security/roles";
import {
  adminCreateUser,
  adminListUsers,
  type AdminListUsersOptions,
} from "@/lib/server/admin/users";
import { audit } from "@/lib/api/audit";
import { withApiError } from "@/lib/server/api-error";

function parseQuery(req: NextRequest): AdminListUsersOptions {
  const params = req.nextUrl.searchParams;
  const searchValue = params.get("searchValue") ?? undefined;
  const searchField = params.get("searchField") as
    | AdminListUsersOptions["searchField"]
    | null;
  const searchOperator = params.get("searchOperator") as
    | AdminListUsersOptions["searchOperator"]
    | null;
  const sortBy = params.get("sortBy") as AdminListUsersOptions["sortBy"] | null;
  const sortDirection = params.get("sortDirection") as
    | AdminListUsersOptions["sortDirection"]
    | null;

  const limitRaw = params.get("limit");
  const offsetRaw = params.get("offset");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const offset = offsetRaw ? Number(offsetRaw) : undefined;

  return {
    searchValue,
    searchField: searchField ?? undefined,
    searchOperator: searchOperator ?? undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
    sortBy: sortBy ?? undefined,
    sortDirection: sortDirection ?? undefined,
  };
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const query = parseQuery(req);
  const result = await adminListUsers({ query });
  await audit({
    action: "user.list",
    targetType: "user",
    targetId: "all",
    statusCode: 200,
    meta: { query },
  });
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
});

export const POST = withApiError(async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  let json: Record<string, unknown>;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const user = (json?.user ?? json) as {
    email?: string;
    name?: string;
    username?: string;
    password?: string;
    role?: "user" | "admin";
  };

  if (!user?.email || !user?.username || !user?.password) {
    return NextResponse.json(
      { message: "Email, username, and password are required" },
      { status: 400 }
    );
  }

  const result = await adminCreateUser({
    user: {
      email: user.email,
      name: user.name ?? user.username,
      username: user.username,
      password: user.password,
      role: user.role,
    },
  });

  await audit({
    action: "user.create",
    targetType: "user",
    targetId: user.email,
    statusCode: result.ok ? 200 : 400,
    meta: { role: user.role ?? "user" },
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: result.error ?? "Failed to create user" },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
});
