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

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  filesToTags as filesToTagsTable,
  folders as foldersTable,
  tags as tagsTable,
} from "@/db/schemas/core-schema";
import { generateFunnySlug } from "@/lib/funny-slug";
import { nanoid } from "nanoid";
import path from "path";
import type { NameConvention, SlugConvention } from "@/lib/upload-conventions";
import { normalizeTagName } from "@/lib/tag-names";

export function buildSlugForUser(
  desiredSlug: string,
  user: { role?: string | null; username?: string | null },
) {
  if (!desiredSlug || desiredSlug.trim() === "") {
    return generateFunnySlug("files");
  }
  if (user.role === "owner") {
    return Promise.resolve(desiredSlug.trim());
  }
  const desired = desiredSlug.trim();
  const prefix = `${user.username ?? "user"}@`;
  return Promise.resolve(
    desired.startsWith(prefix) ? desired : `${prefix}${desired}`,
  );
}

const pad = (value: number) => String(value).padStart(2, "0");

function formatDateStamp(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export async function buildNameWithConvention(params: {
  explicitName?: string | null;
  fileName: string;
  convention: NameConvention;
}) {
  const { explicitName, fileName, convention } = params;
  if (explicitName && explicitName.trim()) return explicitName.trim();

  const ext = (path.extname(fileName) || "").toLowerCase();
  const now = new Date();

  switch (convention) {
    case "random":
      return `${nanoid(10)}${ext}`;
    case "date":
      return `${formatDateStamp(now)}${ext}`;
    case "funny": {
      const funny = await generateFunnySlug("files");
      return `${funny}${ext}`;
    }
    case "original":
    default:
      return fileName;
  }
}

export async function buildSlugWithConvention(params: {
  desiredSlug?: string | null;
  originalName: string;
  convention: SlugConvention;
  user: { role?: string | null; username?: string | null };
}) {
  const { desiredSlug, convention, user } = params;
  if (desiredSlug && desiredSlug.trim()) {
    return buildSlugForUser(desiredSlug.trim(), user);
  }

  const now = new Date();

  let base: string;
  switch (convention) {
    case "random":
      base = nanoid(10);
      break;
    case "date":
      base = formatDateStamp(now);
      break;
    case "funny":
    default:
      base = await generateFunnySlug("files");
      break;
  }

  return buildSlugForUser(base, user);
}

export async function resolveFolderId(params: {
  userId: string;
  incomingFolderId: string | null;
  incomingFolderName: string;
}) {
  const { userId, incomingFolderId, incomingFolderName } = params;
  let folderId: string | null = null;

  if (incomingFolderId) {
    const own = await db
      .select({ id: foldersTable.id })
      .from(foldersTable)
      .where(
        and(
          eq(foldersTable.id, incomingFolderId),
          eq(foldersTable.userId, userId),
        ),
      )
      .limit(1);
    if (own.length > 0) folderId = own[0].id;
  }

  if (!folderId && incomingFolderName) {
    const existing = await db
      .select()
      .from(foldersTable)
      .where(
        and(
          eq(foldersTable.userId, userId),
          eq(foldersTable.name, incomingFolderName),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      folderId = existing[0].id;
    } else {
      const [created] = await db
        .insert(foldersTable)
        .values({ userId, name: incomingFolderName })
        .returning();
      folderId = created.id;
    }
  }

  return folderId;
}

export async function resolveTagsForFile(params: {
  userId: string;
  fileId: string;
  incomingTagIds: string[];
  incomingNewTagNames: string[];
}) {
  const { userId, fileId, incomingTagIds, incomingNewTagNames } = params;
  const verifiedTagIds: string[] = [];

  if (incomingTagIds.length > 0) {
    const existing = await db
      .select({ id: tagsTable.id })
      .from(tagsTable)
      .where(
        and(
          eq(tagsTable.userId, userId),
          inArray(tagsTable.id, incomingTagIds),
        ),
      );
    verifiedTagIds.push(...existing.map((t) => t.id));
  }

  let createdTags: { id: string; name: string }[] = [];
  if (incomingNewTagNames.length > 0) {
    const normalizedNames = incomingNewTagNames
      .map((n) => normalizeTagName(n))
      .filter(Boolean);
    const namesLower = normalizedNames.map((n) => n.toLowerCase());
    const already = namesLower.length
      ? await db
          .select()
          .from(tagsTable)
          .where(
            and(
              eq(tagsTable.userId, userId),
              inArray(tagsTable.name, normalizedNames),
            ),
          )
      : [];
    const alreadySet = new Set(already.map((t) => t.name.toLowerCase()));
    const toCreate = normalizedNames.filter(
      (n) => !alreadySet.has(n.toLowerCase()),
    );

    if (toCreate.length > 0) {
      const inserted = await db
        .insert(tagsTable)
        .values(toCreate.map((name) => ({ userId, name })))
        .returning({ id: tagsTable.id, name: tagsTable.name });
      createdTags = inserted;
    }
    createdTags = [
      ...already.map((t) => ({ id: t.id, name: t.name })),
      ...createdTags,
    ];
  }

  const allTagIds = Array.from(
    new Set([...verifiedTagIds, ...createdTags.map((t) => t.id)]),
  );
  if (allTagIds.length > 0) {
    await db
      .insert(filesToTagsTable)
      .values(allTagIds.map((tagId) => ({ fileId, tagId })));
  }

  const responseTags =
    allTagIds.length > 0
      ? await db
          .select({ id: tagsTable.id, name: tagsTable.name })
          .from(tagsTable)
          .where(inArray(tagsTable.id, allTagIds))
      : [];

  return responseTags;
}
