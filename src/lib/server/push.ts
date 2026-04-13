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

import "server-only";

import webpush from "web-push";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schemas";
import { and, desc, eq, lt } from "drizzle-orm";
import { getPublicRuntimeSettings } from "./runtime-settings";

type PushPayload = {
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  sound?: string | null;
};

export type PushSubscriptionSummary = {
  id: string;
  endpoint: string;
  endpointHost: string;
  createdAt: string;
  updatedAt: string;
};

let vapidReady = false;

function parsePositiveInt(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function endpointHost(endpoint: string) {
  try {
    return new URL(endpoint).host || "unknown";
  } catch {
    return "unknown";
  }
}

export function isVapidConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

async function ensureVapid() {
  const { appUrl } = await getPublicRuntimeSettings();
  if (vapidReady) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  const subject =
    process.env.VAPID_SUBJECT || (appUrl && "mailto:admin@swush.app");
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
}

export async function listPushSubscriptionsForUser(userId: string) {
  const rows = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      createdAt: pushSubscriptions.createdAt,
      updatedAt: pushSubscriptions.updatedAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .orderBy(desc(pushSubscriptions.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    endpoint: row.endpoint,
    endpointHost: endpointHost(row.endpoint),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })) satisfies PushSubscriptionSummary[];
}

export async function removeInactivePushSubscriptions(params?: {
  inactiveDays?: number;
  userId?: string;
}) {
  const inactiveDays = parsePositiveInt(params?.inactiveDays, 30);
  const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  const whereClause = params?.userId
    ? and(
        eq(pushSubscriptions.userId, params.userId),
        lt(pushSubscriptions.updatedAt, cutoff),
      )
    : lt(pushSubscriptions.updatedAt, cutoff);

  const removed = await db
    .delete(pushSubscriptions)
    .where(whereClause)
    .returning({ id: pushSubscriptions.id });

  return {
    removed: removed.length,
    inactiveDays,
    cutoff: cutoff.toISOString(),
  };
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    await ensureVapid();
  } catch {
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (!subs.length) return;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    data: payload.data ?? {},
    sound: payload.sound ?? undefined,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          body,
        );

        await db
          .update(pushSubscriptions)
          .set({ updatedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      } catch (err) {
        const status =
          typeof err === "object" && err !== null
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        } else {
          console.warn("Push notification failed", err);
        }
      }
    }),
  );
}
