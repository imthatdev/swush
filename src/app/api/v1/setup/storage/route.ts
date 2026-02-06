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

  await req.json().catch(() => null);
  return NextResponse.json(
    {
      message:
        "Storage is configured via environment variables and cannot be set from setup.",
    },
    { status: 400 },
  );
});
