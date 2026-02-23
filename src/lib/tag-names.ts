/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http://www.apache.org/licenses/LICENSE-2.0

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

export function normalizeTagName(input: string): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export function formatTagName(input: string): string {
  const normalized = normalizeTagName(input);
  if (!normalized) return "";
  return normalized.replace(/(^|[\s-])([a-z])/g, (match, sep, ch) => {
    return `${sep}${String(ch).toUpperCase()}`;
  });
}
