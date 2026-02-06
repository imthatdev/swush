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

import "server-only";

import { db } from "@/db/client";
import {
  user,
  userInfo,
  files,
  shortLinks,
  inviteTokens,
  session,
  apikey,
  apiKeySecrets,
} from "@/db/schemas";
import { sql, eq, and } from "drizzle-orm";
import { sendBanLiftedNotification, sendBanNotification } from "@/lib/email";
import { z } from "zod";
import { getServerSettings, updateServerSettings } from "@/lib/settings";
import { APIError } from "better-auth";

const LimitsSchema = z.object({
  maxStorageMb: z.number().int().min(0).nullable().optional(),
  maxUploadMb: z.number().int().min(0).nullable().optional(),
  filesLimit: z.number().int().min(0).nullable().optional(),
  shortLinksLimit: z.number().int().min(0).nullable().optional(),
  allowRemoteUpload: z.boolean().nullable().optional(),
  allowFiles: z.boolean().nullable().optional(),
  allowShortlinks: z.boolean().nullable().optional(),
  allowWatchlist: z.boolean().nullable().optional(),
  disableApiTokens: z.boolean().optional(),
  verified: z.boolean().optional(),
  role: z.enum(["owner", "admin", "user"]).optional(),
  lock: z.boolean().optional(),
  reason: z.string().max(500).optional(),
});

function normalizeNumeric(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
    return v === 0 ? null : v;
  }
  return undefined;
}

async function ensureUserInfoRow(userId: string) {
  await db
    .insert(userInfo)
    .values({ userId, role: "user" })
    .onConflictDoNothing();
}

export async function adminGetUsersList() {
  const fileAgg = await db
    .select({
      userId: files.userId,
      filesCount: sql<number>`count(*)`,
      storageBytes: sql<number>`coalesce(sum(${files.size}), 0)`,
    })
    .from(files)
    .groupBy(files.userId);

  const fileMap = new Map(
    fileAgg.map((r) => [
      r.userId,
      { files: Number(r.filesCount), storageBytes: Number(r.storageBytes) },
    ]),
  );

  const linkAgg = await db
    .select({
      userId: shortLinks.userId,
      linksCount: sql<number>`count(*)`,
      clicks: sql<number>`coalesce(sum(${shortLinks.clickCount}), 0)`,
    })
    .from(shortLinks)
    .groupBy(shortLinks.userId);

  const linkMap = new Map(
    linkAgg.map((r) => [
      r.userId,
      { links: Number(r.linksCount), clicks: Number(r.clicks) },
    ]),
  );

  const sessionAgg = await db
    .select({
      userId: session.userId,
      lastLoginAt: sql`max(${session.updatedAt})`,
    })
    .from(session)
    .groupBy(session.userId);

  const sessionMap = new Map(sessionAgg.map((r) => [r.userId, r.lastLoginAt]));

  const rows = await db
    .select({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.name,
      role: userInfo.role,
      image: user.image,
      isBanned: userInfo.banned,
      banReason: userInfo.banReason,
      banExpires: userInfo.banExpires,
      createdAt: user.createdAt,
      lastLoginAt: user.updatedAt,
      maxStorageMb: userInfo.maxStorageMb,
      maxUploadMb: userInfo.maxUploadMb,
      filesLimit: userInfo.filesLimit,
      shortLinksLimit: userInfo.shortLinksLimit,
      twoFactor: user.twoFactorEnabled,
      allowRemoteUpload: userInfo.allowRemoteUpload,
      allowFiles: userInfo.allowFiles,
      allowShortlinks: userInfo.allowShortlinks,
      allowWatchlist: userInfo.allowWatchlist,
      disableApiTokens: userInfo.disableApiTokens,
      verified: userInfo.verified,
    })
    .from(user)
    .leftJoin(userInfo, eq(userInfo.userId, user.id));

  const zeroToNull = (n: number | null | undefined) =>
    n === 0 ? null : (n ?? null);

  return rows.map((u) => {
    const f = fileMap.get(u.id) ?? { files: 0, storageBytes: 0 };
    const l = linkMap.get(u.id) ?? { links: 0, clicks: 0 };

    const lastLoginAt = sessionMap.get(u.id) ?? null;

    return {
      ...u,
      role: u.role ?? "user",
      isBanned: !!u.isBanned,
      banReason: u.banReason ?? null,
      banExpires: u.banExpires
        ? u.banExpires instanceof Date
          ? u.banExpires.toISOString()
          : String(u.banExpires)
        : null,
      createdAt:
        u.createdAt instanceof Date
          ? u.createdAt.toISOString()
          : String(u.createdAt),
      lastLoginAt: u.lastLoginAt
        ? lastLoginAt instanceof Date
          ? lastLoginAt.toISOString()
          : String(lastLoginAt)
        : null,
      maxStorageMb: zeroToNull(u.maxStorageMb),
      maxUploadMb: zeroToNull(u.maxUploadMb),
      filesLimit: zeroToNull(u.filesLimit),
      shortLinksLimit: zeroToNull(u.shortLinksLimit),
      usage: {
        files: f.files,
        storageBytes: f.storageBytes,
        links: l.links,
        clicks: l.clicks,
      },
      twoFactor: !!u.twoFactor,
      allowRemoteUpload: u.allowRemoteUpload,

      allowFiles: u.allowFiles,
      allowShortlinks: u.allowShortlinks,

      disableApiTokens: !!u.disableApiTokens,
      verified: !!u.verified,
    };
  });
}

