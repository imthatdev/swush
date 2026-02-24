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

import path from "path";
import { createReadStream, createWriteStream } from "fs";
import {
  mkdir,
  open,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "fs/promises";
import { finished } from "stream/promises";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { db } from "@/db/client";
import { eq } from "drizzle-orm";
import { files as filesTable } from "@/db/schemas/core-schema";
import { getServerSettings } from "@/lib/settings";
import { fileTypeFromBuffer } from "file-type";
import {
  enforceCreateLimit,
  enforceUploadPolicy,
  LimitPolicyError,
  Role,
} from "@/lib/security/policy";
import {
  buildObjectKey,
  getDefaultStorageDriver,
  getUploadRoot,
  type StorageDriver,
} from "@/lib/storage";
import { getUploadRuntimeSettings } from "@/lib/server/runtime-settings";
import { getStorageConfig } from "@/lib/server/storage-config";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import {
  buildNameWithConvention,
  buildSlugWithConvention,
  resolveFolderId,
  resolveTagsForFile,
} from "./helpers";
import {
  getUserUploadSettings,
  normalizeNameConvention,
  normalizeSlugConvention,
} from "@/lib/server/upload-settings";
import { enqueueMediaJob } from "@/lib/server/media-jobs";
import {
  enqueuePreviewJob,
  kickPreviewRunner,
} from "@/lib/server/preview-jobs";
import { enqueueStreamJob, kickStreamRunner } from "@/lib/server/stream-jobs";
import { hashPassword } from "@/lib/api/password";
import {
  normalizeMaxViews,
  normalizeMaxViewsAction,
} from "@/lib/server/max-views";

type ChunkedUploadMeta = {
  uploadId: string;
  userId: string;
  size: number;
  chunkSize: number;
  totalParts: number;
  originalName: string;
  mimeType: string;
  storedName: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  incomingFolderId: string | null;
  incomingFolderName: string;
  incomingTagIds: string[];
  incomingNewTagNames: string[];
  passwordHash: string | null;
  maxViews: number | null;
  maxViewsAction: string | null;
  contentHash: string | null;
  createdAt: string;
  storageDriver: StorageDriver;
};

const MIN_CHUNK_SIZE = 256 * 1024;
async function getMaxChunkSizeBytes() {
  const { uploadMaxChunkMb } = await getUploadRuntimeSettings();
  if (!Number.isFinite(uploadMaxChunkMb) || uploadMaxChunkMb <= 0) {
    return 95 * 1024 * 1024;
  }
  return Math.round(uploadMaxChunkMb * 1024 * 1024);
}
const S3_MIN_PART_SIZE = 5 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = (() => {
  const mb = Number(process.env.UPLOAD_CHUNK_SIZE_MB);
  if (Number.isFinite(mb) && mb > 0) return Math.round(mb * 1024 * 1024);
  const bytes = Number(process.env.UPLOAD_CHUNK_SIZE_BYTES);
  if (Number.isFinite(bytes) && bytes > 0) return Math.round(bytes);
  return 90 * 1024 * 1024;
})();
const CHUNK_TTL_MS = (() => {
  const ttl = Number(process.env.UPLOAD_CHUNK_TTL_MS);
  if (Number.isFinite(ttl) && ttl > 0) return Math.round(ttl);
  return 24 * 60 * 60 * 1000;
})();
const RETRY_HINTS = {
  baseMs: 500,
  maxMs: 8000,
  jitter: true,
  maxRetries: 8,
} as const;

function safeJoin(base: string, ...segments: string[]) {
  const normalizedBase = path.normalize(base);
  const sanitized = segments
    .flatMap((segment) =>
      segment
        .replace(/^[\\/]+/, "")
        .split(/[\\/]+/)
        .filter(Boolean),
    )
    .map((part) => {
      if (part === "." || part === "..") {
        throw new Error("Path traversal detected");
      }
      return part;
    });
  const normalized = path.normalize(
    [normalizedBase, ...sanitized].join(path.sep),
  );
  const basePrefix = normalizedBase.endsWith(path.sep)
    ? normalizedBase
    : `${normalizedBase}${path.sep}`;
  if (normalized !== normalizedBase && !normalized.startsWith(basePrefix)) {
    throw new Error("Path traversal detected");
  }
  return normalized;
}

async function getChunkRoot() {
  const root = await getUploadRoot();
  return path.join(root, ".chunks");
}

function chunkDir(root: string, userId: string, uploadId: string) {
  return safeJoin(root, userId, uploadId);
}

function chunkMetaPath(root: string, userId: string, uploadId: string) {
  return safeJoin(chunkDir(root, userId, uploadId), "meta.json");
}

function chunkPartPath(dir: string, index: number) {
  const name = `part-${String(index).padStart(6, "0")}`;
  return safeJoin(dir, name);
}

async function s3Config() {
  const config = await getStorageConfig();
  return {
    s3Bucket: config.s3.bucket,
    s3Region: config.s3.region,
    s3Endpoint: config.s3.endpoint,
    s3ForcePathStyle: config.s3.forcePathStyle,
    s3AccessKeyId: config.s3.accessKeyId,
    s3SecretAccessKey: config.s3.secretAccessKey,
  };
}

function isMetaExpired(meta: ChunkedUploadMeta) {
  const created = Date.parse(meta.createdAt);
  if (Number.isNaN(created)) return false;
  return Date.now() - created > CHUNK_TTL_MS;
}

function expiresAt(meta: ChunkedUploadMeta) {
  const created = Date.parse(meta.createdAt);
  if (Number.isNaN(created)) return null;
  return new Date(created + CHUNK_TTL_MS).toISOString();
}

function compressRanges(parts: number[]) {
  if (parts.length === 0) return [] as Array<[number, number]>;
  const sorted = Array.from(new Set(parts)).sort((a, b) => a - b);
  const ranges: Array<[number, number]> = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const n = sorted[i];
    if (n === end + 1) {
      end = n;
    } else {
      ranges.push([start, end]);
      start = n;
      end = n;
    }
  }
  ranges.push([start, end]);
  return ranges;
}

