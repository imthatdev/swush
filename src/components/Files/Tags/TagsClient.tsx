/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

"use client";
import { IconTag } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState, useEffect, useCallback } from "react";
import TagsSearch from "@/components/Files/Tags/TagsSearch";
import TagActions from "./TagsActions";
import TagCreateDialog from "./TagCreateDialog";
import PageLayout from "@/components/Common/PageLayout";
import { formatBytes } from "@/lib/helpers";
import { apiV1 } from "@/lib/api-path";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { formatTagName } from "@/lib/tag-names";

export type TagItem = {
  id: string;
  name: string;
  color?: string | null;
  fileCount: number;
  totalSize: number;
};

export default function TagsClient() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(apiV1("/tags"), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const hasAny = items.length > 0;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter((t) => t.name.toLowerCase().includes(query));
  }, [items, q]);

  return (
    <PageLayout
      title="Tags"
      subtitle="Browse and manage your tags. Click to view files."
      headerActions={<TagCreateDialog onCreated={fetchTags} />}
      toolbar={
        <TagsSearch defaultValue="" onChange={setQ} className="w-full" />
      }
    >
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading tags…</div>
      ) : !hasAny ? (
        <div className="text-sm text-muted-foreground">
          You don’t have any tags yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No tags match “{q}”.
        </div>
      ) : (
        <div className="grid gap-2 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tag) => (
            <div
              key={tag.id}
              className="rounded-lg border p-4 bg-muted/30 hover:bg-muted/60 transition flex justify-between"
            >
              <div className="flex flex-col justify-center">
                {(() => {
                  const colorStyles = getBadgeColorStyles(tag.color);
                  return (
                    <Link href={`/tags/${encodeURIComponent(tag.name)}`} className="inline-flex">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
                          colorStyles?.className ?? "border-border bg-muted/40"
                        )}
                        style={colorStyles?.style}
                      >
                        <IconTag size={16} />
                        #{formatTagName(tag.name)}
                      </span>
                    </Link>
                  );
                })()}
                <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between gap-1">
                  <span>
                    {tag.fileCount} file{tag.fileCount === 1 ? "" : "s"}
                  </span>
                  -
                  <span>{formatBytes(tag.totalSize || 0)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <TagActions
                  tagId={tag.id}
                  tagName={tag.name}
                  tagColor={tag.color ?? null}
                  onUpdated={(next) => {
                    setItems((prev) =>
                      [...prev]
                        .map((item) =>
                          item.id === next.id
                            ? { ...item, name: next.name, color: next.color }
                            : item
                        )
                        .sort((a, b) => a.name.localeCompare(b.name))
                    );
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