export async function adminGetUser(id: string) {
  const [row] = await db
    .select({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.name,
      role: userInfo.role,
      isBanned: userInfo.banned,
      banReason: userInfo.banReason,
      banExpires: userInfo.banExpires,
      createdAt: user.createdAt,
      maxStorageMb: userInfo.maxStorageMb,
      maxUploadMb: userInfo.maxUploadMb,
      filesLimit: userInfo.filesLimit,
      shortLinksLimit: userInfo.shortLinksLimit,
      twoFactor: user.twoFactorEnabled,
      allowRemoteUpload: userInfo.allowRemoteUpload,
      allowFiles: userInfo.allowFiles,
      allowShortlinks: userInfo.allowShortlinks,
      allowWatchlist: userInfo.allowWatchlist,
      disableApiTokens: userInfo.disableApiTokens,
      verified: userInfo.verified,
    })
    .from(user)
    .leftJoin(userInfo, eq(userInfo.userId, user.id))
    .where(eq(user.id, id))
    .limit(1);

  if (!row) return null;

  const [sessionRow] = await db
    .select({ lastLoginAt: sql`max(${session.updatedAt})` })
    .from(session)
    .where(eq(session.userId, id));

  const lastLoginAt = sessionRow?.lastLoginAt ?? null;

  const zeroToNull = (n: number | null | undefined) =>
    n === 0 ? null : (n ?? null);
  return {
    ...row,
    role: row.role ?? "user",
    createdAt: row.createdAt
      ? new Date(row.createdAt).toISOString()
      : new Date(0).toISOString(),
    lastLoginAt:
      lastLoginAt &&
      (typeof lastLoginAt === "string" ||
        typeof lastLoginAt === "number" ||
        lastLoginAt instanceof Date)
        ? new Date(lastLoginAt).toISOString()
        : null,
    maxStorageMb: zeroToNull(row.maxStorageMb),
    maxUploadMb: zeroToNull(row.maxUploadMb),
    filesLimit: zeroToNull(row.filesLimit),
    shortLinksLimit: zeroToNull(row.shortLinksLimit),
    allowRemoteUpload: row.allowRemoteUpload,
    allowFiles: row.allowFiles,
    allowShortlinks: row.allowShortlinks,
    allowWatchlist: row.allowWatchlist,
    disableApiTokens: !!row.disableApiTokens,
    twoFactor: !!row.twoFactor,
    verified: !!row.verified,
  };
}

