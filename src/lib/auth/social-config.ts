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

export type SocialProvider = "google" | "github" | "discord";

const socialProviders = ["google", "github", "discord"] as const;

function parseProviders(raw: string | null | undefined) {
  if (!raw) return [];
  const normalized = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return normalized.filter((value): value is (typeof socialProviders)[number] =>
    socialProviders.includes(value as (typeof socialProviders)[number])
  );
}

export async function getSocialLoginConfig() {
  const enabled =
    (process.env.ENABLE_SOCIAL_LOGIN || "")
      .trim()
      .toLowerCase() === "true";
  const providers = parseProviders(process.env.AVAILABLE_SOCIAL_LOGINS);
  return {
    enabled,
    providers,
  };
}
