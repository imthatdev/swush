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

import "server-only";

export type PublicRuntimeSettings = {
  appUrl: string;
  appName: string;
  supportName: string;
  supportEmail: string;
  sponsorBannerEnabled: boolean;
  posthogKey: string;
  posthogHost: string;
  vapidPublicKey: string;
  turnstileSiteKey: string;
  uploadChunkThresholdMb: number;
  uploadMaxChunkMb: number;
  socialLoginEnabled: boolean;
  socialLoginProviders: ("google" | "github" | "discord")[];
};

export type OAuthSecrets = {
  discord?: { clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string };
  google?: { clientId: string; clientSecret: string };
};

export type IntegrationSecrets = {
  anilistClientId?: string;
  anilistClientSecret?: string;
  steamApiKey?: string;
  steamLinkSecret?: string;
  tmdbApiKey?: string;
  rawgApiKey?: string;
};

export type SmtpSettings = {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
};

export type UploadRuntimeSettings = {
  uploadChunkThresholdMb: number;
  uploadMaxChunkMb: number;
};

const socialProviders = ["google", "github", "discord"] as const;

function parsePositiveNumber(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function resolveUploadRuntimeSettings(): UploadRuntimeSettings {
  const uploadChunkThresholdMb =
    parsePositiveNumber(process.env.UPLOAD_CHUNK_THRESHOLD_MB) ?? 95;
  const uploadMaxChunkMb =
    parsePositiveNumber(process.env.UPLOAD_MAX_CHUNK_MB) ?? 95;

  return { uploadChunkThresholdMb, uploadMaxChunkMb };
}

function parseProviders(raw: string | null | undefined) {
  if (!raw) return [];
  const normalized = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return normalized.filter((value): value is (typeof socialProviders)[number] =>
    socialProviders.includes(value as (typeof socialProviders)[number]),
  );
}

export async function getPublicRuntimeSettings(): Promise<PublicRuntimeSettings> {
  const appUrl = process.env.APP_URL || process.env.BETTER_AUTH_URL || "";
  const appName = process.env.APP_NAME || "Swush";
  const supportName = process.env.SUPPORT_NAME || "Swush Support";
  const supportEmail = process.env.SUPPORT_EMAIL || "help@swush.local";

  let sponsorBannerEnabled = true;
  try {
    const { getServerSettings } = await import("@/lib/settings");
    const settings = await getServerSettings();
    sponsorBannerEnabled = settings.sponsorBannerEnabled ?? true;
  } catch {
    sponsorBannerEnabled = true;
  }

  const posthogKey = process.env.POSTHOG_KEY || "";
  const posthogHost = process.env.POSTHOG_HOST || "https://app.posthog.com";

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "";
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || "";
  const { uploadChunkThresholdMb, uploadMaxChunkMb } =
    resolveUploadRuntimeSettings();

  const socialLoginEnabled =
    (process.env.ENABLE_SOCIAL_LOGIN || "").trim().toLowerCase() === "true";
  const socialLoginProviders = parseProviders(
    process.env.AVAILABLE_SOCIAL_LOGINS,
  );

  return {
    appUrl,
    appName,
    supportName,
    supportEmail,
    sponsorBannerEnabled,
    posthogKey,
    posthogHost,
    vapidPublicKey,
    turnstileSiteKey,
    uploadChunkThresholdMb,
    uploadMaxChunkMb,
    socialLoginEnabled,
    socialLoginProviders,
  };
}

export async function getUploadRuntimeSettings(): Promise<UploadRuntimeSettings> {
  return resolveUploadRuntimeSettings();
}

export async function getOAuthSecrets(): Promise<OAuthSecrets> {
  const discordClientId = process.env.DISCORD_CLIENT_ID?.trim();
  const githubClientId = process.env.GITHUB_CLIENT_ID?.trim();
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();

  const discordClientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  return {
    discord:
      discordClientId && discordClientSecret
        ? { clientId: discordClientId, clientSecret: discordClientSecret }
        : undefined,
    github:
      githubClientId && githubClientSecret
        ? { clientId: githubClientId, clientSecret: githubClientSecret }
        : undefined,
    google:
      googleClientId && googleClientSecret
        ? { clientId: googleClientId, clientSecret: googleClientSecret }
        : undefined,
  };
}

export async function getIntegrationSecrets(): Promise<IntegrationSecrets> {
  return {
    anilistClientId: process.env.ANILIST_CLIENT_ID?.trim(),
    anilistClientSecret: process.env.ANILIST_CLIENT_SECRET?.trim(),
    steamApiKey: process.env.STEAM_API_KEY?.trim(),
    steamLinkSecret: process.env.STEAM_LINK_SECRET?.trim(),
    tmdbApiKey: process.env.TMDB_API_KEY?.trim(),
    rawgApiKey: process.env.RAWG_API_KEY?.trim(),
  };
}

export async function getSmtpSettings(): Promise<SmtpSettings> {
  const pass = process.env.SMTP_PASS?.trim();

  return {
    host: process.env.SMTP_HOST?.trim(),
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined,
    user: process.env.SMTP_USER?.trim(),
    pass,
    from: process.env.SMTP_FROM?.trim(),
  };
}
