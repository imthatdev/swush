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

import { generateFunnySlug } from "@/lib/funny-slug";

export type VanitySlugKind = "shortLinks";

export async function resolveVanitySlug(params: {
  desired?: string | null;
  username?: string | null;
  role?: string | null;
  existingSlug?: string | null;
  kind: VanitySlugKind;
}) {
  const { desired, username, role, existingSlug, kind } = params;

  if (!desired || !desired.trim()) {
    return generateFunnySlug(kind);
  }

  const trimmed = desired.trim();
  if (role === "owner") return trimmed;

  const prefix = `${(username || "user").trim()}@`;
  if (existingSlug && trimmed === existingSlug) return trimmed;
  if (trimmed.startsWith(prefix)) return trimmed;
  return `${prefix}${trimmed}`;
}
