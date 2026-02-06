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
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { isVapidConfigured, sendPushToUser } from "@/lib/server/push";
import { withApiError } from "@/lib/server/api-error";

export const runtime = "nodejs";

type SubscriptionPayload = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function normalizeSubscription(body: SubscriptionPayload) {
  const endpoint =
    typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh =
    typeof body?.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const authKey =
    typeof body?.keys?.auth === "string" ? body.keys.auth.trim() : "";
  if (!endpoint || !p256dh || !authKey) return null;
  return { endpoint, p256dh, auth: authKey };
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, session.user.id));

  return NextResponse.json({ subscriptions: rows });
});

export const POST = withApiError(async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SubscriptionPayload;
  const normalized = normalizeSubscription(body);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await db
    .insert(pushSubscriptions)
    .values({
      userId: session.user.id,
      endpoint: normalized.endpoint,
      p256dh: normalized.p256dh,
      auth: normalized.auth,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: session.user.id,
        p256dh: normalized.p256dh,
        auth: normalized.auth,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ status: true });
});

export const DELETE = withApiError(async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SubscriptionPayload;
  const endpoint =
    typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
  }

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  return NextResponse.json({ status: true });
});

export const PUT = withApiError(async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isVapidConfigured()) {
    return NextResponse.json(
      { error: "VAPID keys not configured" },
      { status: 500 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    sound?: string;
  };
  const sound = typeof body?.sound === "string" ? body.sound.trim() : "";
  await sendPushToUser(session.user.id, {
    title: "Swush",
    body: body?.message || "Test notification",
    data: { url: "/vault" },
    sound: sound || undefined,
  });
  return NextResponse.json({ status: true });
});
