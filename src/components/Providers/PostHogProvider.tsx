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

"use client";

import React, { useEffect } from "react";
import posthog from "posthog-js";
import { usePathname, useSearchParams } from "next/navigation";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { posthogKey, posthogHost } = useAppConfig();

  const key = posthogKey?.trim() || "";
  const host = posthogHost?.trim() || "https://app.posthog.com";
  const enabled = !!key;

  useEffect(() => {
    if (!enabled) return;
    posthog.init(key, {
      api_host: host,
      capture_pageview: false,
    });
  }, [enabled, host, key]);

  useEffect(() => {
    if (!enabled) return;
    posthog.capture("$pageview", { $current_url: window.location.href });
  }, [enabled, pathname, searchParams]);

  return <>{children}</>;
}
