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

import ExternalLayout from "@/components/Common/ExternalLayout";
import PublicWatchClient from "@/components/Watch/PublicWatchClient";
import { Suspense } from "react";
import React from "react";
import type { Metadata, Viewport } from "next";
import { shareUrl } from "@/lib/api/helpers";
import { apiV1Absolute } from "@/lib/api-path";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { db } from "@/db/client";
import { user } from "@/db/schemas";
import { eq } from "drizzle-orm";
import PublicOwnerHeader from "@/components/Common/PublicOwnerHeader";
import {
  applyEmbedTemplates,
  applyEmbedSettings,
  getEmbedSettingsByUserId,
  resolveEmbedViewport,
} from "@/lib/server/embed-settings";
import { notFound } from "next/navigation";

async function getData(username: string) {
  const { appUrl } = await getPublicRuntimeSettings();
  const res = await fetch(
    apiV1Absolute(appUrl, `/watchlist/p/${encodeURIComponent(username)}`),
    {
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  return res.json();
}

export type PublicWatchItem = {
  id: string;
  title: string;
  posterPath?: string | null;
  mediaType: "movie" | "tv" | "anime";
  rating?: number | null;
  notes?: string | null;
};

export type ProgressMap = Record<string, { season: number; episode: number }[]>;

type PublicUser = {
  id: string;
  username: string;
  displayName?: string | null;
  image?: string | null;
  bio?: string | null;
  verified?: boolean | null;
};

type PageData = {
  items: PublicWatchItem[];
  user: PublicUser;
  progress?: ProgressMap;
};

type Params = Promise<{ username: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const { appName, appUrl } = await getPublicRuntimeSettings();
  const base = appUrl || "";
  const canonical = base
    ? shareUrl("l", encodeURIComponent(username))
    : undefined;

  const title = `${username}’s Watchlist`;
  const description = `See what ${username} is watching movies, shows, and anime with ${appName}. Progress, seasons, and more.`;

  const baseMetadata = {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: `${username} on ${appName}`,
      type: "profile",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };

  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  const embedSettings = applyEmbedTemplates(
    await getEmbedSettingsByUserId(owner?.id, true),
    {
      username,
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
  const { username } = await params;
  const [owner] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username))
    .limit(1);
  return resolveEmbedViewport(owner?.id);
}

export default async function PublicWatchlistPage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;

  const data = (await getData(username)) as PageData | null;
  if (!data) return notFound();

  const { items, user, progress = {} } = data;
  const ownerName = user.displayName || user.username;

  return (
    <ExternalLayout>
      <div className="max-w-4xl md:min-w-4xl min-h-[60svh]">
        <h1 className="text-3xl font-bold capitalize">Watchlist</h1>
        <PublicOwnerHeader
          name={ownerName}
          username={user.username}
          image={user.image}
          bio={user.bio}
          verified={user.verified}
          userId={user.id}
          label="Shared by"
          className="mt-3 mb-6"
        />
        <Suspense>
          <PublicWatchClient initialItems={items} initialProgress={progress} />
        </Suspense>
      </div>
    </ExternalLayout>
  );
}
