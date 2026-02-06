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

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { files } from "@/db/schemas/core-schema";
import { eq, or, sql } from "drizzle-orm";
import { verifyPasswordHash } from "@/lib/api/password";
import { getCurrentUser } from "@/lib/client/user";
import {
  readFromStorage,
  type StorageDriver,
  getDefaultStorageDriver,
} from "@/lib/storage";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";
import { isMedia } from "@/lib/mime-types";
import { streamAssetStoredName } from "@/lib/server/stream-paths";

export const runtime = "nodejs";

type NodeStream = NodeJS.ReadableStream & {
  destroy?: (error?: Error) => void;
  off?: (
    event: string | symbol,
    listener: (...args: unknown[]) => void,
  ) => void;
};

function toSafeWebStream(nodeStream: NodeStream, signal?: AbortSignal) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let done = false;

      const onData = (chunk: string | Buffer) => {
        if (done) return;
        try {
          if (typeof chunk === "string") {
            controller.enqueue(new TextEncoder().encode(chunk));
          } else {
            controller.enqueue(new Uint8Array(chunk));
          }
        } catch {
          done = true;
          try {
            nodeStream.destroy?.();
          } catch {}
        }
      };
      const onEnd = () => {
        if (done) return;
        done = true;
        try {
          controller.close();
        } catch {}
      };
      const onError = (err: unknown) => {
        if (done) return;
        done = true;
        try {
          controller.error(err);
        } catch {}
      };
      const onClose = () => {
        if (done) return;
        done = true;
        try {
          controller.close();
        } catch {}
      };

      nodeStream.on("data", onData);
      nodeStream.once("end", onEnd);
      nodeStream.once("error", onError);
      nodeStream.once("close", onClose);

      const onAbort = () => {
        if (done) return;
        done = true;
        try {
          nodeStream.destroy?.();
        } catch {}
        try {
          controller.close();
        } catch {}
      };
      signal?.addEventListener("abort", onAbort);

      return () => {
        signal?.removeEventListener("abort", onAbort);
        nodeStream.off?.("data", onData);
        nodeStream.off?.("end", onEnd);
        nodeStream.off?.("error", onError);
        nodeStream.off?.("close", onClose);
        try {
          nodeStream.destroy?.();
        } catch {}
      };
    },
  });
}

function getHlsContentType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.endsWith(".ts")) return "video/mp2t";
  if (lower.endsWith(".m4s")) return "video/iso.segment";
  if (lower.endsWith(".aac")) return "audio/aac";
  return "application/octet-stream";
}

function buildHeaders(params: {
  contentType: string;
  etag: string;
  lastModified: string;
  size?: number;
  isPublic: boolean;
  hasPassword: boolean;
  cachePolicy?: string;
  includeLength?: boolean;
}) {
  const headers: Record<string, string> = {
    "Content-Type": params.contentType,
    ETag: params.etag,
    "Last-Modified": params.lastModified,
    "X-Content-Type-Options": "nosniff",
  };

  if (params.includeLength && typeof params.size === "number") {
    headers["Content-Length"] = String(params.size);
  }

  if (params.cachePolicy) {
    headers["Cache-Control"] = params.cachePolicy;
  } else if (params.isPublic && !params.hasPassword) {
    headers["Cache-Control"] =
      "public, max-age=31536000, immutable, s-maxage=31536000";
  } else {
    headers["Cache-Control"] = "private, no-store";
  }

  return headers;
}

