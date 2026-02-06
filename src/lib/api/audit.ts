/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

import crypto from "node:crypto";
import { auditLog } from "@/db/schemas/core-schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/security/ip";
import { getCurrentUser, getCurrentUserFromToken } from "../client/user";

export type AuditRow = {
  id: string;
  chainId: string | null;
  seq: number | null;
  previousHash: string | null;
  hash: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  targetType: string;
  targetId: string;
  ip: string | null;
  userAgent: string | null;
  statusCode: string | null;
  meta: unknown;
  createdAt: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k]))
    .join(",")}}`;
}

function makeHash(payload: object, prev: string | null) {
  const data = stableStringify(payload) + (prev ?? "");
  return crypto.createHash("sha256").update(data).digest("hex");
}

const AUDIT_CHAIN_LOCK_ID = 8457341;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ListParams = {
  action?: string;
  targetType?: string;
  actorId?: string;
  chainId?: string;
  q?: string;
  limit?: number;
  page?: number;
};

export type ListResult = {
  rows: AuditRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type VerifyChainStatus = "ok" | "corrupted" | "legacy";
export type VerifyChain = {
  chainId: string | null;
  count: number;
  status: VerifyChainStatus;
  reason?:
    | "missing_chain"
    | "sequence_gap"
    | "hash_mismatch"
    | "sequence_start";
  brokenAt?: string | null;
  culprit?: {
    id: string;
    actorId: string | null;
    actorRole: string | null;
    action: string;
    targetType: string;
    targetId: string;
    createdAt: Date;
  } | null;
  headId?: string | null;
  headHash?: string | null;
  lastSeq?: number | null;
  lastAt?: Date | null;
};

export type VerifyResult = {
  ok: boolean;
  corrupted: boolean;
  count: number;
  chains: VerifyChain[];
  activeChainId: string | null;
};

type ActorRole = "owner" | "admin" | "user" | "system" | "anonymous";
type AuditCore = {
  actorId: string | null;
  actorRole: ActorRole;
  action: string;
  targetType: string;
  targetId: string;
  route: string;
  ip: string;
  userAgent: string;
  statusCode: string;
  meta: Record<string, unknown>;
};

function toCore(entry: {
  actorId?: string | null;
  actorRole?: ActorRole;
  action: string;
  targetType: string;
  targetId: string;
  route?: string;
  ip?: string;
  userAgent?: string;
  statusCode?: number | string;
  meta?: Record<string, unknown>;
}): AuditCore {
  return {
    actorId: entry.actorId ?? null,
    actorRole: entry.actorRole ?? "user",
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    route: entry.route ?? "",
    ip: entry.ip ?? "",
    userAgent: entry.userAgent ?? "",
    statusCode: String(entry.statusCode ?? ""),
    meta: entry.meta ?? {},
  };
}

export async function writeAudit(entry: {
  actorId?: string | null;
  actorRole?: ActorRole;
  action: string;
  targetType: string;
  targetId: string;
  route?: string;
  ip?: string;
  userAgent?: string;
  statusCode?: number | string;
  meta?: Record<string, unknown>;
  forceNewChain?: boolean;
}) {
  const core = toCore(entry);
  const forceNewChain = entry.forceNewChain ?? false;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_ID})`);
    const [last] = await tx
      .select({
        hash: auditLog.hash,
        seq: auditLog.seq,
        chainId: auditLog.chainId,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.seq), desc(auditLog.createdAt))
      .limit(1);
    const shouldStartNew = forceNewChain || !last?.chainId || last?.seq == null;
    const chainId = shouldStartNew ? crypto.randomUUID() : last?.chainId;
    const seq = shouldStartNew ? 1 : (last?.seq ?? 0) + 1;
    const previousHash = shouldStartNew ? null : (last?.hash ?? null);
    const nextChainId = chainId ?? crypto.randomUUID();
    const hash = makeHash({ ...core, chainId: nextChainId, seq }, previousHash);
    await tx.insert(auditLog).values({
      ...core,
      chainId: nextChainId,
      seq,
      previousHash,
      hash,
    });
  });
}

export async function audit(opts: {
  actorId?: string | null;
  actorRole?: ActorRole;
  action: string;
  targetType: string;
  targetId: string;
  statusCode?: number | string;
  meta?: Record<string, unknown>;
  route?: string;
}) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ua = h.get("user-agent") ?? "";
  const user = await getCurrentUser();
  const actorId = opts.actorId ?? user?.id ?? null;
  const actorRole =
    opts.actorRole ??
    user?.role ??
    (user ? ("user" as ActorRole) : "anonymous");

  await writeAudit({
    actorId,
    actorRole,
    action: opts.action,
    targetType: opts.targetType,
    targetId: opts.targetId,
    statusCode: opts.statusCode,
    meta: opts.meta,
    ip,
    userAgent: ua,
  });
}

