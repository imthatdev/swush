/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

import ExternalLayout from "@/components/Common/ExternalLayout";
import SharedFolderClient from "@/components/Files/Folders/SharedFolderClient";
import { db } from "@/db/client";
import { folders, user } from "@/db/schemas";
import { shareUrl } from "@/lib/api/helpers";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { getDefaultMetadata } from "@/lib/head";
import type { Metadata, Viewport } from "next";
import {
  applyEmbedSettings,
  applyEmbedTemplates,
  getEmbedSettingsByUserId,
  resolveEmbedViewport,
} from "@/lib/server/embed-settings";
import { eq, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const key = decodeURIComponent(slug || "");
  const { appName, appUrl } = await getPublicRuntimeSettings();
  const defaultMetadata = await getDefaultMetadata();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key,
    );

  const folder = await db
    .select({
      id: folders.id,
      userId: folders.userId,
      name: folders.name,
      shareEnabled: folders.shareEnabled,
      sharePassword: folders.sharePassword,
      shareSlug: folders.shareSlug,
    })
    .from(folders)
    .where(
      isUuid
        ? or(eq(folders.id, key), eq(folders.shareSlug, key))
        : eq(folders.shareSlug, key),
    )
    .limit(1);

  const isAvailable = Boolean(folder[0]?.shareEnabled);
  const isProtected = Boolean(folder[0]?.sharePassword);
  const shareKey = folder[0]?.shareSlug ?? key;
  const canonical = appUrl ? shareUrl("f", shareKey) : undefined;

  let title = `${appName} • Shared folder`;
  let description = `Open a shared folder on ${appName}.`;

  if (isAvailable && isProtected) {
    title = `Protected folder on ${appName}`;
    description = `This shared folder is protected by a password.`;
  } else if (isAvailable && folder[0]?.name) {
    title = `${folder[0].name} · Shared folder`;
    description = `View this folder on ${appName}.`;
  }

  const baseMetadata: Metadata = {
    ...defaultMetadata,
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      ...(defaultMetadata.openGraph ?? {}),
      title,
      description,
      url: canonical,
      siteName: appName,
    },
    twitter: {
      ...(defaultMetadata.twitter ?? {}),
      title,
      description,
    },
  };

  if (!isAvailable) return baseMetadata;
  if (!folder[0]?.userId || isProtected) return baseMetadata;

  const [owner] = await db
    .select({
      username: user.username,
      displayUsername: user.displayUsername,
      name: user.name,
    })
    .from(user)
    .where(eq(user.id, folder[0].userId))
    .limit(1);
  const ownerName =
    owner?.name || owner?.displayUsername || owner?.username || "";
  const embedSettings = applyEmbedTemplates(
    await getEmbedSettingsByUserId(folder[0].userId, true),
    {
      app: appName,
      username: ownerName,
      folder: folder[0]?.name ?? "",
      slug: shareKey,
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
  const key = decodeURIComponent(slug || "");
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      key,
    );
  const folder = await db
    .select({ userId: folders.userId, shareEnabled: folders.shareEnabled })
    .from(folders)
    .where(
      isUuid
        ? or(eq(folders.id, key), eq(folders.shareSlug, key))
        : eq(folders.shareSlug, key),
    )
    .limit(1);
  if (!folder[0]?.shareEnabled) return {};
  return resolveEmbedViewport(folder[0]?.userId);
}

export default async function SharedFolderPage({ params }: { params: Params }) {
  const { slug } = await params;
  const folderId = decodeURIComponent(slug || "");

  return (
    <ExternalLayout>
      <SharedFolderClient folderId={folderId} />
    </ExternalLayout>
  );
}
