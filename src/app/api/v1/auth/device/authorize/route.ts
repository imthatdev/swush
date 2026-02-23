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

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { deviceAuth } from "@/db/schemas";
import { eq, or } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";
import {
  DEVICE_FLOW_EXPIRES_IN_SECONDS,
  DEVICE_FLOW_INTERVAL_SECONDS,
  generateDeviceCode,
  generateUserCode,
  getDeviceVerificationUrl,
  hashDeviceCode,
} from "@/lib/auth/device-flow";

const MAX_CODE_ATTEMPTS = 5;

function parseAllowedExtensions() {
  const raw = process.env.DEVICE_AUTH_EXTENSION_IDS?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export const POST = withApiError(async function POST(req: NextRequest) {
  let payload: { extension_id?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  const extensionId = payload.extension_id?.trim();
  if (!extensionId) {
    return NextResponse.json(
      { error: "Missing extension_id" },
      { status: 400 },
    );
  }

  const allowed = parseAllowedExtensions();
  if (allowed && !allowed.includes(extensionId)) {
    return NextResponse.json(
      { error: "Extension not allowed" },
      { status: 403 },
    );
  }

  let userCode = "";
  let deviceCode = "";
  let deviceCodeHash = "";

  for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
    userCode = generateUserCode();
    deviceCode = generateDeviceCode();
    deviceCodeHash = hashDeviceCode(deviceCode);

    const existing = await db
      .select({ id: deviceAuth.id })
      .from(deviceAuth)
      .where(
        or(
          eq(deviceAuth.userCode, userCode),
          eq(deviceAuth.deviceCodeHash, deviceCodeHash),
        ),
      )
      .limit(1);

    if (existing.length === 0) break;
  }

  if (!userCode || !deviceCode || !deviceCodeHash) {
    return NextResponse.json(
      { error: "Failed to allocate device code" },
      { status: 500 },
    );
  }

  const expiresAt = new Date(
    Date.now() + DEVICE_FLOW_EXPIRES_IN_SECONDS * 1000,
  );

  await db.insert(deviceAuth).values({
    id: randomUUID(),
    deviceCodeHash,
    userCode,
    extensionId,
    status: "pending",
    expiresAt,
    interval: DEVICE_FLOW_INTERVAL_SECONDS,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const verificationUri = await getDeviceVerificationUrl();
  const verificationUriComplete = new URL(verificationUri);
  verificationUriComplete.searchParams.set("user_code", userCode);

  return NextResponse.json({
    device_code: deviceCode,
    user_code: userCode,
    verification_uri: verificationUri,
    verification_uri_complete: verificationUriComplete.toString(),
    expires_in: DEVICE_FLOW_EXPIRES_IN_SECONDS,
    interval: DEVICE_FLOW_INTERVAL_SECONDS,
  });
});
