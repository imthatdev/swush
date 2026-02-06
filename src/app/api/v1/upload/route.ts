/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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
  abortChunkedUpload,
  completeChunkedUpload,
  getChunkedUploadStatus,
  initChunkedUpload,
  listFiles,
  uploadChunkPart,
  uploadFile,
} from "@/lib/api/files";
import { auditRequest } from "@/lib/api/audit";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/ip";
import { withApiError } from "@/lib/server/api-error";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { requireUserFeature } from "@/lib/server/user-features";

export const runtime = "nodejs";

async function requireUploadsEnabled(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
  if (!user)
    return {
      blocked: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  const blocked = await requireUserFeature(user.id, "files");
  if (blocked) return { blocked };
  return { blocked: null };
}

export const GET = withApiError(async function GET(req: NextRequest) {
  const { blocked } = await requireUploadsEnabled(req);
  if (blocked) return blocked;
  const ip = getClientIp(req);
  const action = (req.nextUrl.searchParams.get("action") || "").toLowerCase();

  if (action === "status") {
    const ipLimit = 120;
    const windowMs = 60_000;

    const ipRL = await rateLimit({
      key: `ip:${ip}:upload-status`,
      limit: ipLimit,
      windowMs,
    });

    if (!ipRL.success) {
      const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
      const res = NextResponse.json(
        { message: `Too many status checks. Try again in ${retry}s` },
        { status: 429 },
      );
      res.headers.set("RateLimit-Limit", String(ipLimit));
      res.headers.set("RateLimit-Remaining", "0");
      res.headers.set("RateLimit-Reset", String(retry));
      res.headers.set("Retry-After", String(retry));
      return res;
    }

    const result = await getChunkedUploadStatus(req);
    const res = NextResponse.json(result.body, { status: result.status });
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
    return res;
  }
  const ipLimit = 60;
  const windowMs = 60_000;

  const ipRL = await rateLimit({
    key: `ip:${ip}:uploads-list`,
    limit: ipLimit,
    windowMs,
  });

  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many file list attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const result = await listFiles(req);
  const res = NextResponse.json(result.body, { status: result.status });
  res.headers.set("RateLimit-Limit", String(ipLimit));
  res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return res;
});

export const POST = withApiError(async function POST(req: NextRequest) {
  const { blocked } = await requireUploadsEnabled(req);
  if (blocked) return blocked;
  const ip = getClientIp(req);
  const action = (req.nextUrl.searchParams.get("action") || "").toLowerCase();

  if (action === "init") {
    const ipLimit = 30;
    const windowMs = 60_000;
    const ipRL = await rateLimit({
      key: `ip:${ip}:upload-init`,
      limit: ipLimit,
      windowMs,
    });
    if (!ipRL.success) {
      const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
      const res = NextResponse.json(
        { message: `Too many upload init attempts. Try again in ${retry}s` },
        { status: 429 },
      );
      res.headers.set("RateLimit-Limit", String(ipLimit));
      res.headers.set("RateLimit-Remaining", "0");
      res.headers.set("RateLimit-Reset", String(retry));
      res.headers.set("Retry-After", String(retry));
      return res;
    }

    const result = await initChunkedUpload(req);
    const res = NextResponse.json(result.body, { status: result.status });
    if (result.status === 200 && result.body) {
      if (typeof result.body.chunkSize === "number") {
        res.headers.set("Upload-Chunk-Size", String(result.body.chunkSize));
      }
      if (typeof result.body.ttlSeconds === "number") {
        res.headers.set("Upload-Chunk-TTL", String(result.body.ttlSeconds));
      }
      const retry = result.body.retry;
      if (retry && typeof retry === "object") {
        const baseMs =
          "baseMs" in retry ? (retry as { baseMs?: number }).baseMs : undefined;
        const maxMs =
          "maxMs" in retry ? (retry as { maxMs?: number }).maxMs : undefined;
        const maxRetries =
          "maxRetries" in retry
            ? (retry as { maxRetries?: number }).maxRetries
            : undefined;
        if (typeof baseMs === "number")
          res.headers.set("Upload-Retry-Base", String(baseMs));
        if (typeof maxMs === "number")
          res.headers.set("Upload-Retry-Max", String(maxMs));
        if (typeof maxRetries === "number")
          res.headers.set("Upload-Retry-MaxRetries", String(maxRetries));
      }
    }
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
    return res;
  }

  if (action === "complete") {
    const ipLimit = 30;
    const windowMs = 60_000;
    const ipRL = await rateLimit({
      key: `ip:${ip}:upload-complete`,
      limit: ipLimit,
      windowMs,
    });
    if (!ipRL.success) {
      const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
      const res = NextResponse.json(
        { message: `Too many upload completes. Try again in ${retry}s` },
        { status: 429 },
      );
      res.headers.set("RateLimit-Limit", String(ipLimit));
      res.headers.set("RateLimit-Remaining", "0");
      res.headers.set("RateLimit-Reset", String(retry));
      res.headers.set("Retry-After", String(retry));
      return res;
    }

    const result = await completeChunkedUpload(req);

    try {
      await auditRequest(req, {
        action: "file.upload",
        targetType: "file",
        targetId: result.body?.id ?? "unknown",
        statusCode: result.status,
        meta: {
          title: result.body?.originalName ?? null,
          error:
            result.status !== 201
              ? (result.body?.message ?? "upload failed")
              : null,
          mode: "chunked",
        },
      });
    } catch {
      // Audit failures should not break uploads.
    }

    const res = NextResponse.json(result.body, { status: result.status });
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
    return res;
  }

  if (action === "abort") {
    const ipLimit = 30;
    const windowMs = 60_000;
    const ipRL = await rateLimit({
      key: `ip:${ip}:upload-abort`,
      limit: ipLimit,
      windowMs,
    });
    if (!ipRL.success) {
      const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
      const res = NextResponse.json(
        { message: `Too many upload aborts. Try again in ${retry}s` },
        { status: 429 },
      );
      res.headers.set("RateLimit-Limit", String(ipLimit));
      res.headers.set("RateLimit-Remaining", "0");
      res.headers.set("RateLimit-Reset", String(retry));
      res.headers.set("Retry-After", String(retry));
      return res;
    }

    const result = await abortChunkedUpload(req);
    const res = NextResponse.json(result.body, { status: result.status });
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
    return res;
  }

  const ipLimit = 20;
  const windowMs = 60_000;

  const ipRL = await rateLimit({
    key: `ip:${ip}:upload`,
    limit: ipLimit,
    windowMs,
  });
  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many upload attempts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));

    await auditRequest(req, {
      action: "file.upload",
      targetType: "file",
      targetId: "unknown",
      statusCode: 429,
      meta: { ip, reason: "rate_limited" },
    });

    return res;
  }

  const result = await uploadFile(req);

  try {
    await auditRequest(req, {
      action: "file.upload",
      targetType: "file",
      targetId:
        result.body &&
        typeof result.body === "object" &&
        "id" in result.body &&
        typeof (result.body as { id?: unknown }).id === "string"
          ? (result.body as { id: string }).id
          : "unknown",
      statusCode: result.status,
      meta: {
        title: result.body?.message ?? null,
        error: result.status !== 201 ? "upload failed" : null,
      },
    });
  } catch {
    // Audit failures should not break uploads.
  }

  const res = NextResponse.json(result.body, { status: result.status });
  res.headers.set("RateLimit-Limit", String(ipLimit));
  res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return res;
});

