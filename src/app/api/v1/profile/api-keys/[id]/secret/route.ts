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

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { apiKeySecrets } from "@/db/schemas";
import { decryptApiKey } from "@/lib/security/api-key-secrets";
import { withApiError } from "@/lib/server/api-error";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export const GET = withApiError(async function GET(req: NextRequest, { params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [row] = await db
    .select()
    .from(apiKeySecrets)
    .where(and(eq(apiKeySecrets.keyId, id), eq(apiKeySecrets.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const key = decryptApiKey({
      encrypted: row.encryptedKey,
      iv: row.iv,
      tag: row.tag,
    });
    return NextResponse.json({ key });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to decrypt API key" },
      { status: 500 }
    );
  }
});
