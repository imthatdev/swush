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
import { audioMetadata, files } from "@/db/schemas";
import { and, eq } from "drizzle-orm";
import { extractAudioMetadata } from "@/lib/server/audio-metadata";
import { isMedia } from "@/lib/mime-types";

type AudioMetaJobInput = {
  fileId: string;
  userId: string;
};

const pendingJobs: AudioMetaJobInput[] = [];
const pendingIds = new Set<string>();
let runnerActive = false;

async function processJob(job: AudioMetaJobInput) {
  const [file] = await db
    .select({
      id: files.id,
      userId: files.userId,
      storedName: files.storedName,
      mimeType: files.mimeType,
      originalName: files.originalName,
      storageDriver: files.storageDriver,
    })
    .from(files)
    .where(and(eq(files.id, job.fileId), eq(files.userId, job.userId)))
    .limit(1);

  if (!file) return;
  if (!isMedia("audio", file.mimeType, file.originalName)) return;

  const existing = await db
    .select({ id: audioMetadata.id })
    .from(audioMetadata)
    .where(eq(audioMetadata.fileId, file.id))
    .limit(1);
  if (existing.length) return;

  const driver = file.storageDriver === "s3" ? "s3" : "local";
  const extracted = await extractAudioMetadata(
    { userId: file.userId, storedName: file.storedName },
    driver,
  );

  if (!extracted) return;

  await db
    .insert(audioMetadata)
    .values({
      fileId: file.id,
      title: extracted.title ?? null,
      artist: extracted.artist ?? null,
      album: extracted.album ?? null,
      pictureDataUrl: extracted.pictureDataUrl ?? null,
      gradient: extracted.gradient ?? null,
    })
    .onConflictDoNothing();
}

async function runJobs(limit = 3) {
  let processed = 0;
  while (pendingJobs.length && processed < limit) {
    const job = pendingJobs.shift();
    if (!job) break;
    pendingIds.delete(job.fileId);
    try {
      await processJob(job);
    } catch {
      // ignore
    }
    processed += 1;
  }
  return processed;
}

export async function kickAudioMetadataRunner(limit = 3) {
  if (runnerActive) return { processed: 0 };
  runnerActive = true;
  try {
    const processed = await runJobs(limit);
    return { processed };
  } finally {
    runnerActive = false;
    if (pendingJobs.length) {
      setImmediate(() => {
        void kickAudioMetadataRunner(limit).catch(() => {});
      });
    }
  }
}

export function enqueueAudioMetadataJob(input: AudioMetaJobInput) {
  if (pendingIds.has(input.fileId)) return false;
  pendingIds.add(input.fileId);
  pendingJobs.push(input);
  setImmediate(() => {
    void kickAudioMetadataRunner().catch(() => {});
  });
  return true;
}
