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
import { apiKeySecrets, apikey, session } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { decryptApiKey } from "@/lib/security/api-key-secrets";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getRedirectTarget(raw: string | null, origin: string) {
  if (!raw) return new URL("/vault", origin).toString();
  if (raw.startsWith("/")) return new URL(raw, origin).toString();
  try {
    const url = new URL(raw);
    return url.toString();
  } catch {
    return new URL("/vault", origin).toString();
  }
}

async function extractBody(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const json = await req.json().catch(() => ({}));
    return {
      token: normalizeText(json?.token),
      redirect: normalizeText(json?.redirect),
      clientName: normalizeText(json?.client_name ?? json?.client),
    };
  }
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    return {
      token: normalizeText(form.get("token")),
      redirect: normalizeText(form.get("redirect")),
      clientName: normalizeText(form.get("client_name") ?? form.get("client")),
    };
  }
  return { token: null, redirect: null, clientName: null };
}

async function resolveUserIdFromToken(token: string) {
  const rows = await db
    .select({
      keyId: apiKeySecrets.keyId,
      userId: apiKeySecrets.userId,
      encryptedKey: apiKeySecrets.encryptedKey,
      iv: apiKeySecrets.iv,
      tag: apiKeySecrets.tag,
      enabled: apikey.enabled,
      expiresAt: apikey.expiresAt,
    })
    .from(apiKeySecrets)
    .innerJoin(apikey, eq(apikey.id, apiKeySecrets.keyId));

  for (const row of rows) {
    let decrypted: string | null = null;
    try {
      decrypted = decryptApiKey({
        encrypted: row.encryptedKey,
        iv: row.iv,
        tag: row.tag,
      });
    } catch {
      continue;
    }
    if (decrypted !== token) continue;

    if (row.enabled === false) {
      return { ok: false, reason: "disabled" as const };
    }
    if (row.expiresAt && row.expiresAt < new Date()) {
      return { ok: false, reason: "expired" as const };
    }
    return { ok: true, userId: row.userId };
  }

  return { ok: false, reason: "invalid" as const };
}

