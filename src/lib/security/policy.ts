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

import { db } from "@/db/client";
import { user, userInfo, files, shortLinks } from "@/db/schemas";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { getServerSettings, type ServerSettings } from "../settings";
import { sendLimitReachedEmail } from "@/lib/email";

export type Role = "admin" | "user" | "owner";

export type ResourceKind = "files" | "shortLink";

export interface LimitCheckArgs {
  userId: string;
  kind: ResourceKind;
  role?: Role;
  incomingCount?: number;
}

export class LimitPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LimitPolicyError";
  }
}

const userCountLimitCols = {
  files: "filesLimit",
  shortLink: "shortLinksLimit",
} as const;

type UserCountLimitColumn =
  (typeof userCountLimitCols)[keyof typeof userCountLimitCols];

const serverCountLimitBases = {
  files: "filesLimit",
  shortLink: "shortLinksLimit",
} as const;

type UserLimitSnapshot = Pick<
  typeof userInfo.$inferSelect,
  | "filesLimit"
  | "shortLinksLimit"
  | "maxStorageMb"
  | "maxUploadMb"
  | "allowRemoteUpload"
>;

async function getUserLimitSnapshot(
  userId: string,
): Promise<UserLimitSnapshot | null> {
  const row = await db.query.userInfo.findFirst({
    where: eq(userInfo.userId, userId),
    columns: {
      filesLimit: true,
      shortLinksLimit: true,
      maxUploadMb: true,
      maxStorageMb: true,
      allowRemoteUpload: true,
    },
  });
  return row ?? null;
}

function resolveCountLimit(args: {
  kind: ResourceKind;
  role: Role;
  userSnapshot: UserLimitSnapshot | null;
  settings: ServerSettings;
}): number {
  const { kind, role, userSnapshot, settings } = args;
  if (role === "owner") return Infinity;

  const userCol = userCountLimitCols[kind];
  const userOverride = userSnapshot
    ? (userSnapshot as Record<UserCountLimitColumn, number | null>)[userCol]
    : null;
  if (typeof userOverride === "number") return userOverride;

  const base = serverCountLimitBases[kind];
  const serverVal = (settings as unknown as Record<string, unknown>)[
    `${base}${role === "admin" ? "Admin" : "User"}`
  ];
  return typeof serverVal === "number" ? serverVal : Infinity;
}

async function notifyLimit(
  userId: string,
  limitName: string,
  details?: string,
) {
  const v = process.env.DISABLE_LIMITS_EMAILS;
  const disabled = v === "yes";

  if (disabled) return;

  const u = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { email: true },
  });
  const to = u?.email;
  if (!to) return;
  try {
    await sendLimitReachedEmail(to, { limitName, details });
  } catch {}
}

export async function getEffectiveLimit(args: {
  userId: string;
  kind: ResourceKind;
  role?: Role;
}): Promise<number> {
  const { userId, kind } = args;
  const role = args.role ?? "user";
  const [settings, snapshot] = await Promise.all([
    getServerSettings(),
    getUserLimitSnapshot(userId),
  ]);
  return resolveCountLimit({ kind, role, userSnapshot: snapshot, settings });
}

export async function getUsageForUser(
  userId: string,
  kind: ResourceKind,
): Promise<number> {
  const countFor = async (table: typeof files | typeof shortLinks) => {
    const [{ total }] = await db
      .select({ total: sql<number>`COALESCE(COUNT(*), 0)` })
      .from(table)
      .where(eq(table.userId, userId));
    return Number(total || 0);
  };

  switch (kind) {
    case "files": {
      return countFor(files);
    }
    case "shortLink": {
      return countFor(shortLinks);
    }
  }
}

export async function enforceCreateLimit(args: LimitCheckArgs): Promise<void> {
  const { userId, kind } = args;
  const role: Role = (args.role === "owner" ? "admin" : args.role) ?? "user";
  const incoming = args.incomingCount ?? 1;

  const limit = await getEffectiveLimit({ userId, kind, role });
  if (limit === Infinity) return;

  const used = await getUsageForUser(userId, kind);
  if (used + incoming > limit) {
    notifyLimit(
      userId,
      `${kind} count`,
      `You have ${used} ${kind}(s) out of a maximum of ${limit}.`,
    );
    throw new LimitPolicyError(
      `You have reached the limit for ${kind}s (${limit} max).`,
    );
  }
}

export interface UploadContext {
  userId: string;
  role?: Role;
  fileSizesMb: number[];
}

export interface EffectiveUploadLimits {
  maxUploadMb: number;
  maxFilesPerUpload: number;
  maxStorageMb: number;
  dailyQuotaMb: number;
  usedStorageMb: number;
  usedTodayMb: number;
  allowRemoteUpload: boolean;
}

