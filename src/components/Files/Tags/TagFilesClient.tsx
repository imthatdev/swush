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

"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes } from "@/lib/helpers";
import FilePreview from "@/components/Vault/FilePreview";
import { Button } from "@/components/ui/button";
import type { AudioTrackMeta } from "@/types/player";

type Item = {
  id: string;
  slug: string;
  originalName: string;
  size: number | null;
  createdAt: string | Date | null;
  mimeType: string | null;
  description: string | null;
  audioMeta?: AudioTrackMeta | null;
};

export default function TagFilesClient({
  tag,
  initialItems,
  initialQ = "",
}: {
  tag: string;
  initialItems: Item[];
  initialQ?: string;
}) {
  const [q, setQ] = useState(initialQ);

  useEffect(() => {
    const base = `/tags/${encodeURIComponent(tag)}`;
    const url = q.trim() ? `${base}?q=${encodeURIComponent(q.trim())}` : base;
    const current = window.location.pathname + window.location.search;
    if (current !== url) history.replaceState({}, "", url);
  }, [q, tag]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return initialItems;
    return initialItems.filter(
      (f) =>
        f.originalName.toLowerCase().includes(term) ||
        (f.description ? f.description.toLowerCase().includes(term) : false),
    );
  }, [initialItems, q]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        {items.length} file{items.length === 1 ? "" : "s"}
      </div>
      <div className="w-full">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search files"
          aria-label="Search files"
        />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? `No files match “${q}”.` : "No files with this tag."}
        </p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f, i) => (
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
                sizeBytes={f.size ?? 0}
                audioMeta={f.audioMeta ?? null}
              />

              <CardHeader className="flex justify-between p-1">
                <CardTitle
                  className="truncate text-base"
                  title={f.originalName}
                >
                  {f.originalName}
                </CardTitle>
                <span>{formatBytes(f.size ?? 0)}</span>
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
      )}
    </div>
  );
}
