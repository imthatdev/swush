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
import { getCurrentUser } from "@/lib/client/user";
import { getRemainingSummary } from "@/lib/security/policy";
import { getUserInfo } from "@/lib/server/user-info";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userInfo = await getUserInfo({ userId: user?.id });

  if (!userInfo) {
    return NextResponse.json({ error: "User info not found" }, { status: 404 });
  }

  const summary = await getRemainingSummary(user.id, userInfo?.role);

  return NextResponse.json(summary);
});
