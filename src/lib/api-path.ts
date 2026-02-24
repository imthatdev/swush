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

export const API_V1_BASE = "/api/v1";

function normalizeApiPath(path: string) {
  const raw = path.trim();
  if (!raw) return "";

  if (/^[a-z][a-z\d+\-.]*:/i.test(raw) || raw.startsWith("//")) {
    return "";
  }

  if (raw.startsWith(API_V1_BASE)) {
    const rest = raw.slice(API_V1_BASE.length);
    if (!rest) return "";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function apiV1(path: string) {
  const normalized = normalizeApiPath(path);
  return normalized ? `${API_V1_BASE}${normalized}` : API_V1_BASE;
}

function encodeApiSegment(value: string | number) {
  return encodeURIComponent(String(value));
}

export function apiV1Path(
  path: string,
  ...segments: Array<string | number | null | undefined>
) {
  const normalized = normalizeApiPath(path);
  const stripped = normalized.replace(/\/+$/, "");
  const base = stripped ? `${API_V1_BASE}${stripped}` : API_V1_BASE;
  const encoded = segments
    .filter(
      (segment): segment is string | number =>
        segment !== null && segment !== undefined,
    )
    .map((segment) => encodeApiSegment(segment))
    .filter(Boolean);
  return encoded.length ? `${base}/${encoded.join("/")}` : base;
}

export function apiV1Absolute(base: string | null | undefined, path: string) {
  const relative = apiV1(path);
  if (!base) return relative;
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}
