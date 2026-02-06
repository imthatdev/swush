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

import {
  IconBrandDiscord,
  IconBrandGithub,
  IconBrandGoogle,
} from "@tabler/icons-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import type React from "react";
import type { SocialProvider } from "@/lib/auth/social-config";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";

const providerMeta: Record<
  SocialProvider,
  { label: string; icon: React.ReactNode }
> = {
  google: { label: "Google", icon: <IconBrandGoogle size={18} /> },
  github: { label: "GitHub", icon: <IconBrandGithub size={18} /> },
  discord: { label: "Discord", icon: <IconBrandDiscord size={18} /> },
};

export default function SocialAuthButtons({
  callbackURL,
  errorCallbackURL = "/login",
  variant = "secondary",
}: {
  callbackURL: string;
  errorCallbackURL?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
}) {
  const { socialLoginEnabled, socialLoginProviders } = useAppConfig();
  if (!socialLoginEnabled || socialLoginProviders.length === 0) {
    return { hasProviders: false, content: null };
  }

  const signIn = async (provider: SocialProvider) => {
    await authClient.signIn.social({
      provider,
      callbackURL,
      errorCallbackURL,
    });
  };

  return {
    hasProviders: true,
    content: (
      <div className="grid grid-flow-col gap-2">
        {socialLoginProviders.map((provider) => (
          <Button
            key={provider}
            variant={variant}
            type="button"
            onClick={() => void signIn(provider)}
            className="justify-center gap-2"
          >
            {providerMeta[provider].icon}
          </Button>
        ))}
      </div>
    ),
  };
}
