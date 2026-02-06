import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { deviceAuth, userInfo } from "@/db/schemas";
import { eq } from "drizzle-orm";
import {
  DEVICE_FLOW_INTERVAL_SECONDS,
  hashDeviceCode,
} from "@/lib/auth/device-flow";
import { createApiKeyForUser } from "@/lib/client/apiTokens";
import { withApiError } from "@/lib/server/api-error";
import { getServerSettings } from "@/lib/settings";

const API_KEY_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;

export const POST = withApiError(async function POST(req: NextRequest) {
  const settings = await getServerSettings();
  if (settings.disableApiTokens) {
    return NextResponse.json(
      { error: "access_denied", error_description: "API tokens are disabled" },
      { status: 403 },
    );
  }
  let payload: { device_code?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const deviceCode = payload.device_code?.trim();
  if (!deviceCode) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "Missing device_code" },
      { status: 400 },
    );
  }

  const deviceCodeHash = hashDeviceCode(deviceCode);
  const [record] = await db
    .select()
    .from(deviceAuth)
    .where(eq(deviceAuth.deviceCodeHash, deviceCodeHash))
    .limit(1);

  if (!record) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Unknown device code" },
      { status: 400 },
    );
  }

  const now = Date.now();
  const expiresAt = record.expiresAt instanceof Date ? record.expiresAt : null;
  if (!expiresAt || expiresAt.getTime() <= now) {
    return NextResponse.json(
      { error: "expired_token", error_description: "Device code expired" },
      { status: 400 },
    );
  }

  if (record.status === "denied") {
    return NextResponse.json(
      { error: "access_denied", error_description: "Request denied" },
      { status: 400 },
    );
  }

  if (record.status === "consumed") {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Device code consumed" },
      { status: 400 },
    );
  }

  if (record.status === "pending") {
    const interval =
      typeof record.interval === "number"
        ? record.interval
        : DEVICE_FLOW_INTERVAL_SECONDS;
    if (record.lastPolledAt instanceof Date) {
      const elapsed = now - record.lastPolledAt.getTime();
      if (elapsed < interval * 1000) {
        return NextResponse.json(
          {
            error: "slow_down",
            error_description: "Polling too frequently",
            interval,
          },
          { status: 400 },
        );
      }
    }

    await db
      .update(deviceAuth)
      .set({ lastPolledAt: new Date(), updatedAt: new Date() })
      .where(eq(deviceAuth.id, record.id));

    return NextResponse.json(
      {
        error: "authorization_pending",
        error_description: "Authorization pending",
        interval,
      },
      { status: 400 },
    );
  }

  if (!record.userId) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "Missing user binding" },
      { status: 400 },
    );
  }

  const [userFlags] = await db
    .select({ disableApiTokens: userInfo.disableApiTokens })
    .from(userInfo)
    .where(eq(userInfo.userId, record.userId))
    .limit(1);
  if (userFlags?.disableApiTokens) {
    return NextResponse.json(
      {
        error: "access_denied",
        error_description: "API tokens are disabled for this account",
      },
      { status: 403 },
    );
  }

  const safeName = "Swush Companion";

  let apiKey;
  try {
    apiKey = await createApiKeyForUser({
      userId: record.userId,
      name: safeName,
      expiresIn: API_KEY_EXPIRES_IN_SECONDS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "server_error",
        error_description:
          error instanceof Error ? error.message : "Failed to create API key",
      },
      { status: 500 },
    );
  }

  if (!apiKey?.key) {
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "Failed to create API key",
      },
      { status: 500 },
    );
  }

  await db
    .update(deviceAuth)
    .set({ status: "consumed", updatedAt: new Date() })
    .where(eq(deviceAuth.id, record.id));

  return NextResponse.json({
    token_type: "ApiKey",
    api_key: apiKey.key,
    expires_in: API_KEY_EXPIRES_IN_SECONDS,
    interval: DEVICE_FLOW_INTERVAL_SECONDS,
  });
});
