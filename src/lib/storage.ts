/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

import path from "path";
import { createReadStream, createWriteStream } from "fs";
import { mkdir, rm, stat as statAsync, unlink, writeFile } from "fs/promises";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  GetObjectCommandInput,
  GetObjectCommandOutput,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type S3ClientResolvedConfig,
  type ServiceInputTypes,
  type ServiceOutputTypes,
} from "@aws-sdk/client-s3";
import type { Command } from "@smithy/types";
import { getStorageConfig } from "@/lib/server/storage-config";

export type StorageDriver = "local" | "s3";

export type StorageTarget = { userId: string; storedName: string };
export type StorageRange = { start: number; end: number };
export type StorageMeta = {
  size: number;
  etag: string;
  lastModified: Date;
  contentType?: string;
};
export type StorageReadResult = {
  stream: Readable;
  meta: StorageMeta;
  contentRange?: string;
  contentLength?: number;
  isPartial: boolean;
};

export async function getDefaultStorageDriver(): Promise<StorageDriver> {
  return (await getStorageConfig()).driver;
}

export async function getUploadRoot(): Promise<string> {
  const config = await getStorageConfig();
  return path.isAbsolute(config.uploadRoot)
    ? config.uploadRoot
    : path.join(process.cwd(), config.uploadRoot);
}

let s3Client: S3Client | null = null;
let s3ClientKey = "";

async function ensureS3Client() {
  const config = await getStorageConfig();
  const bucket = config.s3.bucket;
  if (!bucket) {
    throw new Error("S3_BUCKET is required when storage driver is s3");
  }
  const key = JSON.stringify({
    bucket,
    region: config.s3.region,
    endpoint: config.s3.endpoint ?? null,
    forcePathStyle: config.s3.forcePathStyle,
    accessKeyId: config.s3.accessKeyId ?? null,
    secretAccessKey: config.s3.secretAccessKey ?? null,
  });
  if (!s3Client || s3ClientKey !== key) {
    s3Client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: config.s3.forcePathStyle,
      credentials:
        config.s3.accessKeyId && config.s3.secretAccessKey
          ? {
              accessKeyId: config.s3.accessKeyId,
              secretAccessKey: config.s3.secretAccessKey,
            }
          : undefined,
    });
    s3ClientKey = key;
  }
  return s3Client;
}

export function buildObjectKey({ userId, storedName }: StorageTarget) {
  const cleanedName = storedName.replace(/^[\\/]+/, "");
  return `${userId}/${cleanedName}`;
}

function safeJoin(base: string, target: string) {
  const targetPath = path.join(base, target);
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error("Path traversal detected");
  }
  return resolved;
}

function buildLocalPath(root: string, target: StorageTarget) {
  const key = buildObjectKey(target);
  return safeJoin(root, key);
}

function makeLocalEtag(size: number, mtimeMs: number) {
  return `W/"${size}-${Math.trunc(mtimeMs)}"`;
}

type S3ErrorLike = {
  $metadata?: { httpStatusCode?: number };
  Code?: string;
  code?: string;
  name?: string;
  message?: string;
};

function parseS3Error(err: unknown) {
  if (typeof err === "object" && err !== null) {
    const e = err as S3ErrorLike;
    return {
      status: e.$metadata?.httpStatusCode,
      code: e.Code || e.code || e.name,
      message: e.message,
    };
  }
  return { status: undefined, code: undefined, message: undefined };
}