export async function adminUpdateUser(
  id: string,
  data: Record<string, unknown>,
  acting: { id: string; role: "owner" | "admin" | "user" },
) {
  if (data && data.disable2FA === true) {
    if (acting.role !== "owner" && acting.role !== "admin") {
      return { ok: false as const, error: "Forbidden" };
    }

    if (acting.id === id && acting.role !== "owner") {
      return { ok: false as const, error: "Cannot disable your own 2FA here" };
    }

    try {
      await db
        .update(user)
        .set({
          twoFactorEnabled: false,
        })
        .where(eq(user.id, id));
    } catch {}

    return { ok: true as const };
  }

  const originalRoleChange = data?.role;

  const coerce = (v: unknown, key?: string) => {
    if (
      (key === "allowRemoteUpload" ||
        key === "allowMeetings" ||
        key === "allowNotes" ||
        key === "allowBookmarks" ||
        key === "allowFiles" ||
        key === "allowShortlinks" ||
        key === "allowRecipes" ||
        key === "allowWatchlist" ||
        key === "allowGamelists" ||
        key === "disableApiTokens") &&
      (v === "" || v === undefined)
    )
      return null;
    if (v === "" || v === undefined) return null;
    if (v === null) return null;
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      if (v.trim().toLowerCase() === "true") return true;
      if (v.trim().toLowerCase() === "false") return false;
      const n = Number(v.trim());
      if (!Number.isFinite(n) || n < 0) return null;
      return n;
    }
    if (typeof v === "number") return v;
    return null;
  };

  const prepared = {
    maxStorageMb: coerce(data.maxStorageMb),
    maxUploadMb: coerce(data.maxUploadMb),
    filesLimit: coerce(data.filesLimit),
    notesLimit: coerce(data.notesLimit),
    shortLinksLimit: coerce(data.shortLinksLimit),
    snippetsLimit: coerce(data.snippetsLimit),
    bookmarksLimit: coerce(data.bookmarksLimit),
    recipesLimit: coerce(data.recipesLimit),
    allowRemoteUpload: coerce(data.allowRemoteUpload, "allowRemoteUpload"),
    allowMeetings: coerce(data.allowMeetings, "allowMeetings"),
    allowNotes: coerce(data.allowNotes, "allowNotes"),
    allowBookmarks: coerce(data.allowBookmarks, "allowBookmarks"),
    allowFiles: coerce(data.allowFiles, "allowFiles"),
    allowShortlinks: coerce(data.allowShortlinks, "allowShortlinks"),
    allowSnippets: coerce(data.allowSnippets, "allowSnippets"),
    allowRecipes: coerce(data.allowRecipes, "allowRecipes"),
    allowWatchlist: coerce(data.allowWatchlist, "allowWatchlist"),
    allowGamelists: coerce(data.allowGamelists, "allowGamelists"),
    disableApiTokens: coerce(data.disableApiTokens, "disableApiTokens"),
    verified: typeof data.verified === "boolean" ? data.verified : undefined,
    role: data.role,
    lock: data.lock,
    reason: data.reason,
  };

  const parsed = LimitsSchema.safeParse(prepared);
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() };

  if (originalRoleChange !== undefined && acting.role !== "owner") {
    return { ok: false as const, error: "Only owners can change roles." };
  }

  const p = parsed.data;
  const update: Record<string, unknown> = {};

  for (const key of Object.keys(p) as (keyof typeof p)[]) {
    const val = p[key];
    if (val === undefined) continue;

    if (
      key === "maxStorageMb" ||
      key === "maxUploadMb" ||
      key === "filesLimit" ||
      key === "shortLinksLimit"
    ) {
      update[key] = normalizeNumeric(val);
    } else if (key === "role") {
      update.role = p.role;
    } else if (key === "lock") {
      update.banned = !!p.lock;
    } else if (key === "reason") {
      update.banReason =
        typeof p.reason === "string" ? p.reason.trim() || null : null;
    } else if (key === "allowRemoteUpload") {
      update.allowRemoteUpload =
        p.allowRemoteUpload === undefined ? null : p.allowRemoteUpload;
    } else if (key === "allowFiles") {
      update.allowFiles = p.allowFiles === undefined ? null : p.allowFiles;
    } else if (key === "allowShortlinks") {
      update.allowShortlinks =
        p.allowShortlinks === undefined ? null : p.allowShortlinks;
    } else if (key === "allowWatchlist") {
      update.allowWatchlist =
        p.allowWatchlist === undefined ? null : p.allowWatchlist;
    } else if (key === "disableApiTokens") {
      update.disableApiTokens = !!p.disableApiTokens;
    } else if (key === "verified") {
      update.verified = p.verified;
    }
  }

  if (Object.keys(update).length === 0)
    return { ok: false, error: "No changes" };

  await ensureUserInfoRow(id);

  const [row] = await db
    .update(userInfo)
    .set(update)
    .where(eq(userInfo.userId, id))
    .returning();

  if (p.lock === true) {
    try {
      await db.delete(session).where(eq(session.userId, id));
    } catch (err) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to revoke user sessions",
        cause: err,
      });
    }
  }

  const [targetUser] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  try {
    const targetEmail = targetUser?.email;
    if (!targetEmail) return { ok: true, user: row };
    if (p.lock === true) {
      await sendBanNotification(
        targetEmail,
        typeof update.banReason === "string"
          ? (update.banReason as string).trim()
          : "",
      );
    } else if (p.lock === false) {
      await sendBanLiftedNotification(targetEmail);
    }
  } catch (err) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send lock/unlock email",
      cause: err,
    });
  }

  return { ok: true, user: row };
}

