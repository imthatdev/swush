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
import { getCurrentUser } from "@/lib/client/user";
import {
  adminClearUserData,
  adminDeleteUser,
  adminGetUser,
  adminUpdateUser,
} from "@/lib/server/admin/actions";
import { audit } from "@/lib/api/audit";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id)
    return NextResponse.json({ message: "Missing user id" }, { status: 400 });

  const targetUser = await adminGetUser(id);
  if (!targetUser) {
    await audit({
      action: "user.read",
      targetType: "user",
      targetId: id,
      statusCode: 404,
      meta: { reason: "not-found" },
    });
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }
  await audit({
    action: "user.read",
    targetType: "user",
    targetId: id,
    statusCode: 200,
  });
  return NextResponse.json({ ok: true, user: targetUser });
});

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser();
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  let json: Record<string, unknown>;

  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const updated = await adminUpdateUser(id, json, {
    id: me?.id ?? "",
    role: admin.role ?? "user",
  });

  await audit({
    action: "user.update",
    targetType: "user",
    targetId: id,
    statusCode: updated.ok ? 200 : 400,
    meta: {
      username: null,
      updatedFields: Array.isArray(json) ? [] : Object.keys(json ?? {}),
      error: updated.ok ? null : updated.error ?? null,
    },
  });

  if (!updated.ok)
    return NextResponse.json({ message: updated.error }, { status: 400 });

  return NextResponse.json(
    { ok: true, user: updated.user ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withApiError(async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ message: "Missing id" }, { status: 400 });

  let json: Record<string, unknown> = {};
  try {
    json = await req.json();
  } catch {}

  if (json?.type !== "clear") {
    return NextResponse.json(
      { message: "Unsupported action" },
      { status: 400 }
    );
  }

  const result = await adminClearUserData(
    { id: admin.id, role: admin.role ?? "user" },
    id,
    json?.options ?? {}
  );

  await audit({
    action: "user.clearData",
    targetType: "user",
    targetId: id,
    statusCode: result.ok ? 200 : 400,
    meta: {
      username: admin?.username ?? null,
      options: json?.options ?? null,
      error: result.ok ? null : result.error ?? null,
    },
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, message: result.error },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
});

export const DELETE = withApiError(async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin)
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await adminDeleteUser(id, {
    id: me.id,
    role: admin.role ?? "user",
  });

  await audit({
    action: "user.delete",
    targetType: "user",
    targetId: id,
    statusCode: result.ok ? 200 : 400,
    meta: {
      username: me?.username ?? null,
      error: result.ok ? null : result.error ?? null,
    },
  });

  if (!result.ok)
    return NextResponse.json({ message: result.error }, { status: 400 });

  return NextResponse.json({ success: true });
});
