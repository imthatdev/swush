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

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/roles";
import { adminGetSettings, adminPutSettings } from "@/lib/server/admin/actions";
import { audit } from "@/lib/api/audit";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET() {
  await requireAdmin();
  const settings = await adminGetSettings();
  await audit({
    action: "settings.read",
    targetType: "settings",
    targetId: "global",
    statusCode: 200,
  });
  return NextResponse.json(settings, {
    headers: { "Cache-Control": "no-store" },
  });
});

export const PUT = withApiError(async function PUT(req: Request) {
  await requireAdmin();
  const json = await req.json();

  const result = await adminPutSettings(json);
  if (!result.ok) {
    await audit({
      action: "settings.update",
      targetType: "settings",
      targetId: "global",
      statusCode: 400,
      meta: { error: result.error ?? "Invalid payload" },
    });
    return NextResponse.json(
      { error: "Invalid payload", details: result.error },
      { status: 400 }
    );
  }

  await audit({
    action: "settings.update",
    targetType: "settings",
    targetId: "global",
    statusCode: 200,
    meta: { keys: Object.keys(json) },
  });
  return NextResponse.json(result.settings, {
    headers: { "Cache-Control": "no-store" },
  });
});
