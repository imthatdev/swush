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
import { normalizeHttpUrl, normalizeSharingDomain } from "@/lib/api/helpers";

const isProd = process.env.NODE_ENV === "production";

const STATIC_ASSET_PREFIXES = [
  "/_next",
  "/static",
  "/images",
  "/manifest",
  "/icon",
  "/apple-icon",
  "/og-image",
] as const;

const STATIC_ASSET_EXACT_PATHS = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

const AUTH_PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/reset-password",
  "/request-password",
]);

const SHARE_PUBLIC_PREFIXES = [
  "/s/",
  "/b/",
  "/x/",
  "/hls/",
  "/v/",
  "/l/",
  "/f/",
  "/up/",
] as const;

const EMBEDDABLE_PREFIXES = ["/v/", "/x/", "/hls/"] as const;

const EXTRA_PUBLIC_PATHS = [
  "/about",
  "/goodbye",
  "/setup",
  "/privacy",
  "/terms",
] as const;

const PUBLIC_EXACT_PATHS = new Set([
  ...EXTRA_PUBLIC_PATHS,
  ...SHARE_PUBLIC_PREFIXES.map((prefix) => prefix.slice(0, -1)),
]);

function startsWithAny(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

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
  return (
    startsWithAny(pathname, STATIC_ASSET_PREFIXES) ||
    STATIC_ASSET_EXACT_PATHS.has(pathname) ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

function isAuthPublicPath(pathname: string) {
  return AUTH_PUBLIC_PATHS.has(pathname);
}

function isEmbeddablePath(pathname: string) {
  return startsWithAny(pathname, EMBEDDABLE_PREFIXES);
}

function isPublicPath(pathname: string) {
  return (
    isAuthPublicPath(pathname) ||
    startsWithAny(pathname, SHARE_PUBLIC_PREFIXES) ||
    PUBLIC_EXACT_PATHS.has(pathname)
  );
}

function normalizeHost(value?: string | null) {
  const raw = (value ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!raw) return "";
  const strippedProtocol = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  return strippedProtocol.replace(/:\d+$/, "");
}

function getRequestHost(request: NextRequest) {
  return normalizeHost(
    request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      request.nextUrl.host,
  );
}

function getHostFromUrl(url?: string | null) {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isValidSharingDomainPath(pathname: string) {
  return startsWithAny(pathname, SHARE_PUBLIC_PREFIXES);
}

function resolveFallbackRedirectTarget(
  fallbackTarget: string,
  sharingDomainHost: string,
) {
  try {
    const target = new URL(fallbackTarget);
    const sameShortDomain = target.hostname.toLowerCase() === sharingDomainHost;

    if (!sameShortDomain || isValidSharingDomainPath(target.pathname)) {
      return target;
    }
  } catch {}

  return null;
}

async function getSharingDomainConfig() {
  const appUrl = normalizeHttpUrl(
    process.env.APP_URL || process.env.BETTER_AUTH_URL || "",
  );
  let sharingDomain = normalizeSharingDomain(process.env.SHARING_DOMAIN) || "";
  let fallbackUrl = normalizeHttpUrl(process.env.SHARING_DOMAIN_FALLBACK_URL);

  try {
    const { getServerSettings } = await import("@/lib/settings");
    const settings = await getServerSettings();
    sharingDomain =
      normalizeSharingDomain(settings.sharingDomain) || sharingDomain;
    fallbackUrl =
      normalizeHttpUrl(settings.sharingDomainFallbackUrl) || fallbackUrl;
  } catch {}

  return {
    appUrl,
    sharingDomain,
    fallbackUrl,
  };
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isStaticAsset(pathname)) return NextResponse.next();

  const frameAncestors = isEmbeddablePath(pathname) ? "'self'" : "'none'";

  const sharingDomainConfig = await getSharingDomainConfig();
  const requestHost = getRequestHost(request);
  const sharingDomainHost = getHostFromUrl(sharingDomainConfig.sharingDomain);
  const isSharingDomainRequest =
    Boolean(sharingDomainHost) && sharingDomainHost === requestHost;

  if (
    isSharingDomainRequest &&
    !pathname.startsWith("/api/") &&
    !isValidSharingDomainPath(pathname)
  ) {
    const fallbackTarget =
      sharingDomainConfig.fallbackUrl || sharingDomainConfig.appUrl;

    if (fallbackTarget) {
      const target = resolveFallbackRedirectTarget(
        fallbackTarget,
        sharingDomainHost,
      );
      if (target) return NextResponse.redirect(target);
    }

    return new NextResponse("Not found", { status: 404 });
  }

  if (pathname.startsWith("/api/")) {
    const originHeader = request.headers.get("origin");
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const originHost = getHostFromUrl(originHeader);
    const sameOriginHost =
      Boolean(originHost) && Boolean(requestHost) && originHost === requestHost;

    const proto =
      request.headers.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");

    const allowedOrigins = [
      process.env.APP_URL,
      sharingDomainConfig.sharingDomain,
      ...(process.env.CORS_ORIGIN?.split(",") ?? []),
    ]
      .map((o) => o?.trim())
      .filter((o): o is string => !!o);

    const origin = originHeader ?? `${proto}://${host}`;
    const matchedOrigin = allowedOrigins.find((o) => origin?.startsWith(o));
    const isTauriOrigin = origin.toLowerCase().startsWith("tauri://");
    const noOriginHeader = !originHeader;

    const isAllowed =
      !!matchedOrigin ||
      sameOriginHost ||
      noOriginHeader ||
      !isProd ||
      isTauriOrigin;

    if (!isAllowed) {
      return new NextResponse("Bad Origin", {
        status: 403,
        statusText: "Origin not allowed",
      });
    }

    if (request.method === "OPTIONS") {
      const pre = new NextResponse(null, { status: isAllowed ? 204 : 403 });
      if (isAllowed && origin) {
        if (matchedOrigin) {
          pre.headers.set("Access-Control-Allow-Origin", matchedOrigin);
        } else if (sameOriginHost) {
          pre.headers.set("Access-Control-Allow-Origin", origin);
        }

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
      if (matchedOrigin) {
        res.headers.set("Access-Control-Allow-Origin", matchedOrigin);
      } else if (sameOriginHost) {
        res.headers.set("Access-Control-Allow-Origin", origin);
      }

      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return res;
  }

  if (isPublicPath(pathname))
    return withCSP(NextResponse.next(), frameAncestors);

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
