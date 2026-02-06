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
import { files, mediaJobs } from "@/db/schemas";
import {
  readFromStorage,
  putFileToStorage,
  type StorageDriver,
} from "@/lib/storage";
import {
  optimizeImageBuffer,
  transcodeMediaBuffer,
} from "@/lib/server/media-optimization";
import { createNotification } from "@/lib/server/notifications";

export type MediaJobKind = "image" | "video" | "audio";

type MediaJobInput = {
  userId: string;
  fileId: string;
  kind: MediaJobKind;
  quality?: number;
};

async function streamToBuffer(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function readStorageBuffer(
  target: { userId: string; storedName: string },
  driver: StorageDriver,
) {
  const res = await readFromStorage(target, { driver });
  if (!res) return null;
  return streamToBuffer(res.stream);
}

export async function enqueueMediaJob(input: MediaJobInput) {
  await db.insert(mediaJobs).values({
    userId: input.userId,
    fileId: input.fileId,
    kind: input.kind,
    quality: input.quality ?? 80,
    status: "queued",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function runMediaJobs(limit = 3) {
  const jobs = await db
    .select()
    .from(mediaJobs)
    .where(
      and(
        eq(mediaJobs.status, "queued"),
        inArray(mediaJobs.kind, ["image", "video", "audio"]),
      ),
    )
    .orderBy(mediaJobs.createdAt)
    .limit(limit);

  if (!jobs.length) return { processed: 0 };

  for (const job of jobs) {
    await db
      .update(mediaJobs)
      .set({ status: "processing", updatedAt: new Date(), error: null })
      .where(eq(mediaJobs.id, job.id));

    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, job.fileId), eq(files.userId, job.userId)))
      .limit(1);

    if (!file) {
      await db
        .update(mediaJobs)
        .set({
          status: "failed",
          error: "File not found",
          updatedAt: new Date(),
        })
        .where(eq(mediaJobs.id, job.id));
      continue;
    }

    const driver = (file.storageDriver || "local") as StorageDriver;
    try {
      const buffer = await readStorageBuffer(
        { userId: file.userId, storedName: file.storedName },
        driver,
      );
      if (!buffer) {
        throw new Error("Failed to load stored file");
      }

      const optimized =
        job.kind === "image"
          ? await optimizeImageBuffer(buffer, file.mimeType, job.quality)
          : await transcodeMediaBuffer(buffer, file.mimeType, job.quality);

      await putFileToStorage({
        target: { userId: file.userId, storedName: file.storedName },
        buffer: optimized.buffer,
        contentType: optimized.mimeType,
        driver,
      });

      await db
        .update(files)
        .set({ mimeType: optimized.mimeType, size: optimized.buffer.length })
        .where(eq(files.id, file.id));

      await db
        .update(mediaJobs)
        .set({
          status: "ready",
          outputMimeType: optimized.mimeType,
          outputSize: optimized.buffer.length,
          updatedAt: new Date(),
          error: null,
        })
        .where(eq(mediaJobs.id, job.id));

      await createNotification({
        userId: file.userId,
        title: "Media optimized",
        message: `${file.originalName} is ready.`,
        type: "media",
        data: { fileId: file.id, slug: file.slug },
      });
    } catch (err) {
      const msg = String(
        (err as Error)?.message || "Optimization failed",
      ).slice(0, 1024);

      await db
        .update(mediaJobs)
        .set({
          status: "failed",
          error: msg,
          updatedAt: new Date(),
        })
        .where(eq(mediaJobs.id, job.id));

      await createNotification({
        userId: file.userId,
        title: "Media optimization failed",
        message: `${file.originalName} could not be optimized.`,
        type: "media",
        data: { fileId: file.id, slug: file.slug },
      });
    }
  }

  return { processed: jobs.length };
}