async function s3GetWithRetries(
  client: S3Client,
  cmd: GetObjectCommand,
  attempts = 5,
): Promise<GetObjectCommandOutput> {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await client.send(cmd);
      return res as GetObjectCommandOutput;
    } catch (err) {
      lastErr = err;
      const { status, code, message } = parseS3Error(err);
      const msg = String(message || "").toLowerCase();

      const isChecksumError =
        msg.includes("checksum") ||
        msg.includes("crc32") ||
        String(err).includes("Checksum mismatch");
      const isTransient =
        isChecksumError ||
        (typeof status === "number" && status >= 500) ||
        code === "UnknownError";

      if (!isTransient || i === attempts - 1) break;

      console.warn("s3GetWithRetries: transient S3 get error, retrying", {
        attempt: i + 1,
        code,
        status,
        message,
      });

      if (isChecksumError) {
        try {
          const input: GetObjectCommandInput | undefined = (
            cmd as unknown as { input?: GetObjectCommandInput }
          ).input;
          const bucket = input?.Bucket;
          const key = input?.Key;
          if (bucket && key) {
            try {
              const headRes = (await client.send(
                new HeadObjectCommand({ Bucket: bucket, Key: key }),
              )) as HeadObjectCommandOutput;
              console.warn("s3GetWithRetries: head-object info", {
                bucket,
                key,
                checksum:
                  headRes.ChecksumCRC32 ??
                  headRes.ChecksumCRC32C ??
                  headRes.ChecksumSHA256 ??
                  headRes.Metadata?.["x-amz-checksum-crc32"],
                contentLength: headRes.ContentLength,
              });
            } catch (headErr) {
              console.warn("s3GetWithRetries: head-object failed", {
                bucket,
                key,
                error: headErr,
              });
            }

            try {
              const sampleRes = (await client.send(
                new GetObjectCommand({
                  Bucket: bucket,
                  Key: key,
                  Range: "bytes=0-511",
                }),
              )) as GetObjectCommandOutput;
              const sstream = sampleRes.Body as Readable | undefined;
              if (sstream) {
                const chunks: Buffer[] = [];
                for await (const c of sstream) {
                  chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
                }
                const sampleBuf = Buffer.concat(chunks);
                console.warn("s3GetWithRetries: payload sample", {
                  bucket,
                  key,
                  sampleLength: sampleBuf.length,
                  sampleHex: sampleBuf.slice(0, 64).toString("hex"),
                  sampleBase64: sampleBuf.toString("base64"),
                });
              }
            } catch (sampleErr) {
              console.warn("s3GetWithRetries: sample get failed", {
                bucket,
                key,
                error: sampleErr,
              });
            }
          }
        } catch (diagErr) {
          console.warn("s3GetWithRetries: diagnostics failed", {
            error: diagErr,
          });
        }
      }

      await wait(200 * (i + 1));
    }
  }

  throw lastErr;
}

async function s3DeleteWithRetries<
  Input extends ServiceInputTypes,
  Output extends ServiceOutputTypes,
>(
  client: S3Client,
  cmd: Command<
    ServiceInputTypes,
    Input,
    ServiceOutputTypes,
    Output,
    S3ClientResolvedConfig
  >,
  attempts = 5,
) {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  let lastErr: unknown = null;

  for (let i = 0; i < attempts; i++) {
    try {
      await client.send(cmd);
      return;
    } catch (err) {
      lastErr = err;
      const { status, code, message } = parseS3Error(err);
      const msg = String(message || "").toLowerCase();
      const isTransient =
        code === "RequestTimeout" ||
        msg.includes("timeout") ||
        (typeof status === "number" && status >= 500);

      if (!isTransient || i === attempts - 1) break;

      console.warn("s3DeleteWithRetries: transient S3 delete error, retrying", {
        attempt: i + 1,
        code,
        status,
        message,
      });

      await wait(250 * (i + 1));
    }
  }

  throw lastErr;
}

export async function putFileToStorage(params: {
  target: StorageTarget;
  buffer: Buffer;
  contentType?: string;
  cacheControl?: string;
  driver?: StorageDriver;
}) {
  const config = await getStorageConfig();
  const driver = params.driver ?? config.driver;

  if (driver === "s3") {
    const client = await ensureS3Client();
    const key = buildObjectKey(params.target);
    await client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket!,
        Key: key,
        Body: params.buffer,
        ContentType: params.contentType,
        CacheControl: params.cacheControl,
      }),
    );
    return;
  }

  const root = path.isAbsolute(config.uploadRoot)
    ? config.uploadRoot
    : path.join(process.cwd(), config.uploadRoot);
  const filePath = buildLocalPath(root, params.target);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, params.buffer);
}

