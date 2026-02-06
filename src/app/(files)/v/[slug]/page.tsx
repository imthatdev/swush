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

import type { Metadata, Viewport } from "next";
import { getDefaultMetadata } from "@/lib/head";
import { notFound } from "next/navigation";
import { headers, cookies } from "next/headers";
import FileUnlockAndView, {
  FileDto,
} from "@/components/Files/FileUnlockAndView";
import ExternalLayout from "@/components/Common/ExternalLayout";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { formatBytes, isSpoilerLabel } from "@/lib/helpers";
import { apiV1Absolute } from "@/lib/api-path";
import {
  applyEmbedTemplates,
  applyEmbedSettings,
  getEmbedSettingsByUserId,
  resolveEmbedThemeColor,
  resolveEmbedViewport,
} from "@/lib/server/embed-settings";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ anon?: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const { anon } = await searchParams;
  const isAnonymous = ["1", "true", "yes"].includes((anon ?? "").toLowerCase());
  const { appName, appUrl } = await getPublicRuntimeSettings();
  const defaultMetadata = await getDefaultMetadata();

  let file: FileDto | null = null;
  try {
    const query = new URLSearchParams();
    if (!isAnonymous) query.set("include", "owner");
    if (isAnonymous) query.set("anon", "1");
    const res = await fetch(
      apiV1Absolute(appUrl, `/files/${slug}?${query.toString()}`),
      {
        cache: "no-store",
        headers: {
          "x-no-audit": "1",
          "x-audit-source": "metadata",
        },
      },
    );
    if (res.ok) file = (await res.json()) as FileDto;
  } catch {}

  const sizeText = ` I just wasted ${formatBytes(
    file && file.size ? file.size : 0,
  )} to show you this.`;
  const isLocked = !file || !file.isPublic || Boolean(file.hasPassword);
  const isSpoiler = Boolean(
    file &&
    ((Array.isArray(file.tags) && file.tags.some(isSpoilerLabel)) ||
      isSpoilerLabel(file.folderName)),
  );
  let ogImage;

  if (isLocked) {
    ogImage = `${appUrl}/images/lock.jpg`;
  } else if (isSpoiler) {
    ogImage = `${appUrl}/images/nsfw.jpg`;
  } else {
    ogImage = `${appUrl}/x/${slug}.png`;
  }

  const anonymousActive = isAnonymous || Boolean(file?.anonymousShareEnabled);
  const ownerUsername = anonymousActive ? undefined : file?.ownerUsername;
  const ownerDisplay = anonymousActive
    ? undefined
    : file?.ownerDisplayName || ownerUsername;
  const ownerSite = ownerUsername || ownerDisplay;
  const siteName = ownerSite ? `${ownerSite} on ${appName}` : appName;

  const baseMetadata = {
    ...defaultMetadata,
    title: sizeText,
    description: `View a shared file on ${appName}.`,
    robots: { index: false, follow: true },
    alternates: { canonical: `/v/${slug}` },
    other: isSpoiler
      ? {
          rating: "adult",
          "content-rating": "adult",
        }
      : undefined,
    openGraph: {
      title: sizeText,
      siteName: siteName,
      description: `View a shared file on ${appName} with ${file?.views ?? 0} views.`,
      url: `${appUrl}/v/${slug}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: isLocked ? "Locked file preview" : `${slug} preview`,
        },
      ],
    },
    twitter: {
      title: `${sizeText}`,
      description: `View a shared file on ${appName}.`,
      card: "summary_large_image",
      images: [ogImage],
      creator: "@imthatdevy",
      site: "@imthatdevy",
    },
  };

  const filename = file?.originalName ?? slug;
  const dotIndex = filename.lastIndexOf(".");
  const filenameBase = dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  const kind = file?.mimeType
    ? file.mimeType.startsWith("video/")
      ? "Video"
      : file.mimeType.startsWith("audio/")
        ? "Audio"
        : file.mimeType.startsWith("image/")
          ? "Image"
          : "File"
    : "File";
  const embedSettings = anonymousActive
    ? null
    : applyEmbedTemplates(await getEmbedSettingsByUserId(file?.userId), {
        name: filenameBase,
        file: filename,
        filename: filename,
        filename_base: filenameBase,
        filename_no_ext: filenameBase,
        kind,
        size: formatBytes(file?.size ?? 0),
        slug,
        username: ownerUsername ?? "",
        app: appName,
      });
  const canUseCustomImage =
    !!embedSettings?.imageUrl &&
    !isLocked &&
    !isSpoiler &&
    !!file &&
    !file.mimeType.startsWith("image/") &&
    !file.mimeType.startsWith("video/");
  const resolvedEmbedSettings =
    embedSettings && !canUseCustomImage
      ? { ...embedSettings, imageUrl: null }
      : embedSettings;
  return applyEmbedSettings(baseMetadata, resolvedEmbedSettings);
}

export async function generateViewport({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Viewport> {
  const { slug } = await params;
  const { anon } = await searchParams;

  const isAnonymous = ["1", "true", "yes"].includes((anon ?? "").toLowerCase());
  const { appUrl } = await getPublicRuntimeSettings();

  let file: FileDto | null = null;
  try {
    const query = new URLSearchParams();
    if (!isAnonymous) query.set("include", "owner");
    if (isAnonymous) query.set("anon", "1");
    const res = await fetch(
      apiV1Absolute(appUrl, `/files/${slug}?${query.toString()}`),
      {
        cache: "no-store",
        headers: {
          "x-no-audit": "1",
          "x-audit-source": "metadata",
        },
      },
    );
    if (res.ok) file = (await res.json()) as FileDto;
  } catch {}

  const anonymousActive = isAnonymous || Boolean(file?.anonymousShareEnabled);
  return resolveEmbedViewport(anonymousActive ? undefined : file?.userId);
}

type FileFetch = {
  data: FileDto | null;
  status: number;
  error?: string | null;
};

async function getFile(slug: string, anonymous: boolean): Promise<FileFetch> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (!host) return { data: null, status: 500 };

    const base = `${proto}://${host}`;
    const cookieHeader = (await cookies()).toString();
    const query = new URLSearchParams();
    if (!anonymous) query.set("include", "owner");
    if (anonymous) query.set("anon", "1");
    const res = await fetch(
      apiV1Absolute(base, `/files/${slug}?${query.toString()}`),
      {
        cache: "no-store",
        headers: { cookie: cookieHeader },
      },
    );

    if (!res.ok) {
      let error: string | null = null;
      try {
        const body = (await res.json()) as { message?: string } | null;
        error = body?.message ?? null;
      } catch {}
      return { data: null, status: res.status, error };
    }

    const data = (await res.json()) as FileDto;
    return { data, status: 200, error: null };
  } catch {
    return { data: null, status: 500, error: null };
  }
}

export default async function ViewFilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ anon?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const isAnonymous = ["1", "true", "yes"].includes(
    (resolvedSearchParams?.anon ?? "").toLowerCase(),
  );
  const {
    data: file,
    status,
    error,
  } = await getFile(resolvedParams.slug, isAnonymous);

  if (status === 404) {
    return notFound();
  }

  if (status === 403) {
    return (
      <ExternalLayout>
        <FileUnlockAndView
          slug={resolvedParams.slug}
          initialStatus={403}
          initialError={error ?? undefined}
        />
      </ExternalLayout>
    );
  }

  if (!file) notFound();

  const anonymousActive = isAnonymous || Boolean(file?.anonymousShareEnabled);
  const embedAccent = resolveEmbedThemeColor(
    anonymousActive ? null : await getEmbedSettingsByUserId(file?.userId),
  );

  return (
    <ExternalLayout>
      <FileUnlockAndView
        slug={resolvedParams.slug}
        initialStatus={status}
        initialFile={file}
        accentColor={embedAccent}
      />
    </ExternalLayout>
  );
}
