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
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";

const buildDefaultMetadata = (appName: string, appUrl?: string): Metadata => {
  const metadataBase = appUrl ? new URL(appUrl) : undefined;
  return {
    metadataBase,
    title: appName,
    description: "Share files privately, securely, and beautifully with Swush.",
    applicationName: appName,
    icons: {
      icon: [
        {
          url: "/images/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/images/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: "/images/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        },
      ],
    },
    authors: [
      { name: "Laith Alkhaddam (Iconical)", url: "https://iconical.dev" },
    ],
    manifest: "/manifest.webmanifest",
    keywords: ["file sharing", "secure upload", "Swush", "privacy"],
    openGraph: {
      title: appName,
      description:
        "Share files privately, securely, and beautifully with Swush.",
      url: appUrl ?? "",
      siteName: appName,
      images: [
        {
          url: "/images/og-image.png",
          width: 1200,
          height: 630,
          alt: appName,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: appName,
      description:
        "Share files privately, securely, and beautifully with Swush.",
      images: ["/images/og-image.png"],
      creator: "@imthatdevy",
      site: "@imthatdevy",
    },
    appleWebApp: {
      title: appName,
      capable: true,
      statusBarStyle: "default",
    },
  };
};

export const defaultMetadata = async function (): Promise<Metadata> {
  const { appUrl, appName } = await getPublicRuntimeSettings();
  return buildDefaultMetadata(appName, appUrl);
};

export async function getDefaultMetadata(): Promise<Metadata> {
  const { appUrl, appName } = await getPublicRuntimeSettings();
  return buildDefaultMetadata(appName, appUrl);
}

export const defaultViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#604198",
};
