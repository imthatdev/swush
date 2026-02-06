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

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { files } from "@/db/schemas/core-schema";
import { eq, or, sql } from "drizzle-orm";
import { verifyPasswordHash } from "@/lib/api/password";
import { getCurrentUser } from "@/lib/client/user";
import {
  readFromStorage,
  statFromStorage,
  type StorageDriver,
  getDefaultStorageDriver,
} from "@/lib/storage";
import { getMimeFromFile } from "@/lib/mime-types";
import { getPublicRuntimeSettings } from "@/lib/server/runtime-settings";

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

function buildCommonHeaders({
  contentType,
  size,
  filename,
  etag,
  lastModified,
  isPublic,
  hasPassword,
  includeLength = true,
  cachePolicy,
  expires,
}: {
  contentType: string;
  size: number;
  filename: string;
  etag: string;
  lastModified: string;
  isPublic: boolean;
  hasPassword: boolean;
  includeLength?: boolean;
  cachePolicy?: string;
  expires?: string;
}) {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(
      filename,
    )}`,
    ETag: etag,
    "Last-Modified": lastModified,
    "X-Content-Type-Options": "nosniff",
  };

  if (includeLength) headers["Content-Length"] = String(size);

  if (cachePolicy) {
    headers["Cache-Control"] = cachePolicy;
  } else if (isPublic && !hasPassword) {
    headers["Cache-Control"] =
      "public, max-age=31536000, immutable, s-maxage=31536000";
  } else {
    headers["Cache-Control"] = "private, no-store";
  }

  if (expires) {
    headers["Expires"] = expires;
  }

  return headers;
}

function ensureExt(name: string, mime: string, hintedExt?: string) {
  if (hintedExt && hintedExt.startsWith(".")) {
    const base = name.replace(/\.[A-Za-z0-9]{1,8}$/i, "");
    return `${base}${hintedExt}`;
  }
  const hasExt = /\.[A-Za-z0-9]{1,8}$/.test(name);
  if (hasExt) return name;
  const map: Record<string, string> = {
    "image/gif": ".gif",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
  };
  const ext = map[mime] || "";
  return ext ? `${name}${ext}` : name;
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

async function streamFile(
  f: {
    userId: string;
    storedName: string;
    originalName?: string | null;
    mimeType?: string | null;
  },
  req: NextRequest,
  opts: {
    isPublic: boolean;
    hasPassword: boolean;
    hintedExt?: string;
    isPreviewAsset?: boolean;
  },
): Promise<NextResponse> {
  const target = { userId: f.userId, storedName: f.storedName };
  const driver =
    (f as { storageDriver?: StorageDriver }).storageDriver ||
    (await getDefaultStorageDriver());
  let meta = await statFromStorage(target, { driver });

  if (!meta && driver === "s3") {
    await new Promise((resolve) => setTimeout(resolve, 150));
    meta = await statFromStorage(target, { driver });
  }
  if (!meta) {
    return NextResponse.json({ message: "Missing file" }, { status: 404 });
  }

  let contentType =
    meta.contentType || f.mimeType || "application/octet-stream";
  if (opts.hintedExt) {
    const hintedMime = getMimeFromFile(opts.hintedExt);
    if (hintedMime) contentType = hintedMime;
  }

  const filename = ensureExt(
    (f.originalName || f.storedName || "file").toString(),
    contentType,
    opts.hintedExt
      ? opts.hintedExt.startsWith(".")
        ? opts.hintedExt
        : `.${opts.hintedExt}`
      : undefined,
  );

  const etag = meta.etag;
  const lastModifiedDate = meta.lastModified;
  const lastModified = lastModifiedDate.toUTCString();

  const h = await headers();
  const expires = opts.isPreviewAsset
    ? new Date(Date.now() + 31536000 * 1000).toUTCString()
    : undefined;
  const cachePolicy = opts.isPreviewAsset
    ? opts.isPublic && !opts.hasPassword
      ? "public, max-age=31536000, immutable, s-maxage=31536000"
      : "private, max-age=31536000, immutable"
    : undefined;
  const ifNoneMatch = h.get("if-none-match");
  const ifModifiedSince = h.get("if-modified-since");
  if (
    ifNoneMatch === etag ||
    (ifModifiedSince &&
      Date.parse(ifModifiedSince) >= lastModifiedDate.getTime())
  ) {
    const hdrs = buildCommonHeaders({
      contentType,
      size: meta.size,
      filename,
      etag,
      lastModified,
      isPublic: opts.isPublic,
      hasPassword: opts.hasPassword,
      includeLength: false,
      cachePolicy,
      expires,
    });
    return new NextResponse(null, { status: 304, headers: hdrs });
  }

  const baseHeaders = buildCommonHeaders({
    contentType,
    size: meta.size,
    filename,
    etag,
    lastModified,
    isPublic: opts.isPublic,
    hasPassword: opts.hasPassword,
    cachePolicy,
    expires,
  });

  const range = req.headers.get("range");
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...baseHeaders, "Content-Range": `bytes */${meta.size}` },
      });
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : meta.size - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      end >= meta.size
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: { ...baseHeaders, "Content-Range": `bytes */${meta.size}` },
      });
    }

    const storageRead = await readFromStorage(target, {
      range: { start, end },
      knownMeta: meta,
      driver,
    });

    if (!storageRead) {
      return NextResponse.json({ message: "Missing file" }, { status: 404 });
    }

    const chunkSize = storageRead.contentLength ?? end - start + 1;

    return new NextResponse(toSafeWebStream(storageRead.stream, req.signal), {
      status: 206,
      headers: {
        ...baseHeaders,
        "Content-Range":
          storageRead.contentRange ?? `bytes ${start}-${end}/${meta.size}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  const storageRead = await readFromStorage(target, {
    knownMeta: meta,
    driver,
  });

  if (!storageRead) {
    return NextResponse.json({ message: "Missing file" }, { status: 404 });
  }

  return new NextResponse(toSafeWebStream(storageRead.stream, req.signal), {
    status: 200,
    headers: baseHeaders,
  });
}

