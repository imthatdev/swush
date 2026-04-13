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

import { randomUUID } from "crypto";
import Redis from "ioredis";
import type { RedisOptions } from "ioredis";

export type RedisLock = {
  key: string;
  token: string;
};

export type RedisLockAttempt = {
  lock: RedisLock | null;
  available: boolean;
};

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

const WARN_INTERVAL_MS = 30_000;
const REDIS_BASE_OPTIONS: RedisOptions = {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
};

let redisClient: Redis | null = null;
let redisClientKey = "";
let lastWarnAt = 0;

function warnRedis(action: string, error: unknown) {
  const now = Date.now();
  if (now - lastWarnAt < WARN_INTERVAL_MS) return;
  lastWarnAt = now;

  console.warn(`redis:${action} failed`, {
    message: (error as Error)?.message || String(error),
  });
}

function prefixedKey(key: string) {
  const prefix = (process.env.REDIS_PREFIX || "swush").trim() || "swush";
  const normalizedKey = key.replace(/^:+/, "");
  return `${prefix}:${normalizedKey}`;
}

export function isRedisEnabled() {
  return Boolean(
    process.env.REDIS_URL?.trim() || process.env.REDIS_HOST?.trim(),
  );
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseNonNegativeInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function parseBoolean(value: string | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function resolveRedisConnectionConfig():
  | { mode: "url"; key: string; redisUrl: string }
  | { mode: "host"; key: string; options: RedisOptions }
  | null {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    return {
      mode: "url",
      key: `url:${redisUrl}`,
      redisUrl,
    };
  }

  const host = process.env.REDIS_HOST?.trim();
  if (!host) return null;

  const port = parsePositiveInt(process.env.REDIS_PORT, 6379);
  const db = parseNonNegativeInt(process.env.REDIS_DB, 0);
  const username = process.env.REDIS_USERNAME?.trim() || undefined;
  const password = process.env.REDIS_PASSWORD?.trim() || undefined;
  const tlsEnabled = parseBoolean(process.env.REDIS_TLS);

  return {
    mode: "host",
    key: JSON.stringify({
      host,
      port,
      db,
      username: username || null,
      hasPassword: Boolean(password),
      tlsEnabled,
    }),
    options: {
      ...REDIS_BASE_OPTIONS,
      host,
      port,
      db,
      username,
      password,
      tls: tlsEnabled ? {} : undefined,
    },
  };
}

async function getRedisClient(): Promise<Redis | null> {
  const config = resolveRedisConnectionConfig();
  if (!config) return null;

  if (redisClient?.status === "end") {
    redisClient = null;
    redisClientKey = "";
  }

  if (redisClient && redisClientKey !== config.key) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    }
    redisClient = null;
    redisClientKey = "";
  }

  if (!redisClient) {
    redisClient =
      config.mode === "url"
        ? new Redis(config.redisUrl, REDIS_BASE_OPTIONS)
        : new Redis(config.options);
    redisClientKey = config.key;

    redisClient.on("error", (error) => {
      warnRedis("connection", error);
    });
  }

  if (redisClient.status === "wait") {
    try {
      await redisClient.connect();
    } catch (error) {
      warnRedis("connect", error);
      return null;
    }
  }

  return redisClient;
}

export async function redisGetJson<T>(key: string): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const raw = await client.get(prefixedKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    warnRedis("get", error);
    return null;
  }
}

export async function redisSetJson(key: string, value: unknown, ttlMs: number) {
  const client = await getRedisClient();
  if (!client) return;

  const ttl = Math.max(1, Math.floor(ttlMs));

  try {
    await client.set(prefixedKey(key), JSON.stringify(value), "PX", ttl);
  } catch (error) {
    warnRedis("set", error);
  }
}

export async function redisDelete(key: string) {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(prefixedKey(key));
  } catch (error) {
    warnRedis("delete", error);
  }
}

export async function tryAcquireRedisLock(
  key: string,
  ttlMs = 30_000,
): Promise<RedisLockAttempt> {
  const client = await getRedisClient();
  if (!client) return { lock: null, available: false };

  const ttl = Math.max(1, Math.floor(ttlMs));
  const token = randomUUID();

  try {
    const result = await client.set(
      prefixedKey(`lock:${key}`),
      token,
      "PX",
      ttl,
      "NX",
    );

    if (result !== "OK") {
      return { lock: null, available: true };
    }

    return {
      lock: { key, token },
      available: true,
    };
  } catch (error) {
    warnRedis("acquire-lock", error);
    return { lock: null, available: false };
  }
}

export async function releaseRedisLock(lock: RedisLock | null) {
  if (!lock) return;

  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.eval(
      RELEASE_LOCK_SCRIPT,
      1,
      prefixedKey(`lock:${lock.key}`),
      lock.token,
    );
  } catch (error) {
    warnRedis("release-lock", error);
  }
}
