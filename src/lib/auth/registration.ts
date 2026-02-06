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

import type { GenericEndpointContext } from "@better-auth/core";
import { APIError } from "better-call";
import { getServerSettings } from "@/lib/settings";
import { getSetupStatus } from "@/lib/server/setup";

const REGISTRATION_CLOSED_CODE = "registration_closed";

function isOAuthCallbackPath(path?: string | null) {
  if (!path) return false;
  return (
    path.startsWith("/callback") ||
    path.startsWith("/oauth2/callback") ||
    path.startsWith("/sign-in/social") ||
    path.startsWith("/sign-in/oauth2")
  );
}

export async function ensureSocialSignupAllowed(
  context: GenericEndpointContext | null,
) {
  if (!isOAuthCallbackPath(context?.path)) return;

  const setup = await getSetupStatus();
  if (setup.needsSetup) return;

  const settings = await getServerSettings();
  if (settings.allowPublicRegistration) return;

  throw new APIError("FORBIDDEN", { message: REGISTRATION_CLOSED_CODE });
}
