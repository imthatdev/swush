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

import { db } from "@/db/client";
import { files, shortLinks } from "@/db/schemas";
import { and, eq, gte, isNull } from "drizzle-orm";
import { createNotification } from "@/lib/server/notifications";
import {
  deleteFileFromStorage,
  deletePrefixFromStorage,
  getDefaultStorageDriver,
  type StorageDriver,
} from "@/lib/storage";
import { streamStoredPrefix } from "@/lib/server/stream-paths";
import {
  enqueueStorageCleanupJob,
  kickStorageCleanupRunner,
} from "@/lib/server/storage-cleanup-jobs";

const MAX_VIEWS_ACTIONS = ["make_private", "delete"] as const;
export type MaxViewsAction = (typeof MAX_VIEWS_ACTIONS)[number];

export function normalizeMaxViewsAction(value: unknown): MaxViewsAction | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return (MAX_VIEWS_ACTIONS as readonly string[]).includes(trimmed)
    ? (trimmed as MaxViewsAction)
    : null;
}

export function normalizeMaxViews(value: unknown): number | null {
  if (value === null) return null;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.floor(n);
  if (rounded <= 0) return null;
  return rounded;
}

type MaxViewsRow = {
  id: string;
  userId: string;
  views: number | null;
  maxViews: number | null;
  maxViewsAction: MaxViewsAction | null;
  maxViewsTriggeredAt: Date | null;
};

function shouldTriggerMaxViews(row: MaxViewsRow) {
  if (!row.maxViews || row.maxViews <= 0) return false;
  if (!row.maxViewsAction) return false;
  if (row.maxViewsTriggeredAt) return false;
  return (row.views ?? 0) >= row.maxViews;
}

async function notifyMaxViews(params: {
  userId: string;
  title: string;
  message: string;
  data?: Record<string, unknown> | null;
}) {
  await createNotification({
    userId: params.userId,
    title: params.title,
    message: params.message,
    type: "max-views",
    data: params.data ?? null,
  });
}

async function deleteFileAssets(file: {
  id: string;
  userId: string;
  storedName: string | null;
  storageDriver?: StorageDriver | null;
}) {
  if (!file.storedName) return;
  const driver = file.storageDriver ?? (await getDefaultStorageDriver());

  try {
    await deleteFileFromStorage(
      { userId: file.userId, storedName: file.storedName },
      { driver },
    );
  } catch (err) {
    console.warn("Failed to delete file from storage", {
      userId: file.userId,
      storedName: file.storedName,
      error: err,
    });
    const jobId = await enqueueStorageCleanupJob({
      userId: file.userId,
      storedName: file.storedName,
      driver,
      isPrefix: false,
    });
    setImmediate(() => {
      void kickStorageCleanupRunner({ jobId }).catch(() => {});
    });
  }

  const previewStoredName = file.storedName.includes(".")
    ? file.storedName.replace(/\.[^.]+$/, ".png")
    : `${file.storedName}.png`;

  try {
    await deleteFileFromStorage(
      { userId: file.userId, storedName: previewStoredName },
      { driver },
    );
  } catch (err) {
    console.warn("Failed to delete preview from storage", {
      previewStoredName,
      userId: file.userId,
      error: err,
    });
    const jobId = await enqueueStorageCleanupJob({
      userId: file.userId,
      storedName: previewStoredName,
      driver,
      isPrefix: false,
    });
    setImmediate(() => {
      void kickStorageCleanupRunner({ jobId }).catch(() => {});
    });
  }

  try {
    await deletePrefixFromStorage(
      { userId: file.userId, storedName: streamStoredPrefix(file.id) },
      { driver },
    );
  } catch (err) {
    console.warn("Failed to delete stream assets from storage", {
      userId: file.userId,
      fileId: file.id,
      error: err,
    });
    const jobId = await enqueueStorageCleanupJob({
      userId: file.userId,
      storedName: streamStoredPrefix(file.id),
      driver,
      isPrefix: true,
    });
    setImmediate(() => {
      void kickStorageCleanupRunner({ jobId }).catch(() => {});
    });
  }
}