function isHexSha256(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

async function sha256Parts(partPaths: string[]) {
  const hash = createHash("sha256");
  for (const partPath of partPaths) {
    await new Promise<void>((resolve, reject) => {
      const rs = createReadStream(partPath);
      rs.on("error", reject);
      rs.on("data", (chunk) => hash.update(chunk));
      rs.on("end", resolve);
    });
  }
  return hash.digest("hex");
}

async function pickChunkSize(params: {
  size: number;
  requested: number;
  storageDriver: StorageDriver;
}) {
  const { requested, storageDriver } = params;
  const maxChunkSize = await getMaxChunkSizeBytes();
  let base = Number.isFinite(requested) && requested > 0 ? requested : 0;
  if (!base) {
    base = DEFAULT_CHUNK_SIZE;
  }
  base = Math.max(MIN_CHUNK_SIZE, Math.min(maxChunkSize, base));
  if (storageDriver === "s3") {
    base = Math.max(S3_MIN_PART_SIZE, base);
  }
  return base;
}

async function ensureChunkMeta(userId: string, uploadId: string) {
  const chunkRoot = await getChunkRoot();
  const metaRaw = await readFile(
    chunkMetaPath(chunkRoot, userId, uploadId),
    "utf-8",
  );
  return JSON.parse(metaRaw) as ChunkedUploadMeta;
}

async function readSignatureFromPart(partPath: string) {
  const fd = await open(partPath, "r");
  const buf = Buffer.alloc(4100);
  try {
    const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
    if (!bytesRead) return null;
    return fileTypeFromBuffer(buf.slice(0, bytesRead));
  } finally {
    await fd.close();
  }
}

async function combinePartsToLocal(outputPath: string, partPaths: string[]) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  const out = createWriteStream(outputPath, { flags: "w" });

  for (const partPath of partPaths) {
    await new Promise<void>((resolve, reject) => {
      const rs = createReadStream(partPath);
      rs.on("error", reject);
      rs.on("end", resolve);
      rs.pipe(out, { end: false });
    });
  }

  out.end();
  await finished(out);
}

