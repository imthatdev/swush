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

import crypto from "node:crypto";
import { db } from "@/db/client";
import { integrationWebhooks } from "@/db/schemas/core-schema";
import { and, eq } from "drizzle-orm";
import { assertSafeExternalHttpUrl } from "@/lib/security/url";
import { fetchSafeExternalHttp } from "@/lib/security/http-client";

export type WebhookEventName =
  | "file.uploaded"
  | "file.deleted"
  | "shortlink.created"
  | "bookmark.created"
  | "note.created"
  | "integration.test";

type WebhookRecord = typeof integrationWebhooks.$inferSelect;

type WebhookFormat = "json" | "discord";

function signPayload(secret: string, payload: string) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  return `sha256=${hmac.digest("hex")}`;
}

function buildDiscordPayload(
  event: WebhookEventName,
  payload: Record<string, unknown>,
) {
  const title = `Swush · ${event}`;
  const description = payload?.["originalName"]
    ? String(payload["originalName"])
    : payload?.["slug"]
      ? String(payload["slug"])
      : "New event";
  return {
    content: title,
    embeds: [
      {
        title,
        description,
        color: 0x8b5cf6,
        fields: Object.entries(payload)
          .slice(0, 8)
          .map(([key, value]) => ({
            name: key,
            value: typeof value === "string" ? value : JSON.stringify(value),
            inline: true,
          })),
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function sendWebhook(
  hook: WebhookRecord,
  body: string,
  event: WebhookEventName,
  timestamp: string,
) {
  let safeUrl: string;
  try {
    safeUrl = assertSafeExternalHttpUrl(hook.url);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Invalid webhook URL";
    await db
      .update(integrationWebhooks)
      .set({
        lastStatus: undefined,
        lastError: reason,
        lastDeliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrationWebhooks.id, hook.id));

    return { ok: false, lastStatus: null, lastError: reason };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-swush-event": event,
    "x-swush-timestamp": timestamp,
  };
  if (hook.secret) {
    headers["x-swush-signature"] = signPayload(hook.secret, body);
  }

  let lastError: string | null = null;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetchSafeExternalHttp(safeUrl, {
        method: "POST",
        headers,
        body,
      });
      lastStatus = res.status;
      if (res.ok) {
        lastError = null;
        break;
      }
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Request failed";
    }

    await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }

  await db
    .update(integrationWebhooks)
    .set({
      lastStatus: lastStatus ?? undefined,
      lastError: lastError ?? undefined,
      lastDeliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(integrationWebhooks.id, hook.id));

  return {
    ok: !lastError,
    lastStatus: lastStatus ?? null,
    lastError: lastError ?? null,
  };
}

export async function emitWebhookEvent(params: {
  userId: string;
  event: WebhookEventName;
  payload: Record<string, unknown>;
}) {
  const hooks = await db
    .select()
    .from(integrationWebhooks)
    .where(
      and(
        eq(integrationWebhooks.userId, params.userId),
        eq(integrationWebhooks.enabled, true),
      ),
    );

  if (!hooks.length) return;

  const now = new Date().toISOString();
  const basePayload = {
    event: params.event,
    createdAt: now,
    payload: params.payload,
  };

  const tasks = hooks
    .filter((hook) => {
      const events = Array.isArray(hook.events) ? hook.events : [];
      return events.includes(params.event) || events.includes("*");
    })
    .map((hook) => {
      const format = (hook.format as WebhookFormat) || "json";
      const payload =
        format === "discord"
          ? buildDiscordPayload(params.event, params.payload)
          : basePayload;
      const body = JSON.stringify(payload);
      return sendWebhook(hook, body, params.event, now);
    });

  await Promise.allSettled(tasks);
}

export async function sendWebhookTest(params: {
  userId: string;
  webhookId: string;
}) {
  const [hook] = await db
    .select()
    .from(integrationWebhooks)
    .where(
      and(
        eq(integrationWebhooks.userId, params.userId),
        eq(integrationWebhooks.id, params.webhookId),
      ),
    )
    .limit(1);

  if (!hook) throw new Error("Webhook not found");

  const now = new Date().toISOString();
  const format = (hook.format as WebhookFormat) || "json";
  const payload =
    format === "discord"
      ? buildDiscordPayload("integration.test", {
          message: "Webhook test",
          webhookId: hook.id,
        })
      : {
          event: "integration.test",
          createdAt: now,
          payload: { message: "Webhook test", webhookId: hook.id },
        };
  const body = JSON.stringify(payload);

  return await sendWebhook(hook, body, "integration.test", now);
}
