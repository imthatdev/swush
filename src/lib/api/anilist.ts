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

import crypto from "crypto";
import { apiV1Absolute } from "@/lib/api-path";
import {
  getIntegrationSecrets,
  getPublicRuntimeSettings,
} from "@/lib/server/runtime-settings";

const ANILIST_AUTHORIZE = "https://anilist.co/api/v2/oauth/authorize";
const ANILIST_TOKEN = "https://anilist.co/api/v2/oauth/token";
const OAUTH_SECRET = process.env.BETTER_AUTH_SECRET!;

export async function anilistRedirectUri() {
  const { appUrl } = await getPublicRuntimeSettings();

  return apiV1Absolute(appUrl, "/watch/import/anilist/callback");
}

export function signAniListState(userId: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  const sig = crypto
    .createHmac("sha256", OAUTH_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyAniListState(state: string): string | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const [userId, expStr, sig] = raw.split(".");
    const exp = Number(expStr);
    if (!userId || !exp || !sig) return null;
    if (exp < Math.floor(Date.now() / 1000)) return null;
    const check = crypto
      .createHmac("sha256", OAUTH_SECRET)
      .update(`${userId}.${exp}`)
      .digest("hex");
    if (check !== sig) return null;
    return userId;
  } catch {
    return null;
  }
}

export async function anilistAuthorizeUrl(state: string) {
  const { anilistClientId } = await getIntegrationSecrets();
  if (!anilistClientId) {
    throw new Error("AniList client ID is not set");
  }
  const params = new URLSearchParams({
    client_id: anilistClientId,
    redirect_uri: await anilistRedirectUri(),
    response_type: "code",
    state,
  });
  return `${ANILIST_AUTHORIZE}?${params.toString()}`;
}

export async function anilistExchangeCode(code: string) {
  const { anilistClientId, anilistClientSecret } =
    await getIntegrationSecrets();
  if (!anilistClientId || !anilistClientSecret) {
    throw new Error("AniList client credentials are not set");
  }
  const body = {
    grant_type: "authorization_code",
    client_id: anilistClientId,
    client_secret: anilistClientSecret,
    redirect_uri: anilistRedirectUri(),
    code,
  };

  const res = await fetch(ANILIST_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`anilist token error: ${res.status}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    token_type?: string;
    expires_in?: number;
  };

  return json;
}