export const PUT = withApiError(async function PUT(req: NextRequest) {
  const { blocked } = await requireUploadsEnabled(req);
  if (blocked) return blocked;
  const ip = getClientIp(req);
  const action = (req.nextUrl.searchParams.get("action") || "").toLowerCase();
  if (action !== "part") {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const ipLimit = 180;
  const windowMs = 60_000;
  const ipRL = await rateLimit({
    key: `ip:${ip}:upload-part`,
    limit: ipLimit,
    windowMs,
  });
  if (!ipRL.success) {
    const retry = ipRL.retryAfter ?? Math.ceil(windowMs / 1000);
    const res = NextResponse.json(
      { message: `Too many upload parts. Try again in ${retry}s` },
      { status: 429 },
    );
    res.headers.set("RateLimit-Limit", String(ipLimit));
    res.headers.set("RateLimit-Remaining", "0");
    res.headers.set("RateLimit-Reset", String(retry));
    res.headers.set("Retry-After", String(retry));
    return res;
  }

  const result = await uploadChunkPart(req);
  const res = NextResponse.json(result.body, { status: result.status });
  res.headers.set("RateLimit-Limit", String(ipLimit));
  res.headers.set("RateLimit-Reset", String(Math.ceil(windowMs / 1000)));
  return res;
});
