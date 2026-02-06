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
import { updateServerSettings } from "@/lib/settings";
import { getSetupStatus } from "@/lib/server/setup";
import { withApiError } from "@/lib/server/api-error";

export const POST = withApiError(async function POST(req: NextRequest) {
  const setup = await getSetupStatus();
  if (setup.setupCompleted) {
    return NextResponse.json(
      { message: "Setup already completed" },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  const allowPublicRegistration =
    typeof body.allowPublicRegistration === "boolean"
      ? body.allowPublicRegistration
      : undefined;
  const passwordPolicyMinLength =
    typeof body.passwordPolicyMinLength === "number"
      ? Math.max(6, Math.round(body.passwordPolicyMinLength))
      : undefined;
  const maxUploadMb =
    typeof body.maxUploadMb === "number"
      ? Math.max(1, Math.round(body.maxUploadMb))
      : undefined;
  const maxFilesPerUpload =
    typeof body.maxFilesPerUpload === "number"
      ? Math.max(1, Math.round(body.maxFilesPerUpload))
      : undefined;

  await updateServerSettings({
    allowPublicRegistration,
    passwordPolicyMinLength,
    maxUploadMb,
    maxFilesPerUpload,
  });

  return NextResponse.json({ ok: true });
});
