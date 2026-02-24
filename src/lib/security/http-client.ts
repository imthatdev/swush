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

import { assertSafeExternalHttpUrl } from "@/lib/security/url";

const INTERNAL_BASE = "http://swush.internal";
const INTERNAL_API_PREFIX = "/api/v1";
const INTERNAL_API_ALLOWLIST = [INTERNAL_API_PREFIX];
const SAME_ORIGIN_PROTOCOL_ALLOWLIST = ["http:", "https:"];

function assertNoTraversal(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid path");
  }
}

export function assertSafeInternalApiUrl(rawUrl: string): string {
  const value = rawUrl.trim();
  if (!value) throw new Error("URL is required");
  if (/^[a-z][a-z\d+\-.]*:/i.test(value) || value.startsWith("//")) {
    throw new Error("Internal API URL must be relative");
  }

  const parsed = new URL(value, INTERNAL_BASE);
  if (parsed.origin !== INTERNAL_BASE) {
    throw new Error("Internal API URL origin is invalid");
  }
  if (
    parsed.pathname !== INTERNAL_API_PREFIX &&
    !parsed.pathname.startsWith(`${INTERNAL_API_PREFIX}/`)
  ) {
    throw new Error("Internal API URL path is invalid");
  }
  assertNoTraversal(parsed.pathname);

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function fetchSafeInternalApi(input: string, init?: RequestInit) {
  const safeUrl = assertSafeInternalApiUrl(input);
  const isAllowed = INTERNAL_API_ALLOWLIST.some(
    (prefix) => safeUrl === prefix || safeUrl.startsWith(`${prefix}/`),
  );
  if (!isAllowed) {
    throw new Error("Internal API URL is not in allowlist");
  }
  return fetch(safeUrl, init);
}

export function assertSafeSameOriginHttpUrl(
  rawUrl: string,
  origin: string,
): string {
  const value = rawUrl.trim();
  if (!value) throw new Error("URL is required");
  const parsed = new URL(value, origin);
  if (parsed.origin !== origin) {
    throw new Error("Cross-origin URL is not allowed");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL protocol must be http or https");
  }
  assertNoTraversal(parsed.pathname);
  return parsed.toString();
}

export function fetchSafeSameOrigin(input: string, init?: RequestInit) {
  if (typeof window === "undefined") {
    throw new Error("Same-origin fetch is only available in browser context");
  }
  const safeUrl = assertSafeSameOriginHttpUrl(input, window.location.origin);
  const parsed = new URL(safeUrl);
  const sameOriginAllowlist = [window.location.origin];
  if (!sameOriginAllowlist.includes(parsed.origin)) {
    throw new Error("Cross-origin URL is not in allowlist");
  }
  if (!SAME_ORIGIN_PROTOCOL_ALLOWLIST.includes(parsed.protocol)) {
    throw new Error("URL protocol must be http or https");
  }
  return fetch(parsed.toString(), init);
}

export function fetchSafeExternalHttp(input: string, init?: RequestInit) {
  const safeUrl = assertSafeExternalHttpUrl(input);
  const parsed = new URL(safeUrl);
  const allowedProtocols = ["http:", "https:"];
  if (!allowedProtocols.includes(parsed.protocol)) {
    throw new Error("External URL protocol is not in allowlist");
  }
  return fetch(parsed.toString(), init);
}
