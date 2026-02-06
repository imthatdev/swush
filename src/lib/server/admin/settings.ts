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

"use server";

import { requireAdmin } from "@/lib/security/roles";
import { adminPutSettings } from "@/lib/server/admin/actions";
import type { ServerSettings } from "@/lib/settings";

export async function adminUpdateSettings(
  payload: unknown,
): Promise<
  { ok: true; settings: ServerSettings } | { ok: false; error: unknown }
> {
  await requireAdmin();
  const result = await adminPutSettings(payload);

  if (result.ok === true && result.settings) {
    return { ok: true, settings: result.settings };
  } else {
    return { ok: false, error: result.error };
  }
}
