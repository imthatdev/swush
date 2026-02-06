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

"use client";
import { IconFile, IconMusic } from "@tabler/icons-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import FilePreview from "@/components/Vault/FilePreview";
import { formatBytes } from "@/lib/helpers";
import { useRouter } from "next/navigation";
import { useLocalStorageString } from "@/hooks/use-local-storage";
import { isMedia } from "@/lib/mime-types";
import type { AudioTrackMeta } from "@/types/player";

export type FoldersGridItem = {
  id: string;
  slug: string;
  originalName: string;
  size: number;
  createdAt: Date | string | null;
  mimeType?: string | null;
  description?: string | null;
  audioMeta?: AudioTrackMeta | null;
};

type Props = {
  items: FoldersGridItem[];
};

export default function FoldersGridClient({ items }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const dq = useDeferredValue(query);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [viewMode, setViewMode] = useLocalStorageString(
    "swush.viewMode",
    "grid",
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName ?? "";
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = dq.trim().toLowerCase();
    if (!q) return items;
    return items.filter((f) => f.originalName.toLowerCase().includes(q));
  }, [items, dq]);

  if (!items || items.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No files in this folder.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files"
          className="w-full"
        />
        <Button
          type="button"
          variant={viewMode === "gallery" ? "default" : "outline"}
          onClick={() =>
            setViewMode((m) => (m === "grid" ? "gallery" : "grid"))
          }
        >
          {viewMode === "gallery" ? "Grid view" : "Gallery view"}
        </Button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No files match “{query}”.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {filtered.map((f, i) => (
            <Card
              key={f.id}
              className="overflow-hidden p-4 animate-fade-in-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <FilePreview
                src={`/x/${encodeURIComponent(f.slug)}`}
                hlsSrc={`/hls/${encodeURIComponent(f.slug)}/index.m3u8`}
                previewSrc={`/x/${encodeURIComponent(f.slug)}.png`}
                mime={f.mimeType ?? ""}
                name={f.originalName}
                slug={f.slug}
                sizeBytes={f.size}
                audioMeta={f.audioMeta ?? null}
              />

              <CardHeader className="flex flex-col justify-between p-1 ">
                <CardTitle className="text-base" title={f.originalName}>
                  {f.originalName}
                </CardTitle>
                <span>{formatBytes(f.size)}</span>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex items-center justify-between p-1">
                <span>
                  {f.createdAt ? new Date(f.createdAt).toLocaleString() : "ꕀ"}
                </span>
                {f.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {f.description}
                  </p>
                ) : null}
              </CardContent>
              <CardFooter className="flex items-center justify-between p-1">
                <span className="truncate text-xs">
                  {f.mimeType || "unknown"}
                </span>
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/vault?focusId=${encodeURIComponent(f.id)}`}>
                      Go to Vault
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/v/${encodeURIComponent(f.slug)}`}>View</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/x/${encodeURIComponent(f.slug)}`}>Raw</Link>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-4 [column-fill:balance]">
          {filtered.map((f, i) => (
            <Card
              key={f.id}
              onClick={() => router.push(`/v/${f.slug}`)}
              className="overflow-hidden p-0 mb-4 break-inside-avoid animate-fade-in-up rounded-sm cursor-pointer"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {isMedia("image", f.mimeType, f.originalName) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/x/${encodeURIComponent(f.slug)}`}
                  alt={f.originalName}
                  className="w-full h-auto object-contain"
                  loading="lazy"
                />
              ) : isMedia("audio", f.mimeType, f.originalName) ? (
                <div className="flex w-full items-center justify-center bg-muted aspect-video">
                  <IconMusic className="h-10 w-10 opacity-70" />
                </div>
              ) : (
                <div className="flex w-full items-center justify-center bg-muted aspect-video">
                  <IconFile className="h-10 w-10 opacity-70" />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