async function ensureS3Client() {
  const {
    s3Bucket,
    s3Region,
    s3Endpoint,
    s3ForcePathStyle,
    s3AccessKeyId,
    s3SecretAccessKey,
  } = await s3Config();
  if (!s3Bucket) throw new Error("S3_BUCKET is required for chunked upload");

  const client = new S3Client({
    region: s3Region,
    endpoint: s3Endpoint,
    forcePathStyle: s3ForcePathStyle,
    credentials:
      s3AccessKeyId && s3SecretAccessKey
        ? { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey }
        : undefined,
  });

  return { client, bucket: s3Bucket };
}

async function uploadPartsToS3(params: {
  userId: string;
  storedName: string;
  partPaths: string[];
  contentType?: string;
}) {
  const { client, bucket } = await ensureS3Client();
  const key = buildObjectKey({
    userId: params.userId,
    storedName: params.storedName,
  });

  const create = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: params.contentType,
    }),
  );

  const uploadId = create.UploadId;
  if (!uploadId) throw new Error("Failed to create multipart upload");

  try {
    const parts: { ETag: string; PartNumber: number }[] = [];
    for (let i = 0; i < params.partPaths.length; i += 1) {
      const partPath = params.partPaths[i];
      const stats = await stat(partPath);
      if (i < params.partPaths.length - 1 && stats.size < S3_MIN_PART_SIZE) {
        throw new Error("Chunk too small for S3 multipart upload");
      }
      try {
        const res = await client.send(
          new UploadPartCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
            PartNumber: i + 1,
            Body: createReadStream(partPath),
            ContentLength: stats.size,
          }),
        );
        if (!res.ETag) throw new Error("Missing ETag for uploaded part");
        parts.push({ ETag: res.ETag, PartNumber: i + 1 });
      } catch (err) {
        console.error("S3 UploadPartCommand failed", {
          bucket,
          key,
          uploadId,
          partNumber: i + 1,
          partPath,
          error: err,
        });
        throw err;
      }
    }

    try {
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        }),
      );
    } catch (err) {
      console.error("S3 CompleteMultipartUploadCommand failed", {
        bucket,
        key,
        uploadId,
        error: err,
      });
      throw err;
    }
  } catch (err) {
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch (abortErr) {
      console.error("S3 AbortMultipartUploadCommand failed", {
        bucket,
        key,
        uploadId,
        error: abortErr,
      });
    }
    throw err;
  }
}