export async function putStreamToStorage(params: {
  target: StorageTarget;
  stream: Readable;
  contentType?: string;
  cacheControl?: string;
  contentLength?: number;
  driver?: StorageDriver;
}) {
  const config = await getStorageConfig();
  const driver = params.driver ?? config.driver;

  if (driver === "s3") {
    const client = await ensureS3Client();
    const key = buildObjectKey(params.target);
    await client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket!,
        Key: key,
        Body: params.stream,
        ContentType: params.contentType,
        CacheControl: params.cacheControl,
        ContentLength:
          typeof params.contentLength === "number"
            ? params.contentLength
            : undefined,
      }),
    );
    return;
  }

  const root = path.isAbsolute(config.uploadRoot)
    ? config.uploadRoot
    : path.join(process.cwd(), config.uploadRoot);
  const filePath = buildLocalPath(root, params.target);
  await mkdir(path.dirname(filePath), { recursive: true });
  await pipeline(params.stream, createWriteStream(filePath));
}

export async function deleteFileFromStorage(
  target: StorageTarget,
  opts?: { driver?: StorageDriver },
) {
  const config = await getStorageConfig();
  const driver = opts?.driver ?? config.driver;

  if (driver === "s3") {
    const client = await ensureS3Client();
    await s3DeleteWithRetries(
      client,
      new DeleteObjectCommand({
        Bucket: config.s3.bucket!,
        Key: buildObjectKey(target),
      }),
    );
    return;
  }

  const root = path.isAbsolute(config.uploadRoot)
    ? config.uploadRoot
    : path.join(process.cwd(), config.uploadRoot);
  const filePath = buildLocalPath(root, target);
  await unlink(filePath).catch(() => {});
}

export async function deletePrefixFromStorage(
  target: StorageTarget,
  opts?: { driver?: StorageDriver },
) {
  const config = await getStorageConfig();
  const driver = opts?.driver ?? config.driver;
  const keyPrefix = buildObjectKey(target).replace(/\/?$/, "/");

  if (driver === "s3") {
    const client = await ensureS3Client();
    let continuationToken: string | undefined;

    do {
      const list = await client.send(
        new ListObjectsV2Command({
          Bucket: config.s3.bucket!,
          Prefix: keyPrefix,
          ContinuationToken: continuationToken,
        }),
      );
      const contents = list.Contents ?? [];
      if (contents.length > 0) {
        const objects = contents
          .map((obj) => obj.Key)
          .filter(Boolean)
          .map((Key) => ({ Key: Key! }));
        if (objects.length > 0) {
          await s3DeleteWithRetries(
            client,
            new DeleteObjectsCommand({
              Bucket: config.s3.bucket!,
              Delete: { Objects: objects },
            }),
          );
        }
      }
      continuationToken = list.IsTruncated
        ? list.NextContinuationToken
        : undefined;
    } while (continuationToken);

    return;
  }

  const root = path.isAbsolute(config.uploadRoot)
    ? config.uploadRoot
    : path.join(process.cwd(), config.uploadRoot);
  const dirPath = buildLocalPath(root, target);
  await rm(dirPath, { recursive: true, force: true });
}

export async function statFromStorage(
  target: StorageTarget,
  opts?: { driver?: StorageDriver },
): Promise<StorageMeta | null> {
  const config = await getStorageConfig();
  const driver = opts?.driver ?? config.driver;

  if (driver === "s3") {
    const client = await ensureS3Client();
    try {
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: config.s3.bucket!,
          Key: buildObjectKey(target),
        }),
      );

      const lastModified = head.LastModified ?? new Date();
      const etag = head.ETag ?? "";
      const size = head.ContentLength ?? 0;

      return {
        size,
        etag,
        lastModified,
        contentType: head.ContentType ?? undefined,
      };
    } catch (err) {
      const { status, code, message: msg } = parseS3Error(err);

      if (
        status === 404 ||
        status === 400 ||
        status === 403 ||
        code === "NotFound" ||
        code === "NoSuchKey" ||
        code === "NotFoundError"
      ) {
        return null;
      }

      if (code === "UnknownError") {
        console.warn("statFromStorage: transient S3 head error", {
          code,
          status,
          message: msg,
        });
        return null;
      }

      throw err;
    }
  }

  try {
    const root = path.isAbsolute(config.uploadRoot)
      ? config.uploadRoot
      : path.join(process.cwd(), config.uploadRoot);
    const stats = await statAsync(buildLocalPath(root, target));
    return {
      size: stats.size,
      etag: makeLocalEtag(stats.size, stats.mtimeMs),
      lastModified: stats.mtime,
    };
  } catch {
    return null;
  }
}

