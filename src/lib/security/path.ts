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

import path from "path";

export function resolveWithin(base: string, ...segments: string[]) {
  const normalizedBase = path.normalize(base);
  const sanitized = segments
    .flatMap((segment) =>
      segment
        .replace(/^[\\/]+/, "")
        .split(/[\\/]+/)
        .filter(Boolean),
    )
    .map((part) => {
      if (part === "." || part === "..") {
        throw new Error("Path traversal detected");
      }
      return part;
    });
  const normalized = path.normalize(
    [normalizedBase, ...sanitized].join(path.sep),
  );
  const basePrefix = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : `${normalizedBase}${path.sep}`;
  if (normalized !== normalizedBase && !normalized.startsWith(basePrefix)) {
    throw new Error("Path traversal detected");
  }
  return normalized;
}