export async function initChunkedUpload(req: NextRequest) {
  try {
    let user = await getCurrentUser();
    if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
    if (!user)
      return { status: 401 as const, body: { message: "Unauthorized" } };

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return { status: 400 as const, body: { message: "Invalid JSON" } };
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const fileName =
      typeof body.fileName === "string" ? body.fileName.trim() : "";
    const size = typeof body.size === "number" ? body.size : NaN;
    const mimeType =
      typeof body.mimeType === "string"
        ? body.mimeType.trim()
        : "application/octet-stream";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;
    const isPublic =
      typeof body.isPublic === "boolean"
        ? body.isPublic
        : typeof body.isPublic === "string"
          ? body.isPublic.toLowerCase() === "true"
          : false;
    const desiredSlug = typeof body.slug === "string" ? body.slug.trim() : "";
    const nameConventionRaw =
      typeof body.nameConvention === "string" ? body.nameConvention.trim() : "";
    const slugConventionRaw =
      typeof body.slugConvention === "string" ? body.slugConvention.trim() : "";
    const incomingFolderId =
      typeof body.folderId === "string" && body.folderId.trim()
        ? body.folderId.trim()
        : null;
    const incomingFolderName =
      typeof body.folderName === "string" ? body.folderName.trim() : "";
    const tagIdsRaw =
      typeof body.tagIds === "string" && body.tagIds.trim()
        ? body.tagIds
        : null;
    const newTagsRaw = typeof body.newTags === "string" ? body.newTags : "";
    const passwordRaw =
      typeof body.password === "string" ? body.password.trim() : "";
    const maxViewsRaw = body.maxViews;
    const maxViewsActionRaw = body.maxViewsAction;
    const chunkSizeRaw =
      typeof body.chunkSize === "number" ? body.chunkSize : 0;
    const contentHashRaw =
      typeof body.contentHash === "string" ? body.contentHash.trim() : "";

    if (!Number.isFinite(size) || size <= 0) {
      return { status: 400 as const, body: { message: "Invalid size" } };
    }

    const settings = await getServerSettings();
    const baseFileName = fileName || name;
    const ext = (path.extname(baseFileName) || "").toLowerCase();
    const allowedPrefixes = Array.isArray(settings.allowedMimePrefixes)
      ? settings.allowedMimePrefixes.filter(Boolean)
      : [];
    const disallowedExts = Array.isArray(settings.disallowedExtensions)
      ? settings.disallowedExtensions.map((e: string) =>
          String(e).toLowerCase(),
        )
      : [];

    await enforceCreateLimit({
      userId: user.id,
      role: user.role as Role,
      kind: "files",
    });
    await enforceUploadPolicy({
      userId: user.id,
      role: user.role as Role,
      fileSizesMb: [size / (1024 * 1024)],
    });

    if (allowedPrefixes.length > 0) {
      const ok = allowedPrefixes.some((prefix: string) =>
        mimeType.startsWith(prefix),
      );
      if (!ok) {
        return {
          status: 400 as const,
          body: {
            message: `Uploads of this type are not allowed (${mimeType})`,
          },
        };
      }
    }

    if (disallowedExts.length > 0 && disallowedExts.includes(ext)) {
      return {
        status: 400 as const,
        body: { message: `Files with ${ext} extension are not allowed` },
      };
    }

    const userSettings = await getUserUploadSettings(user.id);
    const nameConvention =
      normalizeNameConvention(nameConventionRaw) ?? userSettings.nameConvention;
    const slugConvention =
      normalizeSlugConvention(slugConventionRaw) ?? userSettings.slugConvention;

    const originalName = await buildNameWithConvention({
      explicitName: name,
      fileName: baseFileName,
      convention: nameConvention,
    });

    const slug = await buildSlugWithConvention({
      desiredSlug,
      originalName,
      convention: slugConvention,
      user: { role: user.role, username: user.username },
    });
    if (contentHashRaw && !isHexSha256(contentHashRaw)) {
      return {
        status: 400 as const,
        body: { message: "Invalid contentHash (expected sha256 hex)" },
      };
    }

    const exists = await db
      .select({ id: filesTable.id })
      .from(filesTable)
      .where(eq(filesTable.slug, slug))
      .limit(1);
    if (exists.length > 0) {
      return {
        status: 409 as const,
        body: { message: "Slug already in use" },
      };
    }

    let parsedTagIds: string[] = [];
    if (tagIdsRaw && tagIdsRaw.trim()) {
      try {
        parsedTagIds = (JSON.parse(tagIdsRaw) as string[]).filter(
          (s) => typeof s === "string",
        );
      } catch {
        return { status: 400 as const, body: { message: "Invalid tagIds" } };
      }
    }

    const defaultDriver = await getDefaultStorageDriver();
    const chunkSize = await pickChunkSize({
      size,
      requested: chunkSizeRaw,
      storageDriver: defaultDriver,
    });
    const totalParts = Math.ceil(size / chunkSize);
    if (defaultDriver === "s3" && totalParts > 10_000) {
      return {
        status: 400 as const,
        body: { message: "Too many parts for S3 multipart upload" },
      };
    }

    const uploadId = nanoid();
    const storedName = `${nanoid()}${ext || ""}`;
    const passwordHash = passwordRaw ? await hashPassword(passwordRaw) : null;
    const maxViews = normalizeMaxViews(maxViewsRaw);
    const maxViewsAction = maxViews
      ? normalizeMaxViewsAction(maxViewsActionRaw)
      : null;

    const meta: ChunkedUploadMeta = {
      uploadId,
      userId: user.id,
      size,
      chunkSize,
      totalParts,
      originalName,
      mimeType,
      storedName,
      slug,
      description,
      isPublic,
      incomingFolderId,
      incomingFolderName,
      incomingTagIds: parsedTagIds,
      incomingNewTagNames: newTagsRaw
        ? newTagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      passwordHash,
      maxViews,
      maxViewsAction,
      contentHash: contentHashRaw || null,
      createdAt: new Date().toISOString(),
      storageDriver: defaultDriver,
    };

    const chunkRoot = await getChunkRoot();
    const dir = chunkDir(chunkRoot, user.id, uploadId);
    await mkdir(dir, { recursive: true });
    await writeFile(
      chunkMetaPath(chunkRoot, user.id, uploadId),
      JSON.stringify(meta),
    );

    return {
      status: 200 as const,
      body: {
        uploadId,
        chunkSize,
        totalParts,
        ttlSeconds: Math.ceil(CHUNK_TTL_MS / 1000),
        retry: RETRY_HINTS,
        expiresAt: expiresAt(meta),
        slug,
        storedName,
      },
    };
  } catch (err) {
    if (err instanceof LimitPolicyError) {
      return { status: 429 as const, body: { message: err.message } };
    }
    console.error("initChunkedUpload failed:", err);
    return { status: 500 as const, body: { message: "Upload init failed" } };
  }
}