export async function auditRequest(
  req: NextRequest,
  opts: {
    action: string;
    targetType: string;
    targetId: string;
    statusCode?: number | string;
    meta?: Record<string, unknown>;
  },
) {
  const sessionUser = await getCurrentUser();
  const tokenUser = sessionUser ? null : await getCurrentUserFromToken(req);
  const actor = sessionUser ?? tokenUser;

  const route = req.nextUrl?.pathname ?? "";
  const ip = getClientIp(req) ?? "";
  const ua = req.headers.get("user-agent") ?? "";

  await writeAudit({
    actorId: actor?.id ?? null,
    actorRole: actor?.role ?? "anonymous",
    action: opts.action,
    targetType: opts.targetType,
    targetId: opts.targetId,
    statusCode: opts.statusCode,
    meta: opts.meta,
    route,
    ip,
    userAgent: ua,
  });
}

export async function getAuditProof(id: string) {
  const [row] = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.id, id))
    .limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  let prev = null;
  if (row.previousHash !== null) {
    [prev] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.hash, row.previousHash))
      .limit(1);
  }

  const core: AuditCore = toCore({
    actorId: row.actorId ?? null,
    actorRole: (row.actorRole ?? "user") as ActorRole,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    ip: row.ip ?? "",
    userAgent: row.userAgent ?? "",
    statusCode: row.statusCode ?? "",
    meta: (row.meta ?? {}) as Record<string, unknown>,
  });

  const recomputed = makeHash(
    { ...core, chainId: row.chainId, seq: row.seq },
    row.previousHash,
  );
  const linked = recomputed === row.hash && (!row.previousHash || !!prev);

  return {
    ok: true,
    id: row.id,
    chainId: row.chainId,
    seq: row.seq,
    hash: row.hash,
    previousHash: row.previousHash,
    linked,
    hasPrevious: !!prev,
  };
}

export async function resetAudit(): Promise<void> {
  await db.delete(auditLog);
}

export async function rotateAuditChain(meta?: Record<string, unknown>) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ua = h.get("user-agent") ?? "";
  const user = await getCurrentUser();
  const [last] = await db
    .select({ chainId: auditLog.chainId })
    .from(auditLog)
    .orderBy(desc(auditLog.seq), desc(auditLog.createdAt))
    .limit(1);

  await writeAudit({
    actorId: user?.id ?? null,
    actorRole: user?.role ?? (user ? ("user" as ActorRole) : "anonymous"),
    action: "audit.chain.rotate",
    targetType: "audit",
    targetId: last?.chainId ?? "new-chain",
    statusCode: 200,
    meta: { previousChainId: last?.chainId ?? null, ...(meta ?? {}) },
    ip,
    userAgent: ua,
    forceNewChain: true,
  });
}

export async function listAudit({
  action,
  targetType,
  actorId,
  chainId,
  q,
  limit = 50,
  page = 1,
}: ListParams): Promise<ListResult> {
  const pageSize = Math.min(Math.max(limit, 1), 200);
  const currentPage = Math.max(Number(page) || 1, 1);

  const where = [] as ReturnType<typeof and>[];
  if (action) where.push(eq(auditLog.action, action));
  if (targetType) where.push(eq(auditLog.targetType, targetType));
  if (actorId) where.push(eq(auditLog.actorId, actorId));
  if (chainId) {
    if (UUID_RE.test(chainId)) {
      where.push(eq(auditLog.chainId, chainId));
    } else {
      where.push(sql`false`);
    }
  }
  if (q) where.push(sql`CAST(${auditLog.meta} AS text) ILIKE ${"%" + q + "%"}`);

  const [{ count }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(auditLog)
    .where(where.length ? and(...where) : undefined);

  const rows = await db
    .select()
    .from(auditLog)
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(pageSize)
    .offset((currentPage - 1) * pageSize);

  const safeRows: AuditRow[] = rows.map((r) => ({
    id: r.id,
    chainId: r.chainId ?? null,
    seq: r.seq ?? null,
    previousHash: r.previousHash,
    hash: r.hash,
    actorId: r.actorId,
    actorRole: r.actorRole,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    ip: r.ip,
    userAgent: r.userAgent,
    statusCode: r.statusCode,
    meta: r.meta,
    createdAt: r.createdAt.toISOString(),
  }));

  const totalCount = Number(count ?? 0);
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);

  return {
    rows: safeRows,
    page: currentPage,
    pageSize,
    totalCount,
    totalPages,
  };
}

