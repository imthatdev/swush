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
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { getCurrentUser, getCurrentUserFromToken } from "@/lib/client/user";
import { db } from "@/db/client";
import { files as filesTable } from "@/db/schemas/core-schema";
import { getServerSettings } from "@/lib/settings";
import { fileTypeFromBuffer } from "file-type";
import { eq } from "drizzle-orm";
import {
  enforceCreateLimit,
  enforceUploadPolicy,
  LimitPolicyError,
  Role,
} from "@/lib/security/policy";
import { getDefaultStorageDriver, putFileToStorage } from "@/lib/storage";
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
import { runVirusScanIfEnabled, VirusScanError } from "@/lib/server/virus-scan";
import { emitWebhookEvent } from "@/lib/server/integrations/webhooks";

type UploadUser = {
  id: string;
  username: string;
  role: Role | string;
};

type UploadOverrides = {
  folderName?: string | null;
  forcePrivate?: boolean;
  ignoreTags?: boolean;
};

export async function uploadFileForUser(
  req: NextRequest,
  user: UploadUser,
  overrides: UploadOverrides = {},
) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return { status: 400 as const, body: { message: "No file provided" } };
    }

    const settings = await getServerSettings();
    const name = form.get("name");
    const nameConventionRaw = form.get("nameConvention");
    const description =
      typeof form.get("description") === "string"
        ? String(form.get("description")).trim()
        : null;
    const isPublicRaw = form.get("isPublic");
    const desiredSlugRaw = form.get("slug");
    const slugConventionRaw = form.get("slugConvention");
    const maxViewsRaw = form.get("maxViews");
    const maxViewsActionRaw = form.get("maxViewsAction");

    const folderIdRaw = form.get("folderId");
    const folderNameRaw = form.get("folderName");

    const tagIdsRaw = form.get("tagIds");
    const newTagsRaw = form.get("newTags");

    const passwordRaw = form.get("password");
    let hashedPassword: string | null = null;
    if (typeof passwordRaw === "string" && passwordRaw.trim()) {
      hashedPassword = await hashPassword(passwordRaw.trim());
    }
    const maxViews = normalizeMaxViews(
      typeof maxViewsRaw === "string" ? maxViewsRaw : null,
    );
    const maxViewsAction = maxViews
      ? normalizeMaxViewsAction(
          typeof maxViewsActionRaw === "string" ? maxViewsActionRaw : null,
        )
      : null;

    const desiredSlug =
      typeof desiredSlugRaw === "string" ? desiredSlugRaw.trim() : "";
    const userSettings = await getUserUploadSettings(user.id);
    const nameConvention =
      normalizeNameConvention(
        typeof nameConventionRaw === "string" ? nameConventionRaw : null,
      ) ?? userSettings.nameConvention;
    const slugConvention =
      normalizeSlugConvention(
        typeof slugConventionRaw === "string" ? slugConventionRaw : null,
      ) ?? userSettings.slugConvention;
    const incomingTagIds: string[] =
      !overrides.ignoreTags && typeof tagIdsRaw === "string" && tagIdsRaw.trim()
        ? (JSON.parse(tagIdsRaw) as string[]).filter(
            (s) => typeof s === "string",
          )
        : [];
    const incomingNewTagNames: string[] =
      !overrides.ignoreTags &&
      typeof newTagsRaw === "string" &&
      newTagsRaw.trim()
        ? newTagsRaw
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

    const incomingFolderId =
      typeof folderIdRaw === "string" && folderIdRaw.trim()
        ? folderIdRaw.trim()
        : null;
    const incomingFolderName =
      typeof overrides.folderName === "string"
        ? overrides.folderName.trim()
        : typeof folderNameRaw === "string"
          ? folderNameRaw.trim()
          : "";

    const explicitName = typeof name === "string" ? name.trim() : "";
    const originalName = await buildNameWithConvention({
      explicitName,
      fileName: file.name,
      convention: nameConvention,
    });

    const slug = await buildSlugWithConvention({
      desiredSlug,
      originalName,
      convention: slugConvention,
      user: { role: user.role, username: user.username },
    });

    const exists = await db
      .select({ id: filesTable.id })
      .from(filesTable)
      .where(eq(filesTable.slug, slug))
      .limit(1);

    if (exists.length > 0) {
      return { status: 409 as const, body: { message: "Slug already in use" } };
    }

    const mimeType = file.type || "application/octet-stream";
    const ext = (path.extname(file.name) || "").toLowerCase();
    const storedName = `${nanoid()}${ext || ""}`;
    const arrayBuffer = await file.arrayBuffer();

    const buf = Buffer.from(arrayBuffer);
    const size = buf.length;
    const sig = await fileTypeFromBuffer(buf);
    const effectiveMime = sig?.mime || mimeType;
    const contentHash = crypto.createHash("sha256").update(buf).digest("hex");

    await runVirusScanIfEnabled({
      userId: user.id,
      filename: file.name,
      mimeType: effectiveMime,
      size,
      sha256: contentHash,
      buffer: buf,
    });

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

    if (disallowedExts.length > 0 && disallowedExts.includes(ext)) {
      return {
        status: 400 as const,
        body: { message: `Files with ${ext} extension are not allowed` },
      };
    }

    const driver = await getDefaultStorageDriver();
    await putFileToStorage({
      target: { userId: user.id, storedName },
      buffer: buf,
      contentType: effectiveMime,
      driver,
    });

    const isPublic = overrides.forcePrivate
      ? false
      : (typeof isPublicRaw === "string" &&
          isPublicRaw.toLowerCase() === "true") ||
        (typeof isPublicRaw === "boolean" && isPublicRaw === true);

    const folderId = await resolveFolderId({
      userId: user.id,
      incomingFolderId,
      incomingFolderName,
    });

    const [row] = await db
      .insert(filesTable)
      .values({
        userId: user.id,
        folderId: folderId ?? null,
        originalName,
        storedName,
        storageDriver: driver,
        mimeType: effectiveMime,
        size,
        slug,
        description,
        isPublic,
        password: hashedPassword,
        contentHash,
        maxViews,
        maxViewsAction,
        maxViewsTriggeredAt: null,
      })
      .returning();

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
      (effectiveMime.startsWith("image/") &&
        effectiveMime !== "image/svg+xml")
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
      incomingTagIds,
      incomingNewTagNames,
    });

    setImmediate(() => {
      void emitWebhookEvent({
        userId: user.id,
        event: "file.uploaded",
        payload: {
          id: row.id,
          slug: row.slug,
          originalName: row.originalName,
          mimeType: row.mimeType,
          size: row.size,
          isPublic: row.isPublic,
          createdAt: row.createdAt,
          url: `${req.nextUrl.origin}/x/${row.slug}`,
        },
      }).catch(() => {});
    });

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
        contentHash: row.contentHash,
        maxViews: row.maxViews,
        maxViewsAction: row.maxViewsAction,
        createdAt: row.createdAt,
        folder: incomingFolderName || null,
        tags: responseTags,
        url: `${req.nextUrl.origin}/x/${row.slug}`,
      },
    };
  } catch (err) {
    if (err instanceof VirusScanError) {
      return { status: err.status, body: { message: err.message } };
    }
    console.error("uploadFileForUser failed", err);
    if (err instanceof LimitPolicyError) {
      return { status: 429 as const, body: { error: err.message } };
    }
    return {
      status: 500 as const,
      body: {
        message: "Upload failed",
        error:
          err instanceof Error
            ? err.message
            : typeof err === "string"
              ? err
              : "Unknown error",
      },
    };
  }
}

export async function uploadFile(req: NextRequest) {
  let user = await getCurrentUser();
  if (!user) user = await getCurrentUserFromToken(req, undefined, ["upload"]);
  if (!user) return { status: 401 as const, body: { message: "Unauthorized" } };

  return uploadFileForUser(req, {
    id: user.id,
    username: user.username!,
    role: user.role,
  });
}