export async function uploadChunkPart(req: NextRequest) {
  try {
    let user = await getCurrentUser();
    if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
    if (!user)
      return { status: 401 as const, body: { message: "Unauthorized" } };

    const uploadId = req.nextUrl.searchParams.get("uploadId") || "";
    const indexRaw = req.nextUrl.searchParams.get("part") || "";
    const index = Number(indexRaw);
    if (!uploadId || !Number.isInteger(index) || index < 0) {
      return { status: 400 as const, body: { message: "Invalid part index" } };
    }

    let meta: ChunkedUploadMeta;
    try {
      meta = await ensureChunkMeta(user.id, uploadId);
    } catch {
      return { status: 404 as const, body: { message: "Upload not found" } };
    }

    if (meta.userId !== user.id) {
      return { status: 403 as const, body: { message: "Forbidden" } };
    }
    if (isMetaExpired(meta)) {
      const chunkRoot = await getChunkRoot();
      await rm(chunkDir(chunkRoot, user.id, uploadId), {
        recursive: true,
        force: true,
      });
      return { status: 410 as const, body: { message: "Upload expired" } };
    }
    if (index >= meta.totalParts) {
      return { status: 400 as const, body: { message: "Part out of range" } };
    }

    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length === 0) {
      return { status: 400 as const, body: { message: "Empty chunk" } };
    }
    if (buffer.length > meta.chunkSize) {
      return { status: 400 as const, body: { message: "Chunk too large" } };
    }
    if (
      meta.storageDriver === "s3" &&
      index < meta.totalParts - 1 &&
      buffer.length < S3_MIN_PART_SIZE
    ) {
      return {
        status: 400 as const,
        body: { message: "Chunk too small for S3" },
      };
    }

    const chunkRoot = await getChunkRoot();
    const dir = chunkDir(chunkRoot, user.id, uploadId);
    await mkdir(dir, { recursive: true });
    const partPath = chunkPartPath(dir, index);
    await writeFile(partPath, buffer);

    return {
      status: 200 as const,
      body: { uploadId, part: index, received: buffer.length },
    };
  } catch (err) {
    console.error("uploadChunkPart failed:", err);
    return { status: 500 as const, body: { message: "Chunk upload failed" } };
  }
}

