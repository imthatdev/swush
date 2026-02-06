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
import { files as filesTbl } from "@/db/schemas";
import { eq } from "drizzle-orm";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import {
  deleteFileFromStorage,
  deletePrefixFromStorage,
  getDefaultStorageDriver,
  type StorageDriver,
} from "@/lib/storage";
import { findFileByKey } from "./shared";
import { SwushErrors } from "@/lib/errors/swush-error";
import { streamStoredPrefix } from "@/lib/server/stream-paths";
import {
  enqueueStorageCleanupJob,
  kickStorageCleanupRunner,
} from "@/lib/server/storage-cleanup-jobs";

export async function deleteFile(req: NextRequest, key: string) {
  const rows = await findFileByKey(key);
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req);
  if (!user) throw SwushErrors.unauthorized();
  if (rows.length === 0) throw SwushErrors.notFound();
  const f = rows[0];
  if (f.userId !== user.id) throw SwushErrors.forbidden();

  if (f.storedName) {
    const driver =
      (f as { storageDriver?: StorageDriver }).storageDriver ??
      (await getDefaultStorageDriver());

    try {
      await deleteFileFromStorage(
        { userId: f.userId, storedName: f.storedName },
        { driver },
      );
    } catch (err) {
      console.warn("Failed to delete file from storage", {
        userId: f.userId,
        storedName: f.storedName,
        error: err,
      });
      const jobId = await enqueueStorageCleanupJob({
        userId: f.userId,
        storedName: f.storedName,
        driver,
        isPrefix: false,
      });
      setImmediate(() => {
        void kickStorageCleanupRunner({ jobId }).catch(() => {});
      });
    }

    const previewStoredName = f.storedName.includes(".")
      ? f.storedName.replace(/\.[^.]+$/, ".png")
      : `${f.storedName}.png`;
    try {
      await deleteFileFromStorage(
        { userId: f.userId, storedName: previewStoredName },
        { driver },
      );
    } catch (err) {
      console.warn("Failed to delete preview from storage", {
        previewStoredName,
        userId: f.userId,
        error: err,
      });
      const jobId = await enqueueStorageCleanupJob({
        userId: f.userId,
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
        { userId: f.userId, storedName: streamStoredPrefix(f.id) },
        { driver },
      );
    } catch (err) {
      console.warn("Failed to delete stream assets from storage", {
        userId: f.userId,
        fileId: f.id,
        error: err,
      });
      const jobId = await enqueueStorageCleanupJob({
        userId: f.userId,
        storedName: streamStoredPrefix(f.id),
        driver,
        isPrefix: true,
      });
      setImmediate(() => {
        void kickStorageCleanupRunner({ jobId }).catch(() => {});
      });
    }
  }

  try {
    await db.delete(filesTbl).where(eq(filesTbl.id, f.id));
  } catch (err) {
    console.warn("Failed to delete file record", {
      fileId: f.id,
      userId: f.userId,
      error: err,
    });
    throw SwushErrors.internal("Failed to delete file record", { cause: err });
  }

  return { status: 200 as const, body: { message: "Deleted" } };
}