export async function adminDeleteUser(
  targetId: string,
  me: { id: string; role: string },
) {
  const [target] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);

  const [targetInfo] = await db
    .select({ role: userInfo.role })
    .from(userInfo)
    .where(eq(userInfo.userId, targetId))
    .limit(1);

  if (!target) return { ok: false, error: "User not found" };
  if (targetId === me.id)
    return { ok: false, error: "You cannot delete your own account." };
  if ((targetInfo?.role ?? "user") === "owner" && me.role !== "owner") {
    return { ok: false, error: "Only owners can delete owners." };
  }

  await db.delete(user).where(eq(user.id, targetId));

  try {
    if (target.email) {
      const { sendAccountDeletedEmail } = await import("@/lib/email");
      await sendAccountDeletedEmail(target.email);
    }
  } catch (err) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to send deletion email",
      cause: err,
    });
  }
  return { ok: true };
}

const StringArray = z
  .array(z.string())
  .transform((arr) => arr.map((s) => s.trim()).filter(Boolean));

const SettingsSchema = z.object({
  maxUploadMb: z.number().int().min(1).max(102400),
  maxFilesPerUpload: z.number().int().min(1).max(1000),
  allowPublicRegistration: z.boolean(),
  passwordPolicyMinLength: z.number().int().min(6).max(128),

  userMaxStorageMb: z
    .number()
    .int()
    .min(0)
    .max(1024 * 1024 * 32),
  adminMaxStorageMb: z
    .number()
    .int()
    .min(0)
    .max(1024 * 1024 * 32),

  userDailyQuotaMb: z
    .number()
    .int()
    .min(0)
    .max(1024 * 1024),
  adminDailyQuotaMb: z
    .number()
    .int()
    .min(0)
    .max(1024 * 1024),

  filesLimitUser: z.number().int().min(0).optional(),
  filesLimitAdmin: z.number().int().min(0).optional(),
  notesLimitUser: z.number().int().min(0).optional(),
  notesLimitAdmin: z.number().int().min(0).optional(),
  bookmarksLimitUser: z.number().int().min(0).optional(),
  bookmarksLimitAdmin: z.number().int().min(0).optional(),
  snippetsLimitUser: z.number().int().min(0).optional(),
  snippetsLimitAdmin: z.number().int().min(0).optional(),
  recipesLimitUser: z.number().int().min(0).optional(),
  recipesLimitAdmin: z.number().int().min(0).optional(),
  shortLinksLimitUser: z.number().int().min(0).optional(),
  shortLinksLimitAdmin: z.number().int().min(0).optional(),

  allowedMimePrefixes: z.union([StringArray, z.null()]).optional(),
  disallowedExtensions: z.union([StringArray, z.null()]).optional(),
  preservedUsernames: z.union([StringArray, z.null()]).optional(),
  allowRemoteUpload: z.boolean(),
  sponsorBannerEnabled: z.boolean(),
  disableApiTokens: z.boolean(),
});