async function fetchFileRow(slug: string) {
  const rows = await db
    .select()
    .from(files)
    .where(
      or(
        eq(files.slug, slug),
        eq(sql`split_part(${files.storedName}, '.', 1)`, slug),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

function appendQueryToPlaylist(content: string, query: string) {
  const lines = content.split(/\r?\n/);
  const suffix = query.startsWith("?") ? query : `?${query}`;
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      if (trimmed.includes("?")) return `${line}&${suffix.slice(1)}`;
      return `${line}${suffix}`;
    })
    .join("\n");
}

async function readStreamText(stream: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

type Params = Promise<{ slug: string; asset: string[] }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const user = await getCurrentUser();
  const { appUrl } = await getPublicRuntimeSettings();

  const resolved = await params;
  const slug = resolved?.slug as string;
  const assetParts = Array.isArray(resolved?.asset)
    ? resolved.asset.filter((part) => part.length > 0)
    : [];

  if (!slug) {
    return NextResponse.json({ message: "Missing asset" }, { status: 400 });
  }
  if (assetParts.length === 0) {
    assetParts.push("index.m3u8");
  }

  if (assetParts.some((part) => part.includes(".."))) {
    return NextResponse.json({ message: "Invalid asset" }, { status: 400 });
  }

  const assetPath = assetParts.join("/");
  const f = await fetchFileRow(slug);
  if (!f) return NextResponse.json({ message: "Not found" }, { status: 404 });

  if (!isMedia("video", f.mimeType) && !isMedia("audio", f.mimeType)) {
    return NextResponse.json(
      { message: "Stream not supported" },
      { status: 404 },
    );
  }

  const url = new URL(req.url);
  const suppliedPassword = url.searchParams.get("p") || undefined;

  const hasPassword = Boolean(f.password && f.password.length > 0);
  const isPublic = Boolean(f.isPublic);

  if (user?.id !== f.userId) {
    if (hasPassword) {
      const ok =
        suppliedPassword &&
        (await verifyPasswordHash(suppliedPassword, f.password));
      if (!ok) {
        return NextResponse.redirect(
          `${appUrl || ""}/v/${encodeURIComponent(f.slug)}`,
        );
      }
    } else if (!isPublic) {
      return NextResponse.redirect(
        `${appUrl || ""}/v/${encodeURIComponent(f.slug)}`,
      );
    }
  }

  const driver =
    (f as { storageDriver?: StorageDriver }).storageDriver ||
    (await getDefaultStorageDriver());
  const storedName = streamAssetStoredName(f.id, assetPath);

  const storageRead = await readFromStorage(
    { userId: f.userId, storedName },
    { driver },
  );

  if (!storageRead) {
    return NextResponse.json({ message: "Stream not ready" }, { status: 404 });
  }

  const meta = storageRead.meta;
  const contentType = getHlsContentType(assetPath);
  const lowerAsset = assetPath.toLowerCase();
  const isPlaylist = lowerAsset.endsWith(".m3u8");
  const isSegment =
    lowerAsset.endsWith(".ts") ||
    lowerAsset.endsWith(".m4s") ||
    lowerAsset.endsWith(".aac");
  const cachePolicy = (() => {
    if (isPlaylist) {
      return isPublic && !hasPassword
        ? "public, max-age=30, s-maxage=300, stale-while-revalidate=300"
        : "private, max-age=30";
    }
    if (isSegment) {
      return isPublic && !hasPassword
        ? "public, max-age=31536000, immutable, s-maxage=31536000"
        : "private, max-age=3600";
    }
    return isPublic && !hasPassword
      ? "public, max-age=31536000, immutable"
      : "private, max-age=3600";
  })();
  const lastModified = meta.lastModified.toUTCString();

  const h = await headers();
  const ifNoneMatch = h.get("if-none-match");
  const ifModifiedSince = h.get("if-modified-since");
  if (
    ifNoneMatch === meta.etag ||
    (ifModifiedSince &&
      Date.parse(ifModifiedSince) >= meta.lastModified.getTime())
  ) {
    const hdrs = buildHeaders({
      contentType,
      etag: meta.etag,
      lastModified,
      size: meta.size,
      isPublic,
      hasPassword,
      cachePolicy,
      includeLength: false,
    });
    return new NextResponse(null, { status: 304, headers: hdrs });
  }

  if (
    assetPath.toLowerCase().endsWith(".m3u8") &&
    hasPassword &&
    suppliedPassword
  ) {
    const text = await readStreamText(storageRead.stream);
    const patched = appendQueryToPlaylist(
      text,
      `p=${encodeURIComponent(suppliedPassword)}`,
    );
    const buf = Buffer.from(patched, "utf8");
    const hdrs = buildHeaders({
      contentType,
      etag: meta.etag,
      lastModified,
      size: buf.length,
      isPublic,
      hasPassword,
      cachePolicy,
      includeLength: true,
    });
    return new NextResponse(buf, { status: 200, headers: hdrs });
  }

  const hdrs = buildHeaders({
    contentType,
    etag: meta.etag,
    lastModified,
    size: storageRead.contentLength ?? meta.size,
    isPublic,
    hasPassword,
    cachePolicy,
    includeLength: true,
  });

  return new NextResponse(toSafeWebStream(storageRead.stream, req.signal), {
    status: 200,
    headers: hdrs,
  });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  const resp = await GET(req, ctx);
  return new NextResponse(null, { status: resp.status, headers: resp.headers });
}
