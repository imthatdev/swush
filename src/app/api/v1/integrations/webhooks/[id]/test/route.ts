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
import { getCurrentUser } from "@/lib/client/user";
import { withApiError } from "@/lib/server/api-error";
import { sendWebhookTest } from "@/lib/server/integrations/webhooks";

export const POST = withApiError(async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await sendWebhookTest({ userId: user.id, webhookId: id });
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: result.lastError ?? "Webhook delivery failed",
          status: result.lastStatus ?? 0,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true, status: result.lastStatus ?? 200 });
  } catch (err) {
    if ((err as Error).message === "Webhook not found") {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    throw err;
  }
});