export async function verifyAudit(): Promise<VerifyResult> {
  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(auditLog.seq, auditLog.createdAt);

  if (!rows.length) {
    return {
      ok: true,
      corrupted: false,
      count: 0,
      chains: [],
      activeChainId: null,
    };
  }

  const byChain = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const key = row.chainId ?? null;
    const group = byChain.get(key);
    if (group) group.push(row);
    else byChain.set(key, [row]);
  }

  const chains: VerifyChain[] = [];
  let activeChainId: string | null = null;
  let activeChainDate = 0;

  for (const [chainId, chainRows] of byChain.entries()) {
    const sorted = [...chainRows].sort((a, b) => {
      const as = a.seq ?? 0;
      const bs = b.seq ?? 0;
      if (as !== bs) return as - bs;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const lastRow = sorted[sorted.length - 1];
    const lastDate = lastRow?.createdAt?.getTime() ?? 0;
    if (lastDate > activeChainDate) {
      activeChainDate = lastDate;
      activeChainId = chainId;
    }

    if (sorted.some((r) => r.chainId == null || r.seq == null)) {
      chains.push({
        chainId,
        count: sorted.length,
        status: "legacy",
        reason: "missing_chain",
        headId: lastRow?.id ?? null,
        headHash: lastRow?.hash ?? null,
        lastSeq: lastRow?.seq ?? null,
        lastAt: lastRow?.createdAt ?? null,
      });
      continue;
    }

    let expectedSeq = 1;
    let prevHash: string | null = null;
    let brokenAt: string | null = null;
    let reason: "sequence_gap" | "hash_mismatch" | "sequence_start" | undefined;
    let culprit: {
      id: string;
      actorId: string | null;
      actorRole: string | null;
      action: string;
      targetType: string;
      targetId: string;
      createdAt: Date;
    } | null = null;

    if ((sorted[0]?.seq ?? 1) !== 1) {
      reason = "sequence_start";
      brokenAt = sorted[0]?.id ?? null;
      if (sorted[0]) {
        culprit = {
          id: sorted[0].id,
          actorId: sorted[0].actorId,
          actorRole: sorted[0].actorRole,
          action: sorted[0].action,
          targetType: sorted[0].targetType,
          targetId: sorted[0].targetId,
          createdAt: sorted[0].createdAt,
        };
      }
    }

    for (const row of sorted) {
      if (brokenAt) break;
      if (row.seq !== expectedSeq) {
        reason = "sequence_gap";
        brokenAt = row.id;
      } else {
        const core = toCore({
          actorId: row.actorId ?? null,
          actorRole: (row.actorRole ?? "user") as ActorRole,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          ip: row.ip ?? "",
          userAgent: row.userAgent ?? "",
          statusCode: row.statusCode ?? "",
          meta: (row.meta ?? {}) as Record<string, unknown>,
        });
        const recomputed = makeHash(
          { ...core, chainId: row.chainId, seq: row.seq },
          row.previousHash,
        );
        if (row.previousHash !== prevHash || recomputed !== row.hash) {
          reason = "hash_mismatch";
          brokenAt = row.id;
        }
      }

      if (brokenAt) {
        culprit = {
          id: row.id,
          actorId: row.actorId,
          actorRole: row.actorRole,
          action: row.action,
          targetType: row.targetType,
          targetId: row.targetId,
          createdAt: row.createdAt,
        };
      }

      prevHash = row.hash;
      expectedSeq += 1;
    }

    chains.push({
      chainId,
      count: sorted.length,
      status: brokenAt ? "corrupted" : "ok",
      reason,
      brokenAt,
      culprit,
      headId: lastRow?.id ?? null,
      headHash: lastRow?.hash ?? null,
      lastSeq: lastRow?.seq ?? null,
      lastAt: lastRow?.createdAt ?? null,
    });
  }

  const corrupted = chains.some((c) => c.status === "corrupted");
  const legacy = chains.some((c) => c.status === "legacy");
  return {
    ok: !corrupted && !legacy,
    corrupted,
    count: rows.length,
    chains,
    activeChainId,
  };
}
