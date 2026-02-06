/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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
import { listFiles } from "@/lib/api/files";
import { audit } from "@/lib/api/audit";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  const result = await listFiles(req);
  await audit({
    action: "file.list",
    targetType: "file",
    targetId: "all",
    statusCode: result.status,
    meta: {
      count: Array.isArray(result.body) ? result.body.length : undefined,
    },
  });
  return NextResponse.json(result.body, { status: result.status });
});
