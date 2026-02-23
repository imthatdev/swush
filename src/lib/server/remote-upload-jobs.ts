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
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { remoteUploadJobs } from "@/db/schemas";
import { and, eq, inArray } from "drizzle-orm";
import { downloadWithYtDlp } from "@/lib/server/yt-dlp";
import { getDefaultStorageDriver, putFileToStorage } from "@/lib/storage";
import { files as filesTable } from "@/db/schemas/core-schema";
import path from "path";
import { fileTypeFromBuffer } from "file-type";
import { enqueuePreviewJob, kickPreviewRunner } from "./preview-jobs";
import { enqueueStreamJob, kickStreamRunner } from "./stream-jobs";
import { createNotification } from "./notifications";
import { getUserUploadSettings } from "@/lib/server/upload-settings";

export type RemoteUploadJobStatus =
  | "queued"
  | "downloading"
  | "processing"
  | "completed"
  | "failed";

export type RemoteUploadJob = {
  id: string;
  userId: string;
  url: string;
  name?: string | null;
  status: RemoteUploadJobStatus;
  percent: number;
  fileId?: string | null;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function appendExtIfMissing(name: string, ext: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (!ext || trimmed.toLowerCase().endsWith(ext.toLowerCase())) return trimmed;
  return `${trimmed}${ext}`;
}

export async function createRemoteUploadJob(
  userId: string,
  url: string,
  name?: string,
): Promise<RemoteUploadJob> {
  const id = nanoid();
  const now = new Date();
  const job: RemoteUploadJob = {
    id,
    userId,
    url,
    name,
    status: "queued",
    percent: 0,
    fileId: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(remoteUploadJobs).values(job);
  void runRemoteUploadJob(id);
  return job;
}

export async function getRemoteUploadJob(
  id: string,
): Promise<RemoteUploadJob | null> {
  const rows = await db
    .select()
    .from(remoteUploadJobs)
    .where(eq(remoteUploadJobs.id, id));
  if (!rows[0]) return null;
  return {
    ...rows[0],
    status: rows[0].status as RemoteUploadJobStatus,
  };
}

export async function listRemoteUploadJobs(
  userId: string,
): Promise<RemoteUploadJob[]> {
  const rows = await db
    .select()
    .from(remoteUploadJobs)
    .where(eq(remoteUploadJobs.userId, userId));
  return rows.map((row) => ({
    ...row,
    status: row.status as RemoteUploadJobStatus,
  }));
}

async function runRemoteUploadJob(id: string) {
  let job = await getRemoteUploadJob(id);
  if (!job) return;

  const update = async (fields: Partial<RemoteUploadJob>) => {
    await db
      .update(remoteUploadJobs)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(remoteUploadJobs.id, id));
    job = await getRemoteUploadJob(id);
  };

  await update({ status: "downloading", percent: 0 });

  try {
    const tmp = await downloadWithYtDlp(job.url, "remote", async (p) => {
      const percent = Math.max(0, Math.min(80, Math.round((p ?? 0) * 0.8)));
      await update({ percent });
    });
    await update({ status: "processing", percent: 80 });

    const { readFile, unlink } = await import("fs/promises");
    const buf = await readFile(tmp.filePath);
    const size = buf.length;
    await update({ percent: 85 });

    const sig = await fileTypeFromBuffer(buf);
    const effectiveMime = sig?.mime || "application/octet-stream";
    const ext = path.extname(tmp.fileName) || "";
    const storedName = `${nanoid()}${ext}`;

    const sourceName = tmp.sourceTitle?.trim();
    const payloadName = job.name?.trim();
    const fallbackName = `remote-${nanoid(8)}`;
    const baseName =
      sourceName && sourceName.length > 0
        ? sourceName
        : payloadName && payloadName.length > 0
          ? payloadName
          : fallbackName;
    const originalName = appendExtIfMissing(baseName, ext);

    const driver = await getDefaultStorageDriver();
    await putFileToStorage({
      target: { userId: job.userId, storedName },
      buffer: buf,
      contentType: effectiveMime,
      driver,
    });
    await update({ percent: 90 });

    try {
      await unlink(tmp.filePath);
    } catch {}

    const [row] = await db
      .insert(filesTable)
      .values({
        userId: job.userId,
        folderId: null,
        originalName,
        storedName,
        storageDriver: driver,
        mimeType: effectiveMime,
        size,
        slug: `${nanoid()}`,
        description: null,
        isPublic: false,
        password: null,
      })
      .returning();
    await update({ percent: 95 });

    if (
      effectiveMime.startsWith("video/") ||
      (effectiveMime.startsWith("image/") && effectiveMime !== "image/svg+xml")
    ) {
      const previewJobId = await enqueuePreviewJob({
        userId: job.userId,
        fileId: row.id,
      });
      setImmediate(() => {
        void kickPreviewRunner({ jobId: previewJobId }).catch(() => {});
      });
    }

    if (
      effectiveMime.startsWith("video/") ||
      effectiveMime.startsWith("audio/")
    ) {
      const userSettings = await getUserUploadSettings(job.userId);
      const streamQuality = userSettings.mediaTranscodeEnabled
        ? userSettings.mediaTranscodeQuality
        : 100;
      const streamJobId = await enqueueStreamJob({
        userId: job.userId,
        fileId: row.id,
        quality: streamQuality,
      });
      setImmediate(() => {
        void kickStreamRunner({ jobId: streamJobId }).catch(() => {});
      });
    }

    await update({ percent: 100, status: "completed", fileId: row.id });
    await createNotification({
      userId: job.userId,
      title: "Remote upload completed",
      message: `Your remote upload for ${job.url} is complete!`,
      type: "remote-upload",
      data: { jobId: job.id, fileId: row.id, url: job.url },
    });
  } catch (err) {
    await update({
      status: "failed",
      error: (err as Error)?.message ?? "failed",
    });
  }
}

export async function deleteRemoteUploadJobs(
  userId: string,
  ids: string[],
): Promise<void> {
  if (!Array.isArray(ids) || ids.length === 0) return;
  await db
    .delete(remoteUploadJobs)
    .where(
      and(
        eq(remoteUploadJobs.userId, userId),
        inArray(remoteUploadJobs.id, ids),
      ),
    );
}
