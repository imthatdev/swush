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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import PublicOwnerHeader from "@/components/Common/PublicOwnerHeader";
import { DBBookmark } from "@/types/schema";
import { Badge } from "../ui/badge";
import { IconExternalLink, IconSearch, IconTag } from "@tabler/icons-react";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";
import { Skeleton } from "../ui/skeleton";
import { Input } from "../ui/input";
import { shareUrl } from "@/lib/api/helpers";
import { PaginationFooter } from "../Shared/PaginationFooter";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

type PublicBookmarksTagResponse = {
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    image?: string | null;
    bio?: string | null;
    verified?: boolean | null;
  };
  items: DBBookmark[];
  tagColors: Record<string, string | null>;
  total: number;
};

export default function SharedBookmarksTagClient({
  username,
  tag,
}: {
  username: string;
  tag: string;
}) {
  const [data, setData] = useState<PublicBookmarksTagResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [tagColors, setTagColors] = useState<Record<string, string | null>>({});
  const isInitialFetch = useRef(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const debouncedQ = useDebouncedValue(q, 500);
  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / pageSize));
  }, [data, pageSize]);

  const fetchList = useCallback(async () => {
    if (isInitialFetch.current) setLoading(true);
    setFetching(true);
    try {
      const qs = new URLSearchParams();
      qs.set("limit", String(pageSize));
      qs.set("offset", String((page - 1) * pageSize));
      if (debouncedQ.trim()) qs.set("q", debouncedQ.trim());
      const res = await fetch(
        apiV1(
          `/bookmarks/p/tags/${encodeURIComponent(username)}/${encodeURIComponent(tag)}${
            qs.toString() ? `?${qs.toString()}` : ""
          }`,
        ),
        { cache: "no-store" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Not found");
      setData(json);
      const normalizedColors: Record<string, string | null> = {};
      if (json?.tagColors && typeof json.tagColors === "object") {
        for (const [name, color] of Object.entries(
          json.tagColors as Record<string, string | null>,
        )) {
          const key = normalizeTagName(name);
          if (key) normalizedColors[key] = color ?? null;
        }
      }
      setTagColors(normalizedColors);
    } catch (err) {
      toast.error((err as Error).message || "Failed to load bookmarks");
      setData(null);
    } finally {
      setLoading(false);
      setFetching(false);
      isInitialFetch.current = false;
    }
  }, [tag, username, page, pageSize, debouncedQ]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, tag, username]);

  if (loading) {
    return (
      <div className="max-w-4xl w-full space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="max-w-3xl w-full text-sm">Not found.</div>;
  }

  const ownerName = data.user.displayName || data.user.username;
  const tagColor = tagColors?.[normalizeTagName(tag)];
  const tagStyles = getBadgeColorStyles(tagColor);
  const displayTag = formatTagName(tag);

  return (
    <div className="max-w-4xl w-full space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Bookmarks tagged</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={tagStyles?.className}
            style={tagStyles?.style}
          >
            <IconTag className="h-3.5 w-3.5" />
            {displayTag}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {data.total} public bookmark{data.total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search bookmarks..."
          className="pr-9"
        />
        <IconSearch
          className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors duration-300 ${
            fetching ? "animate-wiggle text-primary" : "text-muted-foreground"
          }`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="space-y-2">
              {item.slug ? (
                <Link
                  href={shareUrl("b", item.slug)}
                  className="inline-flex items-center gap-2 underline underline-offset-4"
                >
                  <CardTitle className="text-lg">
                    {item.title || "Bookmark"}
                  </CardTitle>
                  <IconExternalLink className="h-4 w-4" />
                </Link>
              ) : (
                <CardTitle className="text-lg">
                  {item.title || "Bookmark"}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title || "Bookmark"}
                  className="w-full max-h-48 object-cover rounded-md border"
                  loading="lazy"
                />
              ) : null}
              <Link
                href={item.url}
                target="_blank"
                className="text-primary underline break-all"
              >
                {item.url}
              </Link>
              {item.description ? (
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
              {Array.isArray(item.tags) && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.tags.map((t: string) => {
                    const key = normalizeTagName(t);
                    const styles = getBadgeColorStyles(tagColors?.[key]);
                    return (
                      <Badge
                        key={t}
                        variant="outline"
                        className={styles?.className}
                        style={styles?.style}
                      >
                        <IconTag className="h-3.5 w-3.5" />
                        {formatTagName(t)}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <PaginationFooter
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
      <PublicOwnerHeader
        name={ownerName}
        username={data.user.username}
        image={data.user.image}
        bio={data.user.bio}
        verified={data.user.verified}
        userId={data.user.id}
        label="Shared by"
      />
    </div>
  );
}
