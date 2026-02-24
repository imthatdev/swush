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

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { withApiError } from "@/lib/server/api-error";
import { requireUserFeature } from "@/lib/server/user-features";
import {
  createRemoteUploadJob,
  listRemoteUploadJobs,
  deleteRemoteUploadJobs,
  RemoteUploadJob,
} from "@/lib/server/remote-upload-jobs";
import { assertSafeExternalHttpUrl } from "@/lib/security/url";

export const runtime = "nodejs";

export const DELETE = withApiError(async function DELETE(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "files");
  if (blocked) return blocked;

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0)
      return NextResponse.json(
        { message: "No job IDs provided" },
        { status: 400 },
      );
    await deleteRemoteUploadJobs(user.id, ids);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "Failed to delete jobs" },
      { status: 500 },
    );
  }
});

export const POST = withApiError(async function POST(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "files");
  if (blocked) return blocked;

  try {
    const body = await req.json();
    let items: { url: string; name?: string }[] = [];
    if (Array.isArray(body.urls)) {
      items = body.urls
        .filter((url: unknown) => typeof url === "string" && url.trim())
        .map((url: string) => ({ url: url.trim() }));
    } else if (typeof body.urls === "string" && body.urls.trim()) {
      items = [{ url: body.urls.trim() }];
    } else if (typeof body.url === "string" && body.url.trim()) {
      items = [
        {
          url: body.url.trim(),
          name: typeof body.name === "string" ? body.name : undefined,
        },
      ];
    } else if (Array.isArray(body.items)) {
      items = body.items.filter(
        (item: RemoteUploadJob) => typeof item.url === "string",
      );
    } else if (body.items && typeof body.items === "object") {
      const single = body.items as { url?: unknown; name?: unknown };
      if (typeof single.url === "string" && single.url.trim()) {
        items = [
          {
            url: single.url.trim(),
            name: typeof single.name === "string" ? single.name : undefined,
          },
        ];
      }
    }
    if (!items.length)
      return NextResponse.json(
        { message: "No URLs provided" },
        { status: 400 },
      );

    const validatedItems = items.map(({ url, name }) => {
      try {
        return { url: assertSafeExternalHttpUrl(url), name };
      } catch {
        throw new Error("Invalid URL");
      }
    });

    const jobs = await Promise.all(
      validatedItems.map(({ url, name }) =>
        createRemoteUploadJob(user.id, url, name),
      ),
    );
    return NextResponse.json({ jobs });
  } catch (err) {
    if (err instanceof Error && err.message === "Invalid URL") {
      return NextResponse.json(
        { message: "One or more URLs are invalid or unsafe" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "Failed to create jobs" },
      { status: 500 },
    );
  }
});

export const GET = withApiError(async function GET(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const blocked = await requireUserFeature(user.id, "files");
  if (blocked) return blocked;

  try {
    const jobs = await listRemoteUploadJobs(user.id);
    return NextResponse.json({ jobs });
  } catch {
    return NextResponse.json(
      { message: "Failed to list jobs" },
      { status: 500 },
    );
  }
});
