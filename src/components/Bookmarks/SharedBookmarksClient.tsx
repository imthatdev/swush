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

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import { apiV1 } from "@/lib/api-path";
import { DBBookmark } from "@/types/schema";
import PublicOwnerHeader from "@/components/Common/PublicOwnerHeader";
import { Badge } from "../ui/badge";
import { IconTag } from "@tabler/icons-react";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";
import { useSearchParams } from "next/navigation";

type PublicBookmark = DBBookmark & {
  ownerUsername?: string | null;
  ownerDisplayName?: string | null;
  ownerImage?: string | null;
  ownerBio?: string | null;
  ownerVerified?: boolean | null;
};

export default function SharedBookmarksClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const isAnonymous = ["1", "true", "yes"].includes(
    (searchParams.get("anon") || "").toLowerCase(),
  );
  const [data, setData] = useState<PublicBookmark | null>(null);
  const anonymousActive = isAnonymous || data?.anonymousShareEnabled === true;
  const [tagColors, setTagColors] = useState<Record<string, string | null>>({});
  const [protectedFlag, setProtectedFlag] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchBookmark = useCallback(
    async (pw?: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          apiV1(`/bookmarks/p/${slug}${isAnonymous ? "?anon=1" : ""}`),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pw ? { password: pw } : {}),
            cache: "no-store",
          },
        );
        const js = await res.json();
        if (!res.ok) {
          if (res.status === 401) setProtectedFlag(true);
          else toast.error(js?.error || "Not found");
          setData(null);
        } else {
          setData(js.data);
          const normalizedColors: Record<string, string | null> = {};
          if (js.tagColors && typeof js.tagColors === "object") {
            for (const [name, color] of Object.entries(
              js.tagColors as Record<string, string | null>,
            )) {
              const key = normalizeTagName(name);
              if (key) normalizedColors[key] = color ?? null;
            }
          }
          setTagColors(normalizedColors);
          setProtectedFlag(false);
        }
      } catch {
        toast.error("Failed to load bookmark");
      } finally {
        setLoading(false);
      }
    },
    [slug, isAnonymous],
  );

  useEffect(() => {
    fetchBookmark();
  }, [slug, fetchBookmark]);

  if (loading)
    return (
      <div className="max-w-3xl w-full">
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );

  if (protectedFlag) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3 text-center">
        <h1 className="text-xl font-semibold">This bookmark is protected</h1>
        <div className="flex gap-2 justify-center">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button onClick={() => fetchBookmark(password)}>Unlock</Button>
        </div>
      </div>
    );
  }

  if (!data?.isPublic) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">This file is private</h2>
        <p className="text-muted-foreground mb-4">
          Please ask the owner to make it public and add a password or so.
        </p>
      </div>
    );
  }

  if (!data) return <div className="p-6 text-sm">Bookmark not found.</div>;

  return (
    <Card className="max-w-3xl w-full">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl font-bold flex items-center gap-2">
          {data.title || "Bookmark"}
          <Badge variant="outline">
            {data.views} view{data.views === 1 ? "" : "s"}
          </Badge>
        </CardTitle>
        <PublicOwnerHeader
          name={data.ownerDisplayName || data.ownerUsername}
          username={data.ownerUsername}
          image={data.ownerImage}
          bio={data.ownerBio}
          verified={data.ownerVerified}
          userId={data.userId}
          label="Shared by"
          anonymous={anonymousActive}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        {data.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.imageUrl}
            alt={data.title || "Bookmark"}
            className="w-full max-h-44 object-cover rounded-md border"
            loading="lazy"
          />
        ) : null}
        <Link
          href={data.url}
          target="_blank"
          className="text-primary underline break-all"
        >
          {data.url}
        </Link>
        {data.description ? (
          <p className="text-sm text-muted-foreground">{data.description}</p>
        ) : null}
        {Array.isArray(data.tags) && data.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {data.tags.map((t: string) => {
              const key = normalizeTagName(t);
              const styles = getBadgeColorStyles(tagColors?.[key]);
              return (
                <Badge
                  key={t}
                  variant="outline"
                  className={cn("text-xs", styles?.className)}
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
  );
}
