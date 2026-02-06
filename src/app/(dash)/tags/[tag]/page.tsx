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

import { db } from "@/db/client";
import { files, filesToTags, tags } from "@/db/schemas/core-schema";
import { eq, and } from "drizzle-orm";
import PageLayout from "@/components/Common/PageLayout";
import TagFilesClient from "@/components/Files/Tags/TagFilesClient";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";

type Params = Promise<{ tag: string }>;
type SearchParams = Promise<{ q?: string }>;
type TagFilesPageProps = {
  params: Params;
  searchParams?: SearchParams;
};

export async function generateMetadata({ params }: { params: Params }) {
  const { tag } = await params;
  const key = normalizeTagName(decodeURIComponent(tag || ""));
  const isUnfiled = key === "unfiled";

  if (isUnfiled) return { title: "Folder: (Unfiled)" };

  const folder = await db.query.tags.findFirst({
    where: eq(tags.name, key),
    columns: { name: true },
  });
  return { title: `Tag: ${formatTagName(folder?.name ?? "Unknown")}` };
}

export default async function TagFilesPage({
  params,
  searchParams,
}: TagFilesPageProps) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag || "");
  const normalizedTag = normalizeTagName(decodedTag);
  const sp = await searchParams;
  const q = (sp?.q ?? "").trim().toLowerCase();

  const tagRow = await db
    .select()
    .from(tags)
    .where(eq(tags.name, normalizedTag))
    .limit(1);
  if (!tagRow.length) {
    return <div className="p-6">Tag not found</div>;
  }

  const rows = await db
    .select({
      id: files.id,
      slug: files.slug,
      originalName: files.originalName,
      size: files.size,
      createdAt: files.createdAt,
      mimeType: files.mimeType,
      description: files.description,
    })
    .from(files)
    .innerJoin(filesToTags, eq(files.id, filesToTags.fileId))
    .where(and(eq(filesToTags.tagId, tagRow[0].id)));

  return (
    <PageLayout title={`Files tagged: #${formatTagName(decodedTag)}`}>
      <TagFilesClient tag={normalizedTag} initialItems={rows} initialQ={q} />
    </PageLayout>
  );
}
