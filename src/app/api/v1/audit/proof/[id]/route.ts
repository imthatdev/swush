/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

import { NextRequest, NextResponse } from "next/server";
import { getAuditProof } from "@/lib/api/audit";
import { requireOwner } from "@/lib/security/roles";
import { withApiError } from "@/lib/server/api-error";

type Params = Promise<{ id: string }>;

export const GET = withApiError(async function GET(_req: NextRequest, { params }: { params: Params }) {
  await requireOwner();
  const { id } = await params;

  const proof = await getAuditProof(id);
  if (!proof.ok) return NextResponse.json(proof, { status: 404 });
  return NextResponse.json(proof);
});
