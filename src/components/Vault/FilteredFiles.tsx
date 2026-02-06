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

import { folderNameOf, tagsOf } from "@/lib/helpers";
import { Upload } from "@/types";
import { useMemo } from "react";

export function useFilteredFiles(
  files: Upload[],
  {
    query,
    folder,
    tags,
    favorites,
    mimeKinds,
    visibility,
  }: {
    query: string;
    folder: string | null;
    tags: string[];
    favorites: boolean;
    mimeKinds: string[];
    visibility: "public" | "private" | null;
  },
) {
  const normalize = (s: string) => s.trim().toLowerCase();
  const normalizedQuery = normalize(query);
  const normalizedKinds = mimeKinds.map(normalize);

  const resolveKind = (mime: string, name: string) => {
    const lowerName = name.toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    if (mime === "application/pdf") return "pdf";
    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/xml" ||
      mime === "application/javascript" ||
      /\.txt$/i.test(lowerName)
    )
      return "text";
    if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(lowerName)) return "image";
    if (/\.(mp4|webm|mov|mkv|avi|mpeg)$/i.test(lowerName)) return "video";
    if (/\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(lowerName)) return "audio";
    if (/\.pdf$/i.test(lowerName)) return "pdf";
    return "other";
  };

  return useMemo(() => {
    return files.filter((f) => {
      const matchesQuery =
        !normalizedQuery ||
        f.originalName.toLowerCase().includes(normalizedQuery) ||
        (f.slug ?? "").toLowerCase().includes(normalizedQuery) ||
        (f.description ?? "").toLowerCase().includes(normalizedQuery);

      const matchesFolder =
        !folder || folderNameOf(f)?.toLowerCase() === folder.toLowerCase();
      const matchesTags =
        !tags.length || tags.some((t) => tagsOf(f).map(normalize).includes(t));
      const matchesFavorites = !favorites || f.isFavorite;
      const isPublic = Boolean(f.isPublic);
      const matchesVisibility =
        !visibility || (visibility === "public" ? isPublic : !isPublic);
      const resolvedKind = resolveKind(f.mimeType ?? "", f.originalName ?? "");
      const matchesKinds =
        normalizedKinds.length === 0 ||
        normalizedKinds.some((kind) =>
          kind === "media"
            ? ["image", "video", "audio"].includes(resolvedKind)
            : kind === resolvedKind,
        );
      return (
        matchesQuery &&
        matchesFolder &&
        matchesTags &&
        matchesFavorites &&
        matchesVisibility &&
        matchesKinds
      );
    });
  }, [
    files,
    normalizedQuery,
    folder,
    tags,
    favorites,
    visibility,
    normalizedKinds,
  ]);
}
