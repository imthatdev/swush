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
import { NextRequest } from "next/server";
import FileUnlockAndView, {
  FileDto,
} from "@/components/Files/FileUnlockAndView";
import ExternalLayout from "@/components/Common/ExternalLayout";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { formatBytes, isSpoilerLabel } from "@/lib/helpers";
import {
  applyEmbedTemplates,
  applyEmbedSettings,
  getEmbedSettingsByUserId,
  resolveEmbedThemeColor,
  resolveEmbedViewport,
} from "@/lib/server/embed-settings";
import { getFile as readFileBySlug } from "@/lib/api/files/read";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

type FileDtoLike = Omit<FileDto, "createdAt"> & {
  createdAt: string | Date | null;
};

async function buildFileReadRequest(slug: string) {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookieHeader = (await cookies()).toString();

  const base = `${proto}://${host ?? "localhost"}`;
  const url = new URL(`/api/v1/files/${encodeURIComponent(slug)}`, base);
  url.searchParams.set("include", "owner");

  const requestHeaders = new Headers();
  if (cookieHeader) requestHeaders.set("cookie", cookieHeader);

  return new NextRequest(url, {
    headers: requestHeaders,
  });
}

function normalizeFileDto(file: FileDtoLike): FileDto {
  return {
    ...file,
    createdAt:
      file.createdAt instanceof Date
        ? file.createdAt.toISOString()
        : (file.createdAt ?? ""),
  };
}

async function readFileDto(slug: string) {
  const req = await buildFileReadRequest(slug);
  const result = await readFileBySlug(req, slug);
  if (result.status !== 200) return null;
  return normalizeFileDto(result.body as FileDtoLike);
}

export async function generateMetadata({
  params,
}: {
  params: Params;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { appName, appUrl } = await getPublicRuntimeSettings();
  const defaultMetadata = await getDefaultMetadata();

  let file: FileDto | null = null;
  try {
    file = await readFileDto(slug);
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

  const anonymousActive = Boolean(file?.anonymousShareEnabled);
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
}: {
  params: Params;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Viewport> {
  const { slug } = await params;

  let file: FileDto | null = null;
  try {
    file = await readFileDto(slug);
  } catch {}

  const anonymousActive = Boolean(file?.anonymousShareEnabled);
  return resolveEmbedViewport(anonymousActive ? undefined : file?.userId);
}

type FileFetch = {
  data: FileDto | null;
  status: number;
  error?: string | null;
};

async function getFile(slug: string): Promise<FileFetch> {
  try {
    const req = await buildFileReadRequest(slug);
    const result = await readFileBySlug(req, slug);
    if (result.status !== 200) {
      const body = result.body as { message?: string } | undefined;
      return {
        data: null,
        status: result.status,
        error: body?.message ?? null,
      };
    }

    return {
      data: normalizeFileDto(result.body as FileDtoLike),
      status: 200,
      error: null,
    };
  } catch {
    return { data: null, status: 500, error: null };
  }
}

export default async function ViewFilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const { data: file, status, error } = await getFile(resolvedParams.slug);

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

  const anonymousActive = Boolean(file?.anonymousShareEnabled);
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
