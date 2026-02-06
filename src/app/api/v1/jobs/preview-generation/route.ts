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

import { NextRequest, NextResponse } from "next/server";
import { runPreviewGenerationJob } from "@/lib/server/cron-jobs";
import { enqueueMissingPreviews } from "@/lib/server/preview-jobs";
import { withApiError } from "@/lib/server/api-error";
import { safeCompare } from "@/lib/security/safe-compare";

export const runtime = "nodejs";

function isAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerSecret = req.headers.get("x-cron-secret");
  if (headerSecret && safeCompare(headerSecret, secret)) return true;
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
  return bearer?.[1] ? safeCompare(bearer[1], secret) : false;
}

export const POST = withApiError(async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") || 3);
  const count = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 10) : 3;
  const mode = (url.searchParams.get("mode") || "").toLowerCase();
  let enqueued = 0;

  if (mode === "backfill") {
    const scan = Number(url.searchParams.get("scan") || count);
    const scanCount =
      Number.isFinite(scan) && scan > 0 ? Math.min(scan, 50) : count;
    const res = await enqueueMissingPreviews(scanCount);
    enqueued = res.enqueued;
  }

  const result = await runPreviewGenerationJob(count);
  return NextResponse.json({ status: true, enqueued, ...result });
});