export async function adminGetSettings() {
  const settings = await getServerSettings();
  return {
    id: settings.id,
    allowPublicRegistration: settings.allowPublicRegistration,
    passwordPolicyMinLength: settings.passwordPolicyMinLength,
    maxUploadMb: settings.maxUploadMb,
    maxFilesPerUpload: settings.maxFilesPerUpload,
    userDailyQuotaMb: settings.userDailyQuotaMb,
    adminDailyQuotaMb: settings.adminDailyQuotaMb,
    userMaxStorageMb: settings.userMaxStorageMb,
    adminMaxStorageMb: settings.adminMaxStorageMb,
    filesLimitUser: settings.filesLimitUser,
    filesLimitAdmin: settings.filesLimitAdmin,
    notesLimitUser: settings.notesLimitUser,
    notesLimitAdmin: settings.notesLimitAdmin,
    bookmarksLimitUser: settings.bookmarksLimitUser,
    bookmarksLimitAdmin: settings.bookmarksLimitAdmin,
    snippetsLimitUser: settings.snippetsLimitUser,
    snippetsLimitAdmin: settings.snippetsLimitAdmin,
    recipesLimitUser: settings.recipesLimitUser,
    recipesLimitAdmin: settings.recipesLimitAdmin,
    shortLinksLimitUser: settings.shortLinksLimitUser,
    shortLinksLimitAdmin: settings.shortLinksLimitAdmin,
    allowedMimePrefixes: settings.allowedMimePrefixes ?? null,
    disallowedExtensions: settings.disallowedExtensions ?? null,
    preservedUsernames: settings.preservedUsernames ?? null,
    setupCompleted: settings.setupCompleted,
    allowRemoteUpload: settings.allowRemoteUpload,
    sponsorBannerEnabled: settings.sponsorBannerEnabled,
    disableApiTokens: settings.disableApiTokens,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

export async function adminPutSettings(data: unknown) {
  const parsed = SettingsSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.format() };

  const normalize = <T extends string[] | null | undefined>(v: T) =>
    v && Array.isArray(v) && v.length === 0 ? null : (v ?? null);

  const update: Record<string, unknown> = {
    ...parsed.data,
    allowedMimePrefixes: normalize(parsed.data.allowedMimePrefixes),
    disallowedExtensions: normalize(parsed.data.disallowedExtensions),
    preservedUsernames: normalize(parsed.data.preservedUsernames),
  };

  const updated = await updateServerSettings({
    ...(update as Parameters<typeof updateServerSettings>[0]),
  });

  return { ok: true, settings: updated };
}

const CreateInviteSchema = z.object({
  durationHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365),
  maxUses: z.number().int().min(1).nullable().optional(),
  note: z.string().max(200).optional().nullable(),
});

