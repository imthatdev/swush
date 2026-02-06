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

type ApiKeyScopeDefinition = {
  id: string;
  label: string;
  description: string;
};

export const API_KEY_SCOPES = [
  {
    id: "all",
    label: "Everything",
    description: "Full access to the API key allowlist.",
  },
  {
    id: "upload",
    label: "Uploads",
    description: "Upload and list files.",
  },
  {
    id: "shorten",
    label: "Shorten",
    description: "Create short links.",
  },
  {
    id: "bookmarks",
    label: "Bookmarks",
    description: "Create and manage bookmarks.",
  },
  {
    id: "notes",
    label: "Notes",
    description: "Create and manage notes.",
  },
  {
    id: "avatar",
    label: "Avatar upload",
    description: "Upload a profile avatar.",
  },
] satisfies ApiKeyScopeDefinition[];

export const DEFAULT_API_KEY_SCOPES = ["all"] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]["id"];

const KNOWN_SCOPE_SET = new Set(API_KEY_SCOPES.map((scope) => scope.id));

export function serializeApiKeyScopes(scopes: ApiKeyScope[]) {
  return JSON.stringify(scopes);
}

export function normalizeApiKeyScopes(
  raw?: string | Record<string, unknown> | null,
): Set<string> {
  if (!raw) return new Set(DEFAULT_API_KEY_SCOPES);

  if (typeof raw === "object") {
    const keys = Object.keys(raw).filter(Boolean);
    return keys.length ? new Set(keys) : new Set(DEFAULT_API_KEY_SCOPES);
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const items = parsed.map((item) => String(item)).filter(Boolean);
      return items.length ? new Set(items) : new Set(DEFAULT_API_KEY_SCOPES);
    }
    if (
      parsed &&
      typeof parsed === "object" &&
      "scopes" in parsed &&
      Array.isArray((parsed as { scopes?: unknown }).scopes)
    ) {
      const items = (parsed as { scopes?: unknown[] }).scopes
        ?.map((item) => String(item))
        .filter(Boolean);
      return items?.length ? new Set(items) : new Set(DEFAULT_API_KEY_SCOPES);
    }
    if (parsed && typeof parsed === "object") {
      const keys = Object.keys(parsed as Record<string, unknown>).filter(
        Boolean,
      );
      return keys.length ? new Set(keys) : new Set(DEFAULT_API_KEY_SCOPES);
    }
  } catch {
    // Fall through to comma parsing.
  }

  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? new Set(items) : new Set(DEFAULT_API_KEY_SCOPES);
}

export function sanitizeApiKeyScopes(scopes: string[]) {
  const filtered = scopes.filter((scope) => KNOWN_SCOPE_SET.has(scope));
  return filtered.length ? filtered : Array.from(DEFAULT_API_KEY_SCOPES);
}

export function hasRequiredApiKeyScopes(
  assignedScopes: Set<string>,
  requiredScopes?: string[],
) {
  if (!requiredScopes || requiredScopes.length === 0) return true;
  if (assignedScopes.has("all") || assignedScopes.has("*")) return true;
  return requiredScopes.every((scope) => assignedScopes.has(scope));
}