export async function completeChunkedUpload(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return { status: 401 as const, body: { message: "Unauthorized" } };

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return { status: 400 as const, body: { message: "Invalid JSON" } };
    }

    const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
    if (!uploadId) {
      return { status: 400 as const, body: { message: "Missing uploadId" } };
    }

    let meta: ChunkedUploadMeta;
    try {
      meta = await ensureChunkMeta(user.id, uploadId);
    } catch {
      return { status: 404 as const, body: { message: "Upload not found" } };
    }
    if (meta.userId !== user.id) {
      return { status: 403 as const, body: { message: "Forbidden" } };
    }
    if (isMetaExpired(meta)) {
      const chunkRoot = await getChunkRoot();
      await rm(chunkDir(chunkRoot, user.id, uploadId), {
        recursive: true,
        force: true,
      });
      return { status: 410 as const, body: { message: "Upload expired" } };
    }

    const chunkRoot = await getChunkRoot();
    const dir = chunkDir(chunkRoot, user.id, uploadId);
    const partPaths: string[] = [];
    let totalBytes = 0;

    for (let i = 0; i < meta.totalParts; i += 1) {
      const partPath = chunkPartPath(dir, i);
      try {
        const stats = await stat(partPath);
        if (meta.storageDriver === "s3" && i < meta.totalParts - 1) {
          if (stats.size < S3_MIN_PART_SIZE) {
            return {
              status: 400 as const,
              body: { message: `Chunk ${i} too small for S3` },
            };
          }
        }
        totalBytes += stats.size;
        partPaths.push(partPath);
      } catch {
        return {
          status: 400 as const,
          body: { message: `Missing chunk ${i}` },
        };
      }
    }

    if (totalBytes !== meta.size) {
      return {
        status: 400 as const,
        body: { message: "Chunk sizes do not match expected total" },
      };
    }

    const sig = await readSignatureFromPart(partPaths[0]);
    const effectiveMime =
      sig?.mime || meta.mimeType || "application/octet-stream";

    const settings = await getServerSettings();
    const allowedPrefixes = Array.isArray(settings.allowedMimePrefixes)
      ? settings.allowedMimePrefixes.filter(Boolean)
      : [];
    if (allowedPrefixes.length > 0) {
      const ok = allowedPrefixes.some((prefix: string) =>
        effectiveMime.startsWith(prefix),
      );
      if (!ok) {
        return {
          status: 400 as const,
          body: {
            message: `Uploads of this type are not allowed (${effectiveMime})`,
          },
        };
      }
    }

    const folderId = await resolveFolderId({
      userId: user.id,
      incomingFolderId: meta.incomingFolderId,
      incomingFolderName: meta.incomingFolderName,
    });

    let calculatedHash: string | null = null;
    if (meta.contentHash) {
      calculatedHash = await sha256Parts(partPaths);
      if (calculatedHash !== meta.contentHash) {
        return {
          status: 400 as const,
          body: { message: "Content hash mismatch" },
        };
      }
    }

    if (meta.storageDriver === "s3") {
      await uploadPartsToS3({
        userId: user.id,
        storedName: meta.storedName,
        partPaths,
        contentType: effectiveMime,
      });
    } else {
      const uploadRoot = await getUploadRoot();
      const userRoot = safeJoin(uploadRoot, user.id);
      const finalPath = safeJoin(userRoot, meta.storedName);
      await combinePartsToLocal(finalPath, partPaths);
    }

    const [row] = await db
      .insert(filesTable)
      .values({
        userId: user.id,
        folderId: folderId ?? null,
        originalName: meta.originalName,
        storedName: meta.storedName,
        storageDriver: meta.storageDriver,
        mimeType: effectiveMime,
        size: meta.size,
        slug: meta.slug,
        description: meta.description,
        isPublic: meta.isPublic,
        password: meta.passwordHash,
        contentHash: calculatedHash ?? meta.contentHash ?? null,
        views: 0,
        maxViews: meta.maxViews ?? null,
        maxViewsAction:
          meta.maxViewsAction === "make_private" ||
          meta.maxViewsAction === "delete"
            ? meta.maxViewsAction
            : null,
        maxViewsTriggeredAt: null,
      })
      .returning();

    const userSettings = await getUserUploadSettings(user.id);
    if (
      userSettings.imageCompressionEnabled &&
      effectiveMime.startsWith("image/")
    ) {
      await enqueueMediaJob({
        userId: user.id,
        fileId: row.id,
        kind: "image",
        quality: userSettings.imageCompressionQuality,
      });
    } else if (
      userSettings.mediaTranscodeEnabled &&
      (effectiveMime.startsWith("video/") || effectiveMime.startsWith("audio/"))
    ) {
      await enqueueMediaJob({
        userId: user.id,
        fileId: row.id,
        kind: effectiveMime.startsWith("video/") ? "video" : "audio",
        quality: userSettings.mediaTranscodeQuality,
      });
    }

    if (
      effectiveMime.startsWith("video/") ||
      (effectiveMime.startsWith("image/") && effectiveMime !== "image/svg+xml")
    ) {
      const previewJobId = await enqueuePreviewJob({
        userId: user.id,
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
      const streamQuality = userSettings.mediaTranscodeEnabled
        ? userSettings.mediaTranscodeQuality
        : 100;
      const streamJobId = await enqueueStreamJob({
        userId: user.id,
        fileId: row.id,
        quality: streamQuality,
      });
      setImmediate(() => {
        void kickStreamRunner({ jobId: streamJobId }).catch(() => {});
      });
    }

    const responseTags = await resolveTagsForFile({
      userId: user.id,
      fileId: row.id,
      incomingTagIds: meta.incomingTagIds,
      incomingNewTagNames: meta.incomingNewTagNames,
    });

    await rm(dir, { recursive: true, force: true });

    return {
      status: 201 as const,
      body: {
        id: row.id,
        originalName: row.originalName,
        storedName: row.storedName,
        mimeType: row.mimeType,
        size: row.size,
        slug: row.slug,
        description: row.description,
        isPublic: row.isPublic,
        maxViews: row.maxViews,
        maxViewsAction: row.maxViewsAction,
        createdAt: row.createdAt,
        folder: meta.incomingFolderName || null,
        tags: responseTags,
        url: `${req.nextUrl.origin}/x/${row.slug}`,
      },
    };
  } catch (err) {
    console.error("completeChunkedUpload failed:", err);
    return {
      status: 500 as const,
      body: { message: "Upload complete failed" },
    };
  }
}