export async function adminCreateInvite(
  acting: { id: string; role: "owner" | "admin" | "user" },
  body: unknown,
) {
  if (acting.role !== "owner" && acting.role !== "admin") {
    return { ok: false as const, error: "Forbidden" };
  }
  const parsed = CreateInviteSchema.safeParse(body);
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.flatten() };

  const buf = new Uint8Array(24);
  crypto.getRandomValues(buf);
  const token = Buffer.from(buf).toString("base64url");

  const expires = new Date(Date.now() + parsed.data.durationHours * 3600_000);

  const [row] = await db
    .insert(inviteTokens)
    .values({
      token,
      note: parsed.data.note ?? null,
      expiresAt: expires,
      maxUses: parsed.data.maxUses ?? null,
      createdBy: acting.id,
    })
    .returning({
      id: inviteTokens.id,
      token: inviteTokens.token,
      note: inviteTokens.note,
      expiresAt: inviteTokens.expiresAt,
      maxUses: inviteTokens.maxUses,
      usesCount: inviteTokens.usesCount,
      isDisabled: inviteTokens.isDisabled,
      createdAt: inviteTokens.createdAt,
    });

  return { ok: true as const, invite: row };
}

export async function adminListInvites(acting: {
  id: string;
  role: "owner" | "admin" | "user";
}) {
  if (acting.role !== "owner" && acting.role !== "admin") {
    return { ok: false as const, error: "Forbidden" };
  }
  const rows = await db
    .select({
      id: inviteTokens.id,
      token: inviteTokens.token,
      note: inviteTokens.note,
      expiresAt: inviteTokens.expiresAt,
      maxUses: inviteTokens.maxUses,
      usesCount: inviteTokens.usesCount,
      isDisabled: inviteTokens.isDisabled,
      createdAt: inviteTokens.createdAt,
    })
    .from(inviteTokens)
    .orderBy(sql`${inviteTokens.createdAt} DESC`);
  return { ok: true as const, invites: rows };
}

export async function adminDeleteInvite(
  acting: { id: string; role: "owner" | "admin" | "user" },
  id: number,
) {
  if (acting.role !== "owner" && acting.role !== "admin") {
    return { ok: false as const, error: "Forbidden" };
  }
  await db.delete(inviteTokens).where(eq(inviteTokens.id, id));
  return { ok: true as const };
}

const ClearOptionsSchema = z.object({
  filesAll: z.boolean().optional(),
  filesExceptFavorites: z.boolean().optional(),
  links: z.boolean().optional(),
  notes: z.boolean().optional(),
  bookmarks: z.boolean().optional(),
  snippets: z.boolean().optional(),
  recipes: z.boolean().optional(),
  apiTokens: z.boolean().optional(),
});

export async function adminClearUserData(
  acting: { id: string; role: "owner" | "admin" | "user" },
  targetUserId: string,
  body: unknown,
) {
  if (acting.role !== "owner" && acting.role !== "admin") {
    return { ok: false as const, error: "Forbidden" };
  }
  const parsed = ClearOptionsSchema.safeParse(body);
  if (!parsed.success)
    return { ok: false as const, error: parsed.error.flatten() };
  const opts = parsed.data;

  if (!Object.values(opts).some(Boolean)) {
    return { ok: false as const, error: "No options selected" };
  }

  if (opts.filesAll || opts.filesExceptFavorites) {
    try {
      if (opts.filesExceptFavorites) {
        await db
          .delete(files)
          .where(
            and(eq(files.userId, targetUserId), eq(files.isFavorite, false)),
          );
      } else {
        await db.delete(files).where(eq(files.userId, targetUserId));
      }
    } catch (e) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to clear files",
        cause: e,
      });
    }
  }

  if (opts.links) {
    try {
      await db.delete(shortLinks).where(eq(shortLinks.userId, targetUserId));
    } catch (e) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to clear links",
        cause: e,
      });
    }
  }

  if (opts.apiTokens) {
    try {
      await db
        .delete(apiKeySecrets)
        .where(eq(apiKeySecrets.userId, targetUserId));
      await db.delete(apikey).where(eq(apikey.userId, targetUserId));
    } catch (e) {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to clear API tokens",
        cause: e,
      });
    }
  }

  return { ok: true as const };
}
