/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   You may not use this file except in compliance with the License.
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

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const isProd = process.env.NODE_ENV === "production";

function buildCSP(frameAncestors: "'none'" | "'self'" | string = "'none'") {
  const analyticsScripts = [
    "https://eu-assets.i.posthog.com",
    "https://static.cloudflareinsights.com",
  ];
  const turnstileDomains = ["https://challenges.cloudflare.com"];
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    `frame-ancestors ${frameAncestors}`,
    "form-action 'self'",
    "img-src 'self' https: data: blob:",
    "font-src 'self' https: data:",
    "media-src 'self' blob:",
    `connect-src 'self' https: ${turnstileDomains.join(" ")} ${
      isProd ? "wss:" : "ws: wss:"
    }`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline' ${
      isProd ? "" : "'unsafe-eval'"
    } blob: ${analyticsScripts.join(" ")} ${turnstileDomains.join(" ")}`.trim(),
    `script-src-elem 'self' 'unsafe-inline' blob: ${analyticsScripts.join(
      " ",
    )} ${turnstileDomains.join(" ")}`.trim(),
    `frame-src 'self' ${turnstileDomains.join(" ")}`.trim(),
    "worker-src 'self' blob:",
  ];
  return directives.join("; ");
}

function withCSP(
  res: NextResponse,
  frameAncestors: "'none'" | "'self'" | string = "'none'",
) {
  res.headers.set("Content-Security-Policy", buildCSP(frameAncestors));
  return res;
}

function isStaticAsset(pathname: string) {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/images") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/og-image")
  ) {
    return true;
  }
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) return true;
  return false;
}

function isAuthPublicPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname === "/request-password"
  );
}

function isEmbeddablePath(pathname: string) {
  return (
    pathname.startsWith("/v/") ||
    pathname.startsWith("/x/") ||
    pathname.startsWith("/hls/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const frameAncestors = isEmbeddablePath(pathname) ? "'self'" : "'none'";

  if (isStaticAsset(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") || "";
    const isTauriOrigin = origin.toLowerCase().startsWith("tauri://");

    const allowedOrigin = process.env.APP_URL || process.env.BETTER_AUTH_URL;
    const isAllowed = origin === allowedOrigin || !isProd || isTauriOrigin;

    if (!isAllowed) {
      return new NextResponse("Bad origin", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      const pre = new NextResponse(null, { status: isAllowed ? 204 : 403 });
      if (isAllowed && origin) {
        pre.headers.set("Access-Control-Allow-Origin", origin);
        pre.headers.set("Vary", "Origin");
        pre.headers.set(
          "Access-Control-Allow-Methods",
          "GET,POST,PATCH,PUT,DELETE,OPTIONS",
        );
        pre.headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization",
        );
        pre.headers.set("Access-Control-Allow-Credentials", "true");
      }
      return pre;
    }

    const res = NextResponse.next();
    if (isAllowed && origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  const isPublic =
    isAuthPublicPath(pathname) ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/n/") ||
    pathname.startsWith("/b/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/x/") ||
    pathname.startsWith("/hls/") ||
    pathname.startsWith("/v/") ||
    pathname.startsWith("/l/") ||
    pathname.startsWith("/g/") ||
    pathname.startsWith("/f/") ||
    pathname.startsWith("/meet/") ||
    pathname.startsWith("/up/") ||
    pathname.startsWith("/u/") ||
    pathname === "/about" ||
    pathname === "/goodbye" ||
    pathname === "/setup" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/meet" ||
    pathname === "/s" ||
    pathname === "/n" ||
    pathname === "/b" ||
    pathname === "/c" ||
    pathname === "/r" ||
    pathname === "/x" ||
    pathname === "/hls" ||
    pathname === "/l" ||
    pathname === "/g" ||
    pathname === "/f" ||
    pathname === "/u" ||
    pathname === "/v";

  if (isPublic) return withCSP(NextResponse.next(), frameAncestors);

  let session: unknown = null;
  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });
  } catch {
    return withCSP(NextResponse.next(), frameAncestors);
  }

  const isLoggedIn = !!session;

  if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
    const url = new URL("/vault", request.url);
    return NextResponse.redirect(url);
  }

  if (!isLoggedIn) {
    const url = new URL("/login", request.url);
    const original = pathname + search;
    url.searchParams.set("next", original);
    return NextResponse.redirect(url);
  }

  return withCSP(NextResponse.next(), frameAncestors);
}

export const config = {
  matcher: ["/:path*"],
};
