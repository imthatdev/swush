/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
 *   All rights reserved.

 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at

 *   http:

 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

import { getCurrentUser } from "@/lib/client/user";
import { getDefaultMetadata } from "@/lib/head";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import VaultClient from "@/components/Vault/VaultClient";
import { listFilesForUser } from "@/lib/api/files/list";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const defaultMetadata = await getDefaultMetadata();
  return {
    ...defaultMetadata,
    title: "Vault",
  };
}

type SearchParams = Promise<{
  q?: string;
  folder?: string;
  tag?: string | string[];
  tags?: string;
  favorite?: string;
  kind?: string;
  visibility?: string;
  page?: string;
  pageSize?: string;
  sort?: string;
  gallery?: string;
  focusId?: string;
}>;

async function parseTags({ sp }: { sp: SearchParams }) {
  const { tags, tag } = await sp;
  if (!sp) return [];
  const rawTags = tags ? tags.split(",") : [];
  const tagParam = tag;
  const tagList = Array.isArray(tagParam)
    ? tagParam
    : tagParam
      ? [tagParam]
      : [];
  return [...rawTags, ...tagList].map((t) => t.trim()).filter(Boolean);
}

export default async function VaultServer({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  const {
    visibility: spVisibility,
    q,
    folder,
    page,
    pageSize,
    sort,
    favorite,
    kind,
  } = await searchParams;

  if (!user) {
    redirect("/login?next=/vault");
  }

  const visibility: "public" | "private" | null =
    spVisibility === "public" || spVisibility === "private"
      ? spVisibility
      : null;

  const query = {
    q,
    folder: folder ?? null,
    tags: await parseTags({ sp: searchParams }),
    favorites: favorite === "1",
    kind,
    visibility,
    page: Number(page || "") || 1,
    pageSize: Number(pageSize || "") || undefined,
    sort,
    fields: "summary" as const,
    warm: true,
  };

  const list = await listFilesForUser(user.id, query);

  return (
    <VaultClient
      user={user}
      initialItems={list.items.map((item) => ({
        ...item,
        maxViewsAction:
          item.maxViewsAction === "make_private" ||
          item.maxViewsAction === "delete" ||
          item.maxViewsAction == null
            ? item.maxViewsAction
            : undefined,
      }))}
      initialTotal={list.total}
      initialPage={list.page}
      initialPageSize={list.pageSize}
    />
  );
}
