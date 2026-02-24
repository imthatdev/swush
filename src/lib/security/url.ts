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

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255))
    return false;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(hostname: string) {
  const value = hostname.toLowerCase();
  if (value === "::1" || value === "::") return true;
  if (
    value.startsWith("fe80:") ||
    value.startsWith("fe90:") ||
    value.startsWith("fea0:") ||
    value.startsWith("feb0:")
  ) {
    return true;
  }
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  return false;
}

export function assertSafeExternalHttpUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("URL protocol must be http or https");
  }

  const hostname = parsed.hostname.trim().replace(/\.+$/, "").toLowerCase();
  if (!hostname) throw new Error("URL hostname is required");

  if (BLOCKED_HOSTS.has(hostname)) {
    throw new Error("Localhost and loopback URLs are not allowed");
  }
  if (
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Local network hostnames are not allowed");
  }
  if (/^\d+$/.test(hostname)) {
    throw new Error("Numeric hostnames are not allowed");
  }
  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error("Private network URLs are not allowed");
  }

  return parsed.toString();
}