export async function handleFileMaxViews(row: typeof files.$inferSelect) {
  if (!shouldTriggerMaxViews(row)) return;
  const action = row.maxViewsAction;
  if (!action) return;

  if (action === "make_private") {
    const [updated] = await db
      .update(files)
      .set({
        isPublic: false,
        password: null,
        maxViews: null,
        maxViewsAction: null,
        maxViewsTriggeredAt: null,
      })
      .where(
        and(
          eq(files.id, row.id),
          isNull(files.maxViewsTriggeredAt),
          gte(files.views, row.maxViews ?? 0),
        ),
      )
      .returning();
    if (!updated.maxViewsAction) return;

    await notifyMaxViews({
      userId: row.userId,
      title: "File made private",
      message: `\"${row.originalName}\" reached its max views and was set to private.`,
      data: { action, fileId: row.id, slug: row.slug },
    });
    return;
  }

  const [marked] = await db
    .update(files)
    .set({ maxViewsTriggeredAt: new Date() })
    .where(
      and(
        eq(files.id, row.id),
        isNull(files.maxViewsTriggeredAt),
        gte(files.views, row.maxViews ?? 0),
      ),
    )
    .returning();

  if (!marked.maxViewsAction) return;

  await deleteFileAssets({
    id: row.id,
    userId: row.userId,
    storedName: row.storedName ?? null,
    storageDriver: (row.storageDriver as StorageDriver) ?? undefined,
  });
  await db.delete(files).where(eq(files.id, row.id));

  await notifyMaxViews({
    userId: row.userId,
    title: "File deleted",
    message: `\"${row.originalName}\" reached its max views and was deleted.`,
    data: { action, fileId: row.id, slug: row.slug },
  });
}

export async function handleShortLinkMaxViews(
  row: typeof shortLinks.$inferSelect,
) {
  const viewsRow = {
    id: row.id,
    userId: row.userId ?? "",
    views: row.clickCount ?? 0,
    maxViews: row.maxClicks ?? null,
    maxViewsAction: row.maxViewsAction as MaxViewsAction | null,
    maxViewsTriggeredAt: row.maxViewsTriggeredAt ?? null,
  } satisfies MaxViewsRow;

  if (!shouldTriggerMaxViews(viewsRow)) return;
  const action = viewsRow.maxViewsAction;
  if (!action) return;

  if (action === "make_private") {
    const [updated] = await db
      .update(shortLinks)
      .set({
        isPublic: false,
        password: null,
        maxClicks: null,
        maxViewsAction: null,
        maxViewsTriggeredAt: null,
      })
      .where(
        and(
          eq(shortLinks.id, row.id),
          isNull(shortLinks.maxViewsTriggeredAt),
          gte(shortLinks.clickCount, row.maxClicks ?? 0),
        ),
      )
      .returning();
    if (!updated.maxViewsAction) return;

    if (row.userId) {
      await notifyMaxViews({
        userId: row.userId,
        title: "Short link made private",
        message: `\"${row.slug}\" reached its max views and was set to private.`,
        data: { action, shortLinkId: row.id, slug: row.slug },
      });
    }
    return;
  }

  const [marked] = await db
    .update(shortLinks)
    .set({ maxViewsTriggeredAt: new Date() })
    .where(
      and(
        eq(shortLinks.id, row.id),
        isNull(shortLinks.maxViewsTriggeredAt),
        gte(shortLinks.clickCount, row.maxClicks ?? 0),
      ),
    )
    .returning();
  if (!marked.maxViewsAction) return;

  await db.delete(shortLinks).where(eq(shortLinks.id, row.id));

  if (row.userId) {
    await notifyMaxViews({
      userId: row.userId,
      title: "Short link deleted",
      message: `\"${row.slug}\" reached its max views and was deleted.`,
      data: { action, shortLinkId: row.id, slug: row.slug },
    });
  }
}
