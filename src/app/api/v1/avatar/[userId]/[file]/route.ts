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
import {
  getDefaultStorageDriver,
  readFromStorage,
  statFromStorage,
} from "@/lib/storage";
import { withApiError } from "@/lib/server/api-error";
import {
  AVATAR_STORAGE_NAMESPACE,
  avatarStoredName,
  isSafeAvatarFileName,
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

type Params = Promise<{ userId: string; file: string }>;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const GET = withApiError(async function GET(
  req: NextRequest,
  { params }: { params: Params },
) {
  const { userId, file } = await params;
  if (!isSafeAvatarFileName(file)) {
    return NextResponse.json(
      { message: "Invalid avatar file" },
      { status: 400 },
    );
  }

  const target = {
    userId: AVATAR_STORAGE_NAMESPACE,
    storedName: avatarStoredName(userId, file),
  };

  const driver = await getDefaultStorageDriver();
  let meta = await statFromStorage(target, { driver });
  if (!meta) {
    for (let attempt = 0; attempt < 3 && !meta; attempt++) {
      await sleep(150 * (attempt + 1));
      meta = await statFromStorage(target, { driver });
    }
  }

  if (!meta) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

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
    res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return res;
  }

  let storageRead = await readFromStorage(target, {
    knownMeta: meta,
    driver,
  });

  if (!storageRead) {
    await sleep(150);
    const refreshed = await statFromStorage(target, { driver });
    if (refreshed) {
      meta = refreshed;
      storageRead = await readFromStorage(target, {
        knownMeta: meta,
        driver,
      });
    }
  }

  if (!storageRead) {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

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
  res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  res.headers.set("X-Content-Type-Options", "nosniff");
  return res;
});