type Params = Promise<{ slug: string }>;

export async function GET(req: NextRequest, { params }: { params: Params }) {
  const user = await getCurrentUser();
  const { appUrl } = await getPublicRuntimeSettings();

  const resolved = await params;
  const slug = (resolved?.slug ?? resolved?.slug) as string;

  let rawSlug = slug;
  let hintedExt: string | undefined;
  const dot = slug.lastIndexOf(".");
  if (dot > 0 && slug.length - dot <= 6) {
    hintedExt = slug.slice(dot + 1);
    rawSlug = slug.slice(0, dot);
  }

  const f = await fetchFileRow(rawSlug);
  if (!f) return NextResponse.json({ message: "Not found" }, { status: 404 });

  const originalMime = f.mimeType;
  const isPreviewAsset =
    typeof hintedExt === "string" &&
    hintedExt.toLowerCase() === "png" &&
    (originalMime?.startsWith("video/") ||
      (originalMime?.startsWith("image/") && originalMime !== "image/svg+xml"));

  if (hintedExt) {
    const ext = hintedExt.startsWith(".") ? hintedExt : `.${hintedExt}`;
    const baseName = f.storedName.replace(/\.[^/.]+$/, "");
    f.storedName = `${baseName}${ext}`;
    f.mimeType = getMimeFromFile(hintedExt) || "application/octet-stream";
  }

  const url = new URL(req.url);
  const suppliedPassword = url.searchParams.get("p") || undefined;

  const hasPassword = Boolean(f.password && f.password.length > 0);
  const isPublic = Boolean(f.isPublic);

  if (user?.id === f.userId) {
    return streamFile(f, req, {
      isPublic,
      hasPassword,
      hintedExt,
      isPreviewAsset,
    });
  }

  if (hasPassword) {
    const ok =
      suppliedPassword &&
      (await verifyPasswordHash(suppliedPassword, f.password));

    if (!ok) {
      return NextResponse.redirect(
        `${appUrl || ""}/v/${encodeURIComponent(f.slug)}`,
      );
    }
    return streamFile(f, req, {
      isPublic,
      hasPassword,
      hintedExt,
      isPreviewAsset,
    });
  }

  if (!isPublic) {
    return NextResponse.redirect(
      `${appUrl || ""}/v/${encodeURIComponent(f.slug)}`,
    );
  }

  return streamFile(f, req, {
    isPublic,
    hasPassword,
    hintedExt,
    isPreviewAsset,
  });
}

export async function HEAD(req: NextRequest, ctx: { params: Params }) {
  const resp = await GET(req, ctx);

  return new NextResponse(null, { status: resp.status, headers: resp.headers });
}
