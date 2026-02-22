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

export const runtime = "nodejs";

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
      items = body.urls.map((url: string) => ({ url }));
    } else if (Array.isArray(body.items)) {
      items = body.items.filter(
        (item: RemoteUploadJob) => typeof item.url === "string",
      );
    }
    if (!items.length)
      return NextResponse.json(
        { message: "No URLs provided" },
        { status: 400 },
      );

    const jobs = await Promise.all(
      items.map(({ url, name }) => createRemoteUploadJob(user.id, url, name)),
    );
    return NextResponse.json({ jobs });
  } catch {
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