export async function readFromStorage(
  target: StorageTarget,
  opts?: {
    range?: StorageRange;
    knownMeta?: StorageMeta;
    driver?: StorageDriver;
  },
): Promise<StorageReadResult | null> {
  const config = await getStorageConfig();
  const driver = opts?.driver ?? config.driver;
  const meta = opts?.knownMeta ?? (await statFromStorage(target, { driver }));

  if (driver === "s3") {
    const client = await ensureS3Client();
    const key = buildObjectKey(target);
    const rangeHeader = opts?.range
      ? `bytes=${opts.range.start}-${opts.range.end}`
      : undefined;

    if (!meta) {
      try {
        const res = await s3GetWithRetries(
          client,
          new GetObjectCommand({
            Bucket: config.s3.bucket!,
            Key: key,
            Range: rangeHeader,
          }),
        );

        const stream = res.Body as Readable | undefined;
        if (!stream) return null;

        const totalSize = (() => {
          if (typeof res.ContentRange === "string") {
            const parts = res.ContentRange.split("/");
            const total = Number(parts[1]);
            if (!Number.isNaN(total)) return total;
          }
          if (typeof res.ContentLength === "number") {
            return res.ContentLength;
          }
          return 0;
        })();

        return {
          stream,
          meta: {
            size: totalSize,
            etag: res.ETag ?? `W/"${totalSize}-0"`,
            lastModified: res.LastModified ?? new Date(0),
            contentType: res.ContentType ?? undefined,
          },
          contentRange: res.ContentRange ?? undefined,
          contentLength: res.ContentLength ?? undefined,
          isPartial: Boolean(opts?.range),
        };
      } catch (err) {
        const { status, code, message: msg } = parseS3Error(err);

        if (
          status === 404 ||
          status === 400 ||
          status === 403 ||
          code === "NotFound" ||
          code === "NoSuchKey" ||
          code === "NotFoundError"
        ) {
          return null;
        }

        if (code === "UnknownError") {
          console.warn("readFromStorage: transient S3 get error", {
            code,
            status,
            message: msg,
          });
          return null;
        }

        throw err;
      }
    }

    let res;

    try {
      res = await s3GetWithRetries(
        client,
        new GetObjectCommand({
          Bucket: config.s3.bucket!,
          Key: key,
          Range: rangeHeader,
        }),
      );
    } catch (err) {
      console.error(
        "S3 GetObjectCommand failed in readFromStorage (meta present)",
        {
          bucket: config.s3.bucket,
          key,
          rangeHeader,
          error: err,
          opts,
          meta,
        },
      );
      throw err;
    }

    const stream = res.Body as Readable | undefined;
    if (!stream) return null;

    const totalSize = (() => {
      if (typeof res.ContentRange === "string") {
        const parts = res.ContentRange.split("/");
        const total = Number(parts[1]);
        if (!Number.isNaN(total)) return total;
      }
      return meta.size;
    })();

    const contentLength =
      res.ContentLength ??
      (opts?.range ? opts.range.end - opts.range.start + 1 : meta.size);

    return {
      stream,
      meta: {
        size: totalSize,
        etag: res.ETag ?? meta.etag,
        lastModified: res.LastModified ?? meta.lastModified,
        contentType: res.ContentType ?? meta.contentType,
      },
      contentRange: res.ContentRange ?? undefined,
      contentLength,
      isPartial: Boolean(opts?.range),
    };
  }

  if (!meta) return null;

  const root = path.isAbsolute(config.uploadRoot)
    ? config.uploadRoot
    : path.join(process.cwd(), config.uploadRoot);
  const filePath = buildLocalPath(root, target);
  const stream = createReadStream(
    filePath,
    opts?.range ? { start: opts.range.start, end: opts.range.end } : undefined,
  );

  return {
    stream,
    meta,
    contentRange: opts?.range
      ? `bytes ${opts.range.start}-${opts.range.end}/${meta.size}`
      : undefined,
    contentLength: opts?.range
      ? opts.range.end - opts.range.start + 1
      : meta.size,
    isPartial: Boolean(opts?.range),
  };
}
