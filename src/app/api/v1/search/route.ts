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

import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { getCurrentUser } from "@/lib/client/user";
import { db } from "@/db/client";
import { files } from "@/db/schemas/core-schema";
import { and, or, ilike, eq } from "drizzle-orm";
import type { AnyColumn, SQL } from "drizzle-orm";
import { withApiError } from "@/lib/server/api-error";

export const GET = withApiError(async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ groups: [] });

  const ip = getClientIp(req);
  const ipRL = await rateLimit({
    key: `ip:${ip}:global-search`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? 30;
    const res = NextResponse.json(
      { message: `Slow down. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const buildPatterns = (input: string, maxVariants = 7) => {
    const base = input.trim();
    if (!base) return [] as string[];
    const variants = new Set<string>([base]);
    if (base.length >= 4) {
      for (let i = 0; i < base.length && variants.size < maxVariants; i += 1) {
        const variant = `${base.slice(0, i)}${base.slice(i + 1)}`;
        if (variant.length >= 2) variants.add(variant);
      }
      for (
        let i = 0;
        i < base.length - 1 && variants.size < maxVariants;
        i += 1
      ) {
        const arr = base.split("");
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        variants.add(arr.join(""));
      }
    }
    return Array.from(variants);
  };

  const patterns = buildPatterns(q);
  const likeAny = (column: AnyColumn | SQL) => {
    if (!patterns.length) return ilike(column, `%${q}%`);
    const likeParts = patterns.map((pattern) => ilike(column, `%${pattern}%`));
    return likeParts.length === 1 ? likeParts[0] : or(...likeParts);
  };

  const take = 5;
  const [fileRows] = await Promise.all([
    db.query.files.findMany({
      where: and(
        eq(files.userId, user.id),
        or(likeAny(files.originalName), likeAny(files.slug)),
      ),
      columns: {
        id: true,
        originalName: true,
        slug: true,
        isFavorite: true,
      },
      limit: take,
    }),
  ]);

  const groups = [
    {
      label: "Files",
      items: fileRows.map((f) => ({
        id: f.id,
        title: f.originalName as string,
        subtitle: f.slug as string,
        type: "file",
        isFavorite: Boolean(f.isFavorite),
        slug: f.slug as string,
        href: `/vault?focusId=${f.id}`,
      })),
    },
  ].filter((g) => g.items.length);

  return NextResponse.json({ groups });
});