export async function abortChunkedUpload(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return { status: 401 as const, body: { message: "Unauthorized" } };

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return { status: 400 as const, body: { message: "Invalid JSON" } };
    }

    const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
    if (!uploadId) {
      return { status: 400 as const, body: { message: "Missing uploadId" } };
    }

    const chunkRoot = await getChunkRoot();
    const dir = chunkDir(chunkRoot, user.id, uploadId);
    await rm(dir, { recursive: true, force: true });
    return { status: 200 as const, body: { message: "Aborted" } };
  } catch (err) {
    console.error("abortChunkedUpload failed:", err);
    return { status: 500 as const, body: { message: "Abort failed" } };
  }
}

export async function getChunkedUploadStatus(req: NextRequest) {
  try {
    let user = await getCurrentUser();
    if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
    if (!user)
      return { status: 401 as const, body: { message: "Unauthorized" } };

    const uploadId = req.nextUrl.searchParams.get("uploadId") || "";
    if (!uploadId) {
      return { status: 400 as const, body: { message: "Missing uploadId" } };
    }

    let meta: ChunkedUploadMeta;
    try {
      meta = await ensureChunkMeta(user.id, uploadId);
    } catch {
      return { status: 404 as const, body: { message: "Upload not found" } };
    }

    if (meta.userId !== user.id) {
      return { status: 403 as const, body: { message: "Forbidden" } };
    }
    if (isMetaExpired(meta)) {
      const chunkRoot = await getChunkRoot();
      await rm(chunkDir(chunkRoot, user.id, uploadId), {
        recursive: true,
        force: true,
      });
      return { status: 410 as const, body: { message: "Upload expired" } };
    }

    const chunkRoot = await getChunkRoot();
    const dir = chunkDir(chunkRoot, user.id, uploadId);
    const entries = await readdir(dir).catch(() => [] as string[]);
    const parts = entries
      .map((name) => name.match(/^part-(\d+)$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => Number(m[1]))
      .filter((n) => Number.isInteger(n));

    const ranges = compressRanges(parts);
    const receivedCount = parts.length;
    const missingCount = Math.max(0, meta.totalParts - receivedCount);

    return {
      status: 200 as const,
      body: {
        uploadId,
        chunkSize: meta.chunkSize,
        totalParts: meta.totalParts,
        receivedCount,
        missingCount,
        receivedRanges: ranges,
        ttlSeconds: Math.ceil(CHUNK_TTL_MS / 1000),
        expiresAt: expiresAt(meta),
      },
    };
  } catch (err) {
    console.error("getChunkedUploadStatus failed:", err);
    return { status: 500 as const, body: { message: "Status check failed" } };
  }
}
