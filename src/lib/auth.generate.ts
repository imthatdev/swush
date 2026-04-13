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

// @ts-nocheck

import { anonymous, openAPI, twoFactor, username } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import { passkey } from "@better-auth/passkey";
import { nextCookies } from "better-auth/next-js";

const appName = process.env.APP_NAME || "Swush";
const baseURL = process.env.APP_URL || process.env.BETTER_AUTH_URL;
const origins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : undefined;

// CLI-only config used by `pnpm auth:generate`.
// We export `options` directly so the CLI can generate schema without loading db client modules.
export const auth = {
  options: {
    baseURL,
    trustedOrigins: [baseURL, ...(origins || [])].filter(Boolean),
    appName,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    user: {
      changeEmail: {
        enabled: true,
      },
      deleteUser: {
        enabled: true,
      },
    },
    plugins: [
      username(),
      anonymous(),
      twoFactor(),
      passkey(),
      apiKey(),
      openAPI(),
      nextCookies(),
    ],
  },
};
