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

import SharedBookmarksClient from "@/components/Bookmarks/SharedBookmarksClient";
import ExternalLayout from "@/components/Common/ExternalLayout";
import { getPublicBookmarkBySlug } from "@/lib/api/bookmarks";
import { shareUrl } from "@/lib/api/helpers";
import { getDefaultMetadata } from "@/lib/head";
import { Metadata, Viewport } from "next";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import {
  applyEmbedTemplates,
  applyEmbedSettings,
  getEmbedSettingsByUserId,
  resolveEmbedViewport,
} from "@/lib/server/embed-settings";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const note = await getPublicBookmarkBySlug(slug);
  const { appName, appUrl, sharingDomain } = await getPublicRuntimeSettings();
  const defaultMetadata = await getDefaultMetadata();
  const shareBase = sharingDomain || appUrl || "";

  let title: string;
  let description: string;

  if (note?.passwordHash) {
    title = "Private Bookmark";
    description = "The content is private";
  } else {
    title = `Bookmark: ${note?.title ?? "Unavailable Bookmark"}`;
    description = note?.description ?? "The content is unavailable";
  }

  let ogImage: string;
  if (note?.isPublic) {
    ogImage = `${shareBase}/images/lock.jpg`;
  } else if (note?.passwordHash) {
    ogImage = "";
  } else {
    ogImage = note?.imageUrl ?? "";
  }

  const siteName = note?.ownerDisplayName
    ? `${note?.ownerDisplayName} on ${appName}`
    : undefined;
  const baseMetadata = {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      title,
      description,
      siteName,
      url: shareUrl("b", slug, { appUrl, sharingDomain }),
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: note?.isPublic ? "Locked file preview" : `${slug} preview`,
        },
      ],
    },
  };

  const embedSettings = applyEmbedTemplates(
    await getEmbedSettingsByUserId(note?.userId, true),
    {
      title: note?.title ?? "",
      slug,
      username: note?.ownerDisplayName ?? "",
      app: appName,
    },
  );
  return applyEmbedSettings(baseMetadata, embedSettings);
}

export async function generateViewport({
  params,
}: {
  params: Params;
}): Promise<Viewport> {
  const { slug } = await params;
  const note = await getPublicBookmarkBySlug(slug);
  return resolveEmbedViewport(note?.userId);
}

export default async function SharedBookmarksServer({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;

  return (
    <ExternalLayout>
      <SharedBookmarksClient slug={slug} />
    </ExternalLayout>
  );
}