export async function POST(req: NextRequest) {
  try {
    const { token, redirect, clientName } = await extractBody(req);
    if (!token) {
      const res = NextResponse.json(
        { error: "Missing token" },
        { status: 400 },
      );
      res.headers.set("x-client-session-route", "v2");
      return res;
    }

    try {
      const resolved = await resolveUserIdFromToken(token);
      if (!resolved.ok || !resolved.userId) {
        const message =
          resolved.reason === "disabled"
            ? "API key disabled"
            : resolved.reason === "expired"
              ? "API key expired"
              : "Invalid token";
        const res = NextResponse.json({ error: message }, { status: 401 });
        res.headers.set("x-client-session-route", "v2");
        return res;
      }

      const ctx = await auth.$context;
      if (!ctx?.secret) {
        const res = NextResponse.json(
          { error: "BETTER_AUTH_SECRET is missing" },
          { status: 500 },
        );
        res.headers.set("x-client-session-route", "v2");
        return res;
      }

      let sessionToken = "";
      try {
        const createdSession = await ctx.internalAdapter.createSession(
          resolved.userId,
        );
        sessionToken = createdSession.token;

        if (clientName) {
          const ipAddress =
            req.headers.get("cf-connecting-ip") ||
            req.headers
              .get("x-forwarded-for")
              ?.split(",")
              .map((ip) => ip.trim())
              .filter(Boolean)[0] ||
            req.headers.get("x-real-ip") ||
            req.headers.get("true-client-ip") ||
            null;

          await db
            .update(session)
            .set({
              userAgent: clientName,
              ipAddress: ipAddress ?? undefined,
            })
            .where(eq(session.token, sessionToken));
        }
      } catch (err) {
        const res = NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Failed to create session",
          },
          { status: 500 },
        );
        res.headers.set("x-client-session-route", "v2");
        return res;
      }

      let cookie: string;
      try {
        const { getCookies } = await import("better-auth/cookies");
        const { serializeSignedCookie } = await import("better-call");
        const cookies = getCookies(ctx.options);
        cookie = await serializeSignedCookie(
          cookies.sessionToken.name,
          sessionToken,
          ctx.secret,
          cookies.sessionToken.attributes,
        );
      } catch (err) {
        const res = NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to sign session cookie",
          },
          { status: 500 },
        );
        res.headers.set("x-client-session-route", "v2");
        return res;
      }

      const res = NextResponse.redirect(
        getRedirectTarget(redirect, req.nextUrl.origin),
        {
          status: 303,
        },
      );
      res.headers.append("Set-Cookie", cookie);
      res.headers.set("Cache-Control", "no-store");
      res.headers.set("x-client-session-route", "v2");
      return res;
    } catch (err) {
      const res = NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to validate API key",
        },
        { status: 500 },
      );
      res.headers.set("x-client-session-route", "v2");
      return res;
    }
  } catch (err) {
    const res = NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
    res.headers.set("x-client-session-route", "v2");
    return res;
  }
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  if (action === "logout") {
    let token: string | null = null;
    try {
      const sessionInfo = await auth.api.getSession({ headers: req.headers });
      token = sessionInfo?.session?.token ?? null;
    } catch {
      token = null;
    }

    if (token) {
      try {
        await db.delete(session).where(eq(session.token, token));
      } catch {
        // ignore db errors; we still clear the cookie
      }
    }

    const rawReturn = req.nextUrl.searchParams.get("return")?.trim();
    let redirectTo = new URL("/login", req.nextUrl.origin).toString();
    if (rawReturn) {
      if (rawReturn.startsWith("tauri://localhost")) {
        redirectTo = rawReturn;
      } else {
        try {
          const candidate = new URL(rawReturn);
          if (candidate.origin === req.nextUrl.origin) {
            redirectTo = candidate.toString();
          }
        } catch {
          // ignore invalid return
        }
      }
    }

    const res = NextResponse.redirect(redirectTo, { status: 303 });
    res.headers.set("x-client-session-route", "v2");
    try {
      const ctx = await auth.$context;
      const { getCookies } = await import("better-auth/cookies");
      const cookies = getCookies(ctx.options);
      const attrs = {
        ...cookies.sessionToken.attributes,
        sameSite: cookies.sessionToken.attributes?.sameSite
          ? ((
              cookies.sessionToken.attributes.sameSite as string
            ).toLowerCase() as "strict" | "lax" | "none")
          : undefined,
      };
      return clearCookie(res, cookies.sessionToken.name, attrs);
    } catch {
      return clearCookie(res, "session");
    }
  }

  const res = NextResponse.json({
    ok: true,
    route: "client-session",
  });
  res.headers.set("x-client-session-route", "v2");
  return res;
}

function clearCookie(
  res: NextResponse,
  name: string,
  attrs?: {
    path?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
  },
) {
  res.cookies.set(name, "", {
    path: attrs?.path ?? "/",
    httpOnly: attrs?.httpOnly ?? true,
    secure: attrs?.secure ?? true,
    sameSite: attrs?.sameSite ?? "lax",
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  let token: string | null = null;
  try {
    const sessionInfo = await auth.api.getSession({ headers: req.headers });
    token = sessionInfo?.session?.token ?? null;
  } catch {
    token = null;
  }

  if (token) {
    try {
      await db.delete(session).where(eq(session.token, token));
    } catch {
      // ignore db errors; we still clear the cookie
    }
  }

  try {
    const ctx = await auth.$context;
    const { getCookies } = await import("better-auth/cookies");
    const cookies = getCookies(ctx.options);
    res.headers.set("x-client-session-route", "v2");
    const attrs = {
      ...cookies.sessionToken.attributes,
      sameSite: cookies.sessionToken.attributes?.sameSite
        ? ((
            cookies.sessionToken.attributes.sameSite as string
          ).toLowerCase() as "strict" | "lax" | "none")
        : undefined,
    };
    return clearCookie(res, cookies.sessionToken.name, attrs);
  } catch {
    res.headers.set("x-client-session-route", "v2");
    return clearCookie(res, "session");
  }
}
