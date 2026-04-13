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
import { getClientIp } from "@/lib/security/ip";
import { rateLimit } from "@/lib/security/rate-limit";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";
import { importBookmarksFromText } from "@/lib/server/bookmark-transfer";

async function readImportPayload(req: NextRequest) {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const filePart = form.get("file");
    const textPart = form.get("text");

    if (filePart instanceof File) {
      return {
        text: await filePart.text(),
        fileName: filePart.name || null,
      };
    }

    if (typeof textPart === "string") {
      return {
        text: textPart,
        fileName:
          typeof form.get("fileName") === "string"
            ? (form.get("fileName") as string)
            : null,
      };
    }

    return { text: "", fileName: null };
  }

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    fileName?: string;
  };
  return {
    text: typeof body.text === "string" ? body.text : "",
    fileName: typeof body.fileName === "string" ? body.fileName : null,
  };
}

export const POST = withApiError(async function POST(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user)
    user = await getCurrentUserFromToken(req, undefined, ["bookmarks"]);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const blocked = await requireUserFeature(user.id, "bookmarks");
  if (blocked) return blocked;

  const ip = getClientIp(req);
  const ipLimit = 10;
  const userLimit = 5;
  const windowMs = 60_000;
  const ipRL = await rateLimit({ key: `ip:${ip}`, limit: ipLimit, windowMs });
  const userRL = await rateLimit({
    key: `u:${user.id}`,
    limit: userLimit,
    windowMs,
  });

  if (!ipRL.success || !userRL.success) {
    const retry =
      Math.max(ipRL.retryAfter ?? 0, userRL.retryAfter ?? 0) ||
      Math.ceil(windowMs / 1000);
    return NextResponse.json(
      { message: `Too many import attempts. Try again in ${retry}s` },
      { status: 429 },
    );
  }

  const { text, fileName } = await readImportPayload(req);
  if (!text.trim()) {
    return NextResponse.json(
      { error: "No bookmark file content provided" },
      { status: 400 },
    );
  }

  const summary = await importBookmarksFromText({
    userId: user.id,
    username: user.username ?? undefined,
    role: user.role,
    text,
    fileName,
  });

  await audit({
    action: "bookmark.import",
    targetType: "bookmark",
    targetId: user.id,
    statusCode: 200,
    meta: {
      fileName,
      total: summary.total,
      imported: summary.imported,
      skipped: summary.skipped,
      failed: summary.failed,
    },
  });

  return NextResponse.json({ data: summary });
});
