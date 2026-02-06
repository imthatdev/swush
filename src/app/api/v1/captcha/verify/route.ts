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
import { withApiError } from "@/lib/server/api-error";
import {
  createCaptchaPassToken,
  verifyTurnstileToken,
} from "@/lib/server/captcha";

function getRemoteIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("cf-connecting-ip");
}

export const POST = withApiError(async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
  } | null;

  const token = body?.token?.trim();
  const remoteip = getRemoteIp(req);
  const result = await verifyTurnstileToken(token, remoteip);

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, errorCodes: result.errorCodes ?? [] },
      { status: 400 },
    );
  }

  const pass = createCaptchaPassToken(remoteip);
  return NextResponse.json({ ok: true, pass, skipped: result.skipped });
});
