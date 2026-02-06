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

import type { StorageDriver } from "@/lib/storage";

export type StorageConfig = {
  driver: StorageDriver;
  uploadRoot: string;
  s3: {
    bucket?: string;
    region: string;
    endpoint?: string;
    forcePathStyle: boolean;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
};

let cachedConfig: StorageConfig | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

function envDriver(): StorageDriver {
  return (process.env.STORAGE_DRIVER || "local").toLowerCase() === "s3"
    ? "s3"
    : "local";
}

function envUploadRoot() {
  return process.env.UPLOAD_ROOT || "uploads";
}

export function storageDefaultsFromEnv() {
  return {
    storageDriver: envDriver(),
    uploadRoot: envUploadRoot(),
    s3Bucket: process.env.S3_BUCKET?.trim() || "",
    s3Region: process.env.S3_REGION?.trim() || "auto",
    s3Endpoint: process.env.S3_ENDPOINT?.trim() || "",
    s3ForcePathStyle:
      (process.env.S3_FORCE_PATH_STYLE || "true").toLowerCase() === "true",
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID?.trim() || "",
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY?.trim() || "",
  };
}

export function clearStorageConfigCache() {
  cachedConfig = null;
  cachedAt = 0;
}

export async function getStorageConfig(): Promise<StorageConfig> {
  const now = Date.now();
  if (cachedConfig && now - cachedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const envDefaults = storageDefaultsFromEnv();

  const driver = envDefaults.storageDriver;
  const accessKeyId = envDefaults.s3AccessKeyId || undefined;
  const secretAccessKey = envDefaults.s3SecretAccessKey || undefined;
  const uploadRoot = envDefaults.uploadRoot || "uploads";

  cachedConfig = {
    driver,
    uploadRoot,
    s3: {
      bucket: envDefaults.s3Bucket || undefined,
      region: envDefaults.s3Region || "auto",
      endpoint: envDefaults.s3Endpoint || undefined,
      forcePathStyle: envDefaults.s3ForcePathStyle,
      accessKeyId,
      secretAccessKey,
    },
  };
  cachedAt = now;

  return cachedConfig;
}
