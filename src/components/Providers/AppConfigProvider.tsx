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

"use client";

import React, { createContext, useContext } from "react";
import type { PublicRuntimeSettings } from "@/lib/server/runtime-settings";

type AppConfig = PublicRuntimeSettings;

const AppConfigContext = createContext<AppConfig | null>(null);

export function AppConfigProvider({
  value,
  children,
}: {
  value: AppConfig;
  children: React.ReactNode;
}) {
  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) {
    return {
      appUrl: "",
      appName: "Swush",
      supportName: "Swush Support",
      supportEmail: "help@swush.local",
      sponsorBannerEnabled: true,
      posthogKey: "",
      posthogHost: "https://app.posthog.com",
      vapidPublicKey: "",
      turnstileSiteKey: "",
      uploadChunkThresholdMb: 95,
      uploadMaxChunkMb: 95,
      socialLoginEnabled: false,
      socialLoginProviders: [],
    };
  }
  return ctx;
}
