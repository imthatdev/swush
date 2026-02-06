/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

import { NextRequest, NextResponse } from "next/server";
import { listAudit } from "@/lib/api/audit";
import { requireAdmin } from "@/lib/security/roles";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  await requireAdmin();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? undefined;
  const targetType = url.searchParams.get("targetType") ?? undefined;
  const actorId = url.searchParams.get("actorId") ?? undefined;
  const chainId = url.searchParams.get("chainId") ?? undefined;
  const q = url.searchParams.get("q") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const page = Number(url.searchParams.get("page") ?? 1);

  const data = await listAudit({
    action,
    targetType,
    actorId,
    chainId,
    q,
    limit,
    page,
  });
  return NextResponse.json(data);
});
