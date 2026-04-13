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
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { audit } from "@/lib/api/audit";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";
import {
  buildBookmarksExport,
  type BookmarkExportFormat,
} from "@/lib/server/bookmark-transfer";

function normalizeFormat(value: string | null): BookmarkExportFormat {
  return value?.toLowerCase() === "html" ? "html" : "json";
}

export const GET = withApiError(async function GET(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user)
    user = await getCurrentUserFromToken(req, undefined, ["bookmarks"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const format = normalizeFormat(searchParams.get("format"));
  const payload = await buildBookmarksExport(user.id, format);

  await audit({
    action: "bookmark.export",
    targetType: "bookmark",
    targetId: user.id,
    statusCode: 200,
    meta: { format, fileName: payload.fileName },
  });

  return new NextResponse(payload.body, {
    status: 200,
    headers: {
      "Content-Type": payload.contentType,
      "Content-Disposition": `attachment; filename="${payload.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
});