async function getUsedStorageMb(userId: string): Promise<number> {
  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${files.size}), 0)` })
    .from(files)
    .where(eq(files.userId, userId));
  return (total || 0) / (1024 * 1024);
}

async function getUsedTodayMb(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [{ total }] = await db
    .select({ total: sql<number>`COALESCE(SUM(${files.size}), 0)` })
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        gte(files.createdAt, start),
        lte(files.createdAt, end),
      ),
    );
  return (total || 0) / (1024 * 1024);
}

export async function getEffectiveUploadLimits(
  userId: string,
  role?: Role,
): Promise<EffectiveUploadLimits> {
  const r: Role = role ?? "user";

  const [s, u]: [ServerSettings, UserLimitSnapshot] = await Promise.all([
    getServerSettings(),
    getUserLimitSnapshot(userId),
  ]);
  if (r === "owner") {
    const [usedStorageMb, usedTodayMb] = await Promise.all([
      getUsedStorageMb(userId),
      getUsedTodayMb(userId),
    ]);
    return {
      maxUploadMb: Infinity,
      maxFilesPerUpload: Infinity,
      maxStorageMb: Infinity,
      dailyQuotaMb: Infinity,
      usedStorageMb,
      usedTodayMb,
      allowRemoteUpload: true,
    };
  }

  const maxUploadMbGlobal = s.maxUploadMb;
  const maxFilesPerUpload = s.maxFilesPerUpload;

  const allowRemoteUpload = u?.allowRemoteUpload ?? s.allowRemoteUpload;

  const maxStorageMb =
    typeof u?.maxStorageMb === "number"
      ? u.maxStorageMb
      : r === "admin"
        ? s.adminMaxStorageMb
        : s.userMaxStorageMb;

  const dailyQuotaMb = r === "admin" ? s.adminDailyQuotaMb : s.userDailyQuotaMb;

  const [usedStorageMb, usedTodayMb] = await Promise.all([
    getUsedStorageMb(userId),
    getUsedTodayMb(userId),
  ]);

  return {
    maxUploadMb:
      typeof u?.maxUploadMb === "number" ? u.maxUploadMb : maxUploadMbGlobal,
    maxFilesPerUpload,
    maxStorageMb,
    dailyQuotaMb,
    usedStorageMb,
    usedTodayMb,
    allowRemoteUpload,
  };
}

export async function enforceUploadPolicy(ctx: UploadContext): Promise<void> {
  const r: Role = (ctx.role === "owner" ? "admin" : ctx.role) ?? "user";
  const limits = await getEffectiveUploadLimits(ctx.userId, r);

  if (!ctx.fileSizesMb.length) return;

  if (ctx.fileSizesMb.length > limits.maxFilesPerUpload) {
    throw new LimitPolicyError(
      `You can upload at most ${limits.maxFilesPerUpload} files per request.`,
    );
  }

  for (const sz of ctx.fileSizesMb) {
    if (sz > limits.maxUploadMb) {
      throw new LimitPolicyError(
        `One of your files exceeds the maximum upload size (${limits.maxUploadMb} MB).`,
      );
    }
  }

  const incomingTotal = ctx.fileSizesMb.reduce((a, b) => a + b, 0);
  if (limits.usedTodayMb + incomingTotal > limits.dailyQuotaMb) {
    notifyLimit(
      ctx.userId,
      "Daily upload quota",
      `Used ${Math.round(limits.usedTodayMb)} MB of ${Math.round(
        limits.dailyQuotaMb,
      )} MB. Incoming would exceed the daily cap.`,
    );
    throw new LimitPolicyError(
      `Daily upload quota exceeded (${limits.dailyQuotaMb} MB per day).`,
    );
  }

  if (limits.usedStorageMb + incomingTotal > limits.maxStorageMb) {
    notifyLimit(
      ctx.userId,
      "Total storage",
      `Used ${Math.round(limits.usedStorageMb)} MB of ${Math.round(
        limits.maxStorageMb,
      )} MB. Incoming would exceed your storage capacity.`,
    );
    throw new LimitPolicyError(
      `Storage limit exceeded (${limits.maxStorageMb} MB total).`,
    );
  }
}

export async function getRemainingSummary(userId: string, role?: Role) {
  const r: Role = role ?? "user";
  const [settings, snapshot]: [ServerSettings, UserLimitSnapshot | null] =
    await Promise.all([getServerSettings(), getUserLimitSnapshot(userId)]);

  const [filesUsed, shortLinksUsed] = await Promise.all([
    getUsageForUser(userId, "files"),
    getUsageForUser(userId, "shortLink"),
  ]);

  const resources: Record<ResourceKind, { used: number; limit: number }> = {
    files: {
      used: filesUsed,
      limit: resolveCountLimit({
        kind: "files",
        role: r,
        userSnapshot: snapshot,
        settings,
      }),
    },
    shortLink: {
      used: shortLinksUsed,
      limit: resolveCountLimit({
        kind: "shortLink",
        role: r,
        userSnapshot: snapshot,
        settings,
      }),
    },
  };

  const uploadLimits = await getEffectiveUploadLimits(userId, r);

  return {
    resources: Object.fromEntries(
      Object.entries(resources).map(([kind, { used, limit }]) => [
        kind,
        {
          used,
          limit,
          remaining: limit === Infinity ? Infinity : Math.max(limit - used, 0),
        },
      ]),
    ),
    storage: {
      maxStorageMb: uploadLimits.maxStorageMb,
      usedStorageMb: uploadLimits.usedStorageMb,
      remainingStorageMb:
        uploadLimits.maxStorageMb === Infinity
          ? Infinity
          : Math.max(uploadLimits.maxStorageMb - uploadLimits.usedStorageMb, 0),
    },
    dailyQuota: {
      dailyQuotaMb: uploadLimits.dailyQuotaMb,
      usedTodayMb: uploadLimits.usedTodayMb,
      remainingTodayMb:
        uploadLimits.dailyQuotaMb === Infinity
          ? Infinity
          : Math.max(uploadLimits.dailyQuotaMb - uploadLimits.usedTodayMb, 0),
    },
    perUpload: {
      maxUploadMb: uploadLimits.maxUploadMb,
      maxFilesPerUpload: uploadLimits.maxFilesPerUpload,
    },
    features: {
      remoteUpload: uploadLimits.allowRemoteUpload,
    },
  };
}
