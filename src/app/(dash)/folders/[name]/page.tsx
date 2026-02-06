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
import { files, folders } from "@/db/schemas/core-schema";
import { eq, isNull, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/client/user";
import { FolderActions } from "@/components/Files/Folders/FoldersActions";
import PageLayout from "@/components/Common/PageLayout";
import FolderGridClient from "@/components/Files/Folders/FoldersGridClient";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

type Params = Promise<{ name: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { name } = await params;
  const key = decodeURIComponent(name || "");
  const isUnfiled = key.toLowerCase() === "unfiled";

  if (isUnfiled) return { title: "Folder: (Unfiled)" };

  const user = await getCurrentUser();
  if (!user) return { title: "Folder" };

  const folder = await db.query.folders.findFirst({
    where: and(eq(folders.userId, user.id), eq(folders.name, key)),
    columns: { id: true, name: true },
  });
  if (!folder) {
    const byId = await db.query.folders.findFirst({
      where: and(eq(folders.userId, user.id), eq(folders.id, key)),
      columns: { name: true },
    });
    return { title: `Folder: ${byId?.name ?? "Unknown"}` };
  }
  return { title: `Folder: ${folder?.name ?? "Unknown"}` };
}

export default async function FolderDetailPage({ params }: { params: Params }) {
  const { name } = await params;

  const user = await getCurrentUser();
  if (!user) notFound();
  const key = decodeURIComponent(name || "");
  const isUnfiled = key.toLowerCase() === "unfiled";

  let headerName = "(Unfiled)";
  let shareEnabled = false;
  let shareHasPassword = false;
  let shareSlug: string | null = null;
  let folderId = key;
  if (!isUnfiled) {
    const folder =
      (await db.query.folders.findFirst({
        where: and(eq(folders.userId, user.id), eq(folders.name, key)),
        columns: {
          id: true,
          name: true,
          shareEnabled: true,
          sharePassword: true,
          shareSlug: true,
        },
      })) ||
      (await db.query.folders.findFirst({
        where: and(eq(folders.userId, user.id), eq(folders.id, key)),
        columns: {
          id: true,
          name: true,
          shareEnabled: true,
          sharePassword: true,
          shareSlug: true,
        },
      }));
    if (!folder) {
      notFound();
    }
    headerName = folder?.name ?? "Unknown";
    folderId = folder?.id ?? key;
    shareEnabled = folder?.shareEnabled ?? false;
    shareHasPassword = Boolean(folder?.sharePassword);
    shareSlug = folder?.shareSlug ?? null;
  }

  const rows = await db.query.files.findMany({
    where: isUnfiled
      ? and(isNull(files.folderId), eq(files.userId, user.id))
      : and(eq(files.folderId, folderId), eq(files.userId, user.id)),
    orderBy: (f, { desc }) => [desc(f.createdAt)],
    columns: {
      id: true,
      slug: true,
      originalName: true,
      size: true,
      createdAt: true,
      mimeType: true,
    },
  });

  return (
    <PageLayout
      title={`Folder: ${headerName}`}
      subtitle={`${rows.length} file${rows.length === 1 ? "" : "s"}`}
      headerActionsClassName="flex flex-col md:flex-row items-start gap-3"
      headerActions={
        <div className="flex gap-2 items-center justify-between w-full">
          <Button href="/folders" variant="outline">
            ← Back to folders
          </Button>
          <div className="flex items-center gap-3">
            {!isUnfiled && (
              <FolderActions
                folderId={folderId}
                folderName={headerName}
                disabled={isUnfiled}
                shareEnabled={shareEnabled}
                shareHasPassword={shareHasPassword}
                shareSlug={shareSlug}
              />
            )}
          </div>
        </div>
      }
    >
      <FolderGridClient items={rows} />
    </PageLayout>
  );
}
