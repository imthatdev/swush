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

import archiver from "archiver";
import { PassThrough } from "stream";
import { createReadStream, createWriteStream } from "fs";
import { mkdtemp, rm, stat } from "fs/promises";
import os from "os";
import path from "path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { exportJobs } from "@/db/schemas";
import { appendExportData, type ExportOptions } from "@/lib/server/export";
import { getDefaultStorageDriver, putStreamToStorage } from "@/lib/storage";
import { createNotification } from "@/lib/server/notifications";

export async function runExportJob(jobId: string, userId: string) {
  const [job] = await db
    .select()
    .from(exportJobs)
    .where(and(eq(exportJobs.id, jobId), eq(exportJobs.userId, userId)))
    .limit(1);
  if (!job) return;

  await db
    .update(exportJobs)
    .set({ status: "processing", updatedAt: new Date(), error: null })
    .where(eq(exportJobs.id, jobId));

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10);
  const storedName = `exports/${jobId}.zip`;
  const fileName = `swush-backup-${datePart}.zip`;

  try {
    let exportedSize: number | null = null;
    const options = (job.options ?? null) as ExportOptions | null;
    const driver = await getDefaultStorageDriver();
    if (driver === "s3") {
      const tmpDir = await mkdtemp(path.join(os.tmpdir(), "swush-export-"));
      const tmpPath = path.join(tmpDir, `${jobId}.zip`);
      const archive = archiver("zip", { zlib: { level: 9 } });

      try {
        await new Promise<void>((resolve, reject) => {
          const out = createWriteStream(tmpPath);
          const onError = (err: Error) => reject(err);
          const onWarning = (err: Error & { code?: string }) => {
            if (err.code !== "ENOENT") reject(err);
          };

          out.on("close", () => resolve());
          out.on("error", onError);
          archive.on("error", onError);
          archive.on("warning", onWarning);
          archive.pipe(out);
          appendExportData(archive, userId, options)
            .then(() => archive.finalize())
            .catch(reject);
        });

        const stats = await stat(tmpPath);
        exportedSize = stats.size;
        const stream = createReadStream(tmpPath);
        await putStreamToStorage({
          target: { userId, storedName },
          stream,
          contentType: "application/zip",
          cacheControl: "no-store",
          contentLength: stats.size,
          driver,
        });
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    } else {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const pass = new PassThrough();
      archive.on("warning", (err) => {
        if (err.code !== "ENOENT") {
          pass.destroy(err);
        }
      });
      archive.on("error", (err) => {
        pass.destroy(err);
      });
      archive.pipe(pass);

      const putPromise = putStreamToStorage({
        target: { userId, storedName },
        stream: pass,
        contentType: "application/zip",
        cacheControl: "no-store",
        driver,
      });

      await appendExportData(archive, userId, options);
      await archive.finalize();
      await putPromise;
    }

    await db
      .update(exportJobs)
      .set({
        status: "ready",
        fileName,
        storedName,
        storageDriver: driver,
        size: exportedSize ?? undefined,
        updatedAt: new Date(),
        error: null,
      })
      .where(eq(exportJobs.id, jobId));

    await createNotification({
      userId,
      title: "Export ready",
      message: `Backup ${datePart} is ready to download.`,
      type: "system",
      data: { exportId: jobId },
    });
  } catch (err) {
    await db
      .update(exportJobs)
      .set({
        status: "failed",
        error: (err as Error)?.message || "Export failed",
        updatedAt: new Date(),
      })
      .where(eq(exportJobs.id, jobId));
  }
}
