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
import path from "path";
import { readFile } from "fs/promises";
import { db } from "@/db/client";
import { user as userTable } from "@/db/schemas";
import { eq } from "drizzle-orm";
import {
  getDefaultStorageDriver,
  statFromStorage,
  readFromStorage,
  type StorageDriver,
} from "@/lib/storage";
import { withApiError } from "@/lib/server/api-error";
import {
  AVATAR_STORAGE_NAMESPACE,
  DEFAULT_AVATAR_PATH,
  avatarStoredName,
  isSafeAvatarFileName,
  legacyAvatarStoredName,
} from "@/lib/avatar";

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

export const runtime = "nodejs";

type Params = Promise<{ userId: string }>;

async function serveDefaultAvatar() {
  const filePath = path.join(
    process.cwd(),
    "public",
    DEFAULT_AVATAR_PATH.replace(/^\//, ""),
  );

  try {
    const buf = await readFile(filePath);
    const res = new NextResponse(buf, { status: 200 });
    res.headers.set("Content-Type", "image/png");
    res.headers.set("Content-Length", String(buf.length));
    res.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    res.headers.set("X-Content-Type-Options", "nosniff");
    return res;
  } catch {
    return NextResponse.json(
      { message: "Missing default avatar" },
      { status: 404 },
    );
  }
}

export const GET = withApiError(async function GET(
  req: NextRequest,
  { params }: { params: Params },
) {
  const { userId } = await params;

  const [userRow] = await db
    .select({ image: userTable.image })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  const fileFromDb = (() => {
    const img = userRow?.image;
    if (typeof img !== "string" || !img.trim()) return null;
    try {
      const u = new URL(img, req.nextUrl.origin);
      const parts = u.pathname.split("/").filter(Boolean);
      if (
        parts.length === 5 &&
        parts[0] === "api" &&
        parts[1] === "v1" &&
        parts[2] === "avatar" &&
        parts[3] === userId
      ) {
        const file = parts[4] ?? "";
        return isSafeAvatarFileName(file) ? file : null;
      }
    } catch {
      return null;
    }
    return null;
  })();

  const primaryTarget = fileFromDb
    ? {
        userId: AVATAR_STORAGE_NAMESPACE,
        storedName: avatarStoredName(userId, fileFromDb),
      }
    : null;

  const legacyTarget = {
    userId: AVATAR_STORAGE_NAMESPACE,
    storedName: legacyAvatarStoredName(userId),
  };

  const target = primaryTarget ?? legacyTarget;

  const driver = await getDefaultStorageDriver();
  const meta = await statFromStorage(target, { driver });
  if (!meta && primaryTarget) {
    const legacyMeta = await statFromStorage(legacyTarget, { driver });
    if (!legacyMeta) return serveDefaultAvatar();
    return streamAvatar(req, legacyTarget, legacyMeta, {
      cacheControl: "public, max-age=0, must-revalidate",
      driver,
    });
  }
  if (!meta) return serveDefaultAvatar();

  return streamAvatar(req, target, meta, {
    cacheControl: fileFromDb
      ? "public, max-age=60, must-revalidate"
      : "public, max-age=0, must-revalidate",
    driver,
  });
});

async function streamAvatar(
  req: NextRequest,
  target: { userId: string; storedName: string },
  meta: {
    size: number;
    etag: string;
    lastModified: Date;
    contentType?: string;
  },
  opts: { cacheControl: string; driver: StorageDriver },
) {
  const etag = meta.etag;
  const lastModifiedDate = meta.lastModified;
  const lastModified = lastModifiedDate.toUTCString();

  const ifNoneMatch = req.headers.get("if-none-match");
  const ifModifiedSince = req.headers.get("if-modified-since");
  if (
    ifNoneMatch === etag ||
    (ifModifiedSince &&
      Date.parse(ifModifiedSince) >= lastModifiedDate.getTime())
  ) {
    const res = new NextResponse(null, { status: 304 });
    res.headers.set("ETag", etag);
    res.headers.set("Last-Modified", lastModified);
    res.headers.set("Cache-Control", opts.cacheControl);
    return res;
  }

  const storageRead = await readFromStorage(target, {
    knownMeta: meta,
    driver: opts.driver,
  });

  if (!storageRead) return serveDefaultAvatar();

  const res = new NextResponse(
    toSafeWebStream(storageRead.stream, req.signal),
    {
      status: 200,
    },
  );
  res.headers.set("Content-Type", "image/png");
  res.headers.set(
    "Content-Length",
    String(storageRead.contentLength ?? meta.size),
  );
  res.headers.set("ETag", etag);
  res.headers.set("Last-Modified", lastModified);
  res.headers.set("Cache-Control", opts.cacheControl);
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
}
