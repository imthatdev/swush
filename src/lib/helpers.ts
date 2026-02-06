/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

import { Upload } from "@/types";
import { formatTagName } from "@/lib/tag-names";

export function splitFilename(name: string): { base: string; ext: string } {
  if (!name) return { base: "", ext: "" };
  if (name.startsWith(".") && !name.slice(1).includes(".")) {
    return { base: name, ext: "" };
  }
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === name.length - 1) {
    return { base: name, ext: "" };
  }
  return { base: name.slice(0, lastDot), ext: name.slice(lastDot) };
}

export function formatTagLabel(s: string) {
  return formatTagName(s);
}

export function folderNameOf(
  f: Upload &
    Partial<{
      folderName: string | null;
      folder: { name?: string | null } | null;
    }>,
): string | null {
  return f.folder?.name ?? f.folderName ?? null;
}

export function tagsOf(
  f: Upload & Partial<{ tags: (string | { name: string })[] }>,
): string[] {
  const list = Array.isArray(f.tags) ? f.tags : [];
  return list
    .map((t) => (typeof t === "string" ? t : t.name))
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

export function formatBytes(
  bytes: number,
  mode: "auto" | "bytes" | "metric" = "auto",
) {
  if (!bytes) return "0 B";
  if (mode === "bytes") return `${Math.round(bytes).toLocaleString()} B`;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const scale = mode === "metric" ? 1000 : 1024;
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(scale)),
    units.length - 1,
  );
  const val = bytes / Math.pow(scale, i);
  return `${val.toFixed(val < 10 && i > 0 ? 2 : 1)} ${units[i]}`;
}

export const normalize = (s: string) => s.trim().toLowerCase();

const SPOILER_TOKENS = [
  "nsfw",
  "adult",
  "explicit",
  "mature",
  "xxx",
  "18+",
  "+18",
  "18plus",
  "spoiler",
  "sensitive",
];

export function isSpoilerLabel(label?: string | null): boolean {
  if (!label) return false;
  const raw = normalize(label);
  if (!raw) return false;
  const compact = raw.replace(/[\s._-]+/g, "");
  return SPOILER_TOKENS.some(
    (token) =>
      raw.includes(token) || (compact !== raw && compact.includes(token)),
  );
}

export function isSpoilerFile(
  f: Upload &
    Partial<{
      folderName: string | null;
      folder: { name?: string | null } | null;
      tags: (string | { name: string })[];
    }>,
): boolean {
  const folder = folderNameOf(f);
  if (isSpoilerLabel(folder)) return true;
  const tagList = tagsOf(f);
  return tagList.some((t) => isSpoilerLabel(t));
}
