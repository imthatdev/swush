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

import type { SocialProvider } from "@/lib/auth/social-config";

export async function buildSocialProviders(providers: SocialProvider[]) {
  const enabled = new Set(providers);
  const entries: Record<string, { clientId: string; clientSecret: string }> =
    {};

  const discordClientId = process.env.DISCORD_CLIENT_ID?.trim();
  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  if (enabled.has("discord") && discordClientId && discordClientSecret) {
    entries.discord = {
      clientId: discordClientId,
      clientSecret: discordClientSecret,
    };
  }

  const githubClientId = process.env.GITHUB_CLIENT_ID?.trim();
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (enabled.has("github") && githubClientId && githubClientSecret) {
    entries.github = {
      clientId: githubClientId,
      clientSecret: githubClientSecret,
    };
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (enabled.has("google") && googleClientId && googleClientSecret) {
    entries.google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    };
  }

  return Object.keys(entries).length > 0 ? entries : undefined;
}
