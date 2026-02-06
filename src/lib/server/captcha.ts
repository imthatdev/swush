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
import crypto from "crypto";

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const PASS_TTL_MS = 10 * 60 * 1000;

function base64UrlEncode(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function getPassSecret() {
  return (
    process.env.CAPTCHA_PASS_SECRET?.trim() ||
    process.env.TURNSTILE_SECRET_KEY?.trim() ||
    ""
  );
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteip?: string | null,
) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  if (!secret || !siteKey) {
    return { ok: true, skipped: true, errorCodes: [] as string[] };
  }
  if (!token) {
    return { ok: false, skipped: false, errorCodes: ["missing-input"] };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteip) body.set("remoteip", remoteip);

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => null)) as {
    success?: boolean;
    [key: string]: unknown;
  } | null;

  let errorCodes: string[] = [];
  if (json && typeof json === "object") {
    const value = (json as Record<string, unknown>)["error-codes"];
    if (Array.isArray(value)) {
      errorCodes = value.filter(
        (item): item is string => typeof item === "string",
      );
    }
  }

  return { ok: Boolean(json?.success), skipped: false, errorCodes };
}

export function createCaptchaPassToken(remoteip?: string | null) {
  const secret = getPassSecret();
  if (!secret) return "";

  const payload = {
    exp: Date.now() + PASS_TTL_MS,
    ip: remoteip || null,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  return `${encoded}.${signature}`;
}

export function verifyCaptchaPassToken(
  token: string | null | undefined,
  remoteip?: string | null,
) {
  const secret = getPassSecret();
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();
  if (!secret || !siteKey) return { ok: true, skipped: true };
  if (!token) return { ok: false, skipped: false };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, skipped: false };

  const [encoded, signature] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  if (expected !== signature) return { ok: false, skipped: false };

  let payload: { exp?: number; ip?: string | null } | null = null;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return { ok: false, skipped: false };
  }

  if (!payload?.exp || payload.exp < Date.now()) {
    return { ok: false, skipped: false };
  }

  if (payload.ip && remoteip && payload.ip !== remoteip) {
    return { ok: false, skipped: false };
  }

  return { ok: true, skipped: false };
}
