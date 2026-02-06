/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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
import { JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/Providers/ThemeProvider";
import { AppConfigProvider } from "@/components/Providers/AppConfigProvider";
import PostHogProvider from "@/components/Providers/PostHogProvider";
import ZodCspPatch from "@/components/Providers/ZodCspPatch";
import ServiceWorkerRegister from "@/components/PWA/ServiceWorkerRegister";
import Toaster from "@/components/ui/sonner";
import { defaultViewport, getDefaultMetadata } from "@/lib/head";
import UserCommandGate from "@/components/Common/UserCommandGate";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { Suspense } from "react";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  return getDefaultMetadata();
}

export const viewport: Viewport = {
  ...defaultViewport,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicSettings = await getPublicRuntimeSettings();
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${jetBrainsMono.variable} font-sans antialiased scroll-smooth`}
      >
        <ThemeProvider>
          <AppConfigProvider value={publicSettings}>
            <Suspense fallback={null}>
              <PostHogProvider>
                <ZodCspPatch />
                <ServiceWorkerRegister />
                {children}
                <Toaster />
                <UserCommandGate />
              </PostHogProvider>
            </Suspense>
          </AppConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
