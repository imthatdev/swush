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

import { addViewBySlug } from "@/lib/api/files";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/server/api-error";
import { recordContentViewEvent } from "@/lib/server/content-view-analytics";
import { recordItemAnalyticsHit } from "@/lib/server/item-analytics";

export const PATCH = withApiError(async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const result = await addViewBySlug(slug);

  if (result.status === 200 && result.body && typeof result.body === "object") {
    const body = result.body as { id?: string; userId?: string; slug?: string };
    if (body.id && body.userId) {
      await recordContentViewEvent({
        ownerUserId: body.userId,
        itemType: "file",
        itemId: body.id,
        slug: body.slug ?? slug,
        headers: req.headers,
      });
      await recordItemAnalyticsHit({
        itemType: "file",
        itemId: body.id,
        headers: req.headers,
        context: "public_view",
      });
    }
  }

  return NextResponse.json(result.body, { status: result.status });
});
