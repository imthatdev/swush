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

import type { NextRequest } from "next/server";
import { db } from "@/db/client";
import {
  files as filesTbl,
  filesToTags as ftTags,
  tags as tagsTbl,
} from "@/db/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { buildSlugForUser } from "./helpers";
import { findFileByKey } from "./shared";
import { hashPassword } from "@/lib/api/password";
import {
  normalizeMaxViews,
  normalizeMaxViewsAction,
} from "@/lib/server/max-views";

export async function patchFile(req: NextRequest, key: string) {
  const rows = await findFileByKey(key);
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req);
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };
  if (rows.length === 0)
    return { status: 404 as const, body: { message: "Not found" } };
  const f = rows[0];
  if (f.userId !== user.id)
    return { status: 403 as const, body: { message: "Forbidden" } };

  let body;
  try {
    body = await req.json();
  } catch {
    return { status: 400 as const, body: { message: "Invalid JSON" } };
  }

  const {
    isPublic,
    description,
    originalName,
    folderId,
    addTagIds,
    removeTagIds,
    newSlug,
    password,
    maxViews,
    maxViewsAction,
    anonymousShareEnabled,
  } = (body ?? {}) as Partial<{
    isPublic: boolean | string;
    description: string | null;
    originalName: string;
    folderId: string | null;
    addTagIds: string[];
    removeTagIds: string[];
    newSlug: string;
    password: string | null;
    maxViews: number | string | null;
    maxViewsAction: string | null;
    anonymousShareEnabled: boolean;
  }>;

  const updateValues: Record<string, unknown> = {};
  const parsedIsPublic =
    typeof isPublic === "string"
      ? isPublic.toLowerCase() === "true"
      : typeof isPublic === "boolean"
        ? isPublic
        : undefined;
  if (typeof parsedIsPublic === "boolean")
    updateValues.isPublic = parsedIsPublic;
  if (typeof description === "string" || description === null)
    updateValues.description = description;
  if (typeof originalName === "string" && originalName.trim())
    updateValues.originalName = originalName.trim();
  if (typeof folderId === "string" || folderId === null)
    updateValues.folderId = folderId ?? null;
  if (typeof anonymousShareEnabled === "boolean")
    updateValues.anonymousShareEnabled = anonymousShareEnabled;

  if (typeof newSlug === "string") {
    const candidate = await buildSlugForUser(newSlug.trim(), {
      role: user.role,
      username: user.username,
    });

    if (candidate === f.slug) {
      return { status: 200 as const, body: { message: "No changes made" } };
    }

    const conflict = await db
      .select({ id: filesTbl.id })
      .from(filesTbl)
      .where(eq(filesTbl.slug, candidate))
      .limit(1);
    if (conflict.length && conflict[0].id !== f.id) {
      return { status: 409 as const, body: { message: "Slug already in use" } };
    }

    updateValues.slug = candidate;
  }

  if (typeof password === "string") {
    const p = password.trim();
    updateValues.password = p.length === 0 ? null : await hashPassword(p);
  } else if (password === null) {
    updateValues.password = null;
  }

  if (maxViews !== undefined || maxViewsAction !== undefined) {
    const nextMaxViews =
      maxViews !== undefined
        ? normalizeMaxViews(maxViews)
        : (f.maxViews ?? null);
    const nextAction =
      maxViewsAction !== undefined
        ? normalizeMaxViewsAction(maxViewsAction)
        : (f.maxViewsAction as string | null);
    updateValues.maxViews = nextMaxViews;
    updateValues.maxViewsAction = nextMaxViews ? nextAction : null;
    updateValues.maxViewsTriggeredAt = null;
  }

  if (Object.keys(updateValues).length > 0) {
    await db.update(filesTbl).set(updateValues).where(eq(filesTbl.id, f.id));
  }

  if (Array.isArray(addTagIds) && addTagIds.length > 0) {
    const addSet = Array.from(
      new Set(
        addTagIds.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        ),
      ),
    );
    if (addSet.length) {
      const owned = await db
        .select({ id: tagsTbl.id })
        .from(tagsTbl)
        .where(and(eq(tagsTbl.userId, user.id), inArray(tagsTbl.id, addSet)));
      const ownedIds = owned.map((t) => t.id);
      if (ownedIds.length) {
        await db
          .insert(ftTags)
          .values(ownedIds.map((tagId) => ({ fileId: f.id, tagId })))
          .onConflictDoNothing();
      }
    }
  }

  if (Array.isArray(removeTagIds) && removeTagIds.length > 0) {
    const remSet = Array.from(
      new Set(
        removeTagIds.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        ),
      ),
    );
    if (remSet.length) {
      await db
        .delete(ftTags)
        .where(and(eq(ftTags.fileId, f.id), inArray(ftTags.tagId, remSet)));
    }
  }

  const freshRows = await db
    .select()
    .from(filesTbl)
    .where(eq(filesTbl.id, f.id))
    .limit(1);
  const fresh = freshRows[0] ?? f;
  const freshTags = await db
    .select({ name: tagsTbl.name })
    .from(ftTags)
    .leftJoin(tagsTbl, eq(ftTags.tagId, tagsTbl.id))
    .where(eq(ftTags.fileId, fresh.id));
  const freshTagNames = freshTags
    .map((r) => r.name)
    .filter((n): n is string => !!n);

  return {
    status: 200 as const,
    body: { message: "Updated", file: { ...fresh, tags: freshTagNames } },
  };
}
