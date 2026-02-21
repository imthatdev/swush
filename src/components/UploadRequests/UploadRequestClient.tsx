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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import PageLayout from "@/components/Common/PageLayout";
import UploadDropzone from "@/components/Upload/UploadDropzone";
import UploadQueue from "@/components/Upload/UploadQueue";
import type { UploadItem } from "@/components/Upload/types";
import { apiV1 } from "@/lib/api-path";
import { toast } from "sonner";
import { useAppConfig } from "@/components/Providers/AppConfigProvider";
import TurnstileWidget from "@/components/Common/TurnstileWidget";

export type UploadRequestPublic = {
  title: string;
  description?: string | null;
  owner: { username: string; displayName?: string | null };
  limits: { maxUploadMb: number; maxFilesPerUpload: number };
  isActive: boolean;
  expiresAt?: string | null;
  brandColor?: string | null;
  brandLogoUrl?: string | null;
  maxUploads?: number | null;
  uploadsCount?: number | null;
  viewsCount?: number | null;
  requiresApproval?: boolean;
  requiresPassword?: boolean;
  authorized?: boolean;
  perUserUploadLimit?: number | null;
  perUserWindowHours?: number | null;
};

export default function UploadRequestClient({
  slug,
  data,
}: {
  slug: string;
  data: UploadRequestPublic;
}) {
  const [files, setFiles] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaPass, setCaptchaPass] = useState("");
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);
  const { turnstileSiteKey } = useAppConfig();
  const [password, setPassword] = useState("");

  const pendingCount = useMemo(
    () => files.filter((f) => !f.uploaded && !f.error).length,
    [files],
  );
  const uploadedCount = useMemo(
    () => files.filter((f) => f.uploaded).length,
    [files],
  );

  useEffect(() => {
    const next = new Map<File, string>();
    files.forEach((f) => {
      if (!previewUrls.has(f.file)) {
        next.set(f.file, URL.createObjectURL(f.file));
      } else {
        next.set(f.file, previewUrls.get(f.file)!);
      }
    });
    previewUrls.forEach((url, file) => {
      if (!next.has(file)) URL.revokeObjectURL(url);
    });
    setPreviewUrls(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const addFiles = (incoming: File[]) => {
    const maxFiles = data.limits.maxFilesPerUpload || 0;
    const available = maxFiles > 0 ? Math.max(0, maxFiles - files.length) : 0;
    const allowed = maxFiles > 0 ? incoming.slice(0, available) : incoming;
    if (maxFiles > 0 && incoming.length > allowed.length) {
      toast.warning(`Only ${allowed.length} file(s) allowed for this upload.`);
    }
    setFiles((cur) => [
      ...cur,
      ...allowed.map((file) => ({
        file,
        customName: "",
        description: "",
        isPublic: false,
      })),
    ]);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    if (!incoming.length) return;
    addFiles(incoming);
    e.target.value = "";
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const incoming = Array.from(e.dataTransfer.files || []);
    if (!incoming.length) return;
    addFiles(incoming);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.files || []);
    if (!items.length) return;
    addFiles(items);
  };

  const uploadOne = async (item: UploadItem, index: number) => {
    const form = new FormData();
    form.append("file", item.file);
    try {
      const res = await fetch(
        apiV1(`/upload-requests/p/${encodeURIComponent(slug)}/files`),
        {
          method: "POST",
          body: form,
          headers: {
            ...(captchaPass ? { "x-captcha-pass": captchaPass } : {}),
            ...(password.trim()
              ? { "x-upload-password": password.trim() }
              : {}),
          },
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Upload failed");
      setFiles((cur) =>
        cur.map((f, i) => (i === index ? { ...f, uploaded: true } : f)),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("captcha")) {
        setCaptchaPass("");
        setCaptchaToken("");
        setCaptchaKey((k) => k + 1);
      }
      setFiles((cur) =>
        cur.map((f, i) => (i === index ? { ...f, error: message } : f)),
      );
    }
  };

  const handleUpload = async () => {
    if (!files.length) return;
    if (data.requiresPassword && !password.trim()) {
      toast.error("Password required to upload.");
      return;
    }
    if (turnstileSiteKey && !captchaPass) {
      if (!captchaToken) {
        toast.error("Please complete the captcha to upload.");
        return;
      }
      setCaptchaVerifying(true);
      try {
        const res = await fetch(apiV1("/captcha/verify"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: captchaToken }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          const codes = Array.isArray(json?.errorCodes)
            ? json.errorCodes.join(", ")
            : "";
          throw new Error(
            codes
              ? `Captcha verification failed: ${codes}`
              : "Captcha verification failed",
          );
        }
        setCaptchaPass(json.pass || "");
        setCaptchaToken("");
        setCaptchaKey((k) => k + 1);
      } catch (err) {
        toast.error("Captcha verification failed", {
          description: err instanceof Error ? err.message : String(err),
        });
        return;
      } finally {
        setCaptchaVerifying(false);
      }
    }
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const item = files[i];
        if (item.uploaded) continue;
        await uploadOne(item, i);
      }
      toast.success("Upload complete");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    setFiles((cur) => cur.filter((_, i) => i !== index));
  };

  const handleRetry = (index: number) => {
    setFiles((cur) =>
      cur.map((f, i) => (i === index ? { ...f, error: undefined } : f)),
    );
  };

  return (
    <PageLayout
      title={data.title}
      subtitle={`Upload files to ${data.owner.displayName || data.owner.username}`}
      className="md:w-4xl"
      headerActions={
        <button
          className="rounded-md border px-3 py-1.5 text-sm text-muted-foreground"
          type="button"
        >
          Guest upload
        </button>
      }
      toolbar={
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={handleUpload}
          disabled={isUploading || files.length === 0 || captchaVerifying}
          type="button"
        >
          {isUploading ? "Uploading..." : "Upload files"}
        </button>
      }
    >
      {(data.brandLogoUrl || data.brandColor) && (
        <div
          className="mb-4 rounded-xl border bg-card/80 p-4"
          style={{ borderColor: data.brandColor || undefined }}
        >
          <div className="flex items-center gap-3">
            {data.brandLogoUrl ? (
              <Image
                src={data.brandLogoUrl}
                alt="Brand logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded-md object-contain bg-background"
                unoptimized
              />
            ) : null}
            <div className="text-sm text-muted-foreground">
              Uploaded files go directly to{" "}
              {data.owner.displayName || data.owner.username}.
            </div>
          </div>
        </div>
      )}
      {data.description ? (
        <div className="text-sm text-muted-foreground mb-3">
          {data.description}
        </div>
      ) : null}
      <div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border px-2 py-0.5">
          Views: <span className="font-medium">{data.viewsCount ?? 0}</span>
        </span>
        <span className="rounded-full border px-2 py-0.5">
          Uploads: <span className="font-medium">{data.uploadsCount ?? 0}</span>
          {data.maxUploads ? ` / ${data.maxUploads}` : ""}
        </span>
        {data.requiresApproval ? (
          <span className="rounded-full border px-2 py-0.5">
            Approval required
          </span>
        ) : null}
        {data.requiresPassword ? (
          <span className="rounded-full border px-2 py-0.5">
            Password protected
          </span>
        ) : null}
        {data.perUserUploadLimit ? (
          <span className="rounded-full border px-2 py-0.5">
            Per-user: {data.perUserUploadLimit}/{data.perUserWindowHours ?? 24}h
          </span>
        ) : null}
      </div>
      {data.requiresPassword && (
        <div className="mb-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password to upload"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
      )}
      {turnstileSiteKey && (
        <div className="mb-4">
          <TurnstileWidget
            key={`turnstile-${captchaKey}`}
            siteKey={turnstileSiteKey}
            onVerify={(token) => setCaptchaToken(token)}
            onExpire={() => setCaptchaToken("")}
            onError={() => setCaptchaToken("")}
          />
          {captchaVerifying && (
            <div className="mt-2 text-xs text-muted-foreground">
              Verifying captcha…
            </div>
          )}
        </div>
      )}
      <UploadDropzone
        maxUploadMb={data.limits.maxUploadMb}
        maxFilesPerUpload={data.limits.maxFilesPerUpload}
        remainingQuotaMb={null}
        filesRemaining={null}
        maxStorageMb={null}
        effectiveRemainingStorageMb={null}
        usedTodayBytes={0}
        usedStorageBytes={0}
        formatMbWhole={(mb) => `${Math.round(mb)} MB`}
        toMb={(bytes) => Math.round(bytes / 1_000_000)}
        onFileChange={onFileChange}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaste={onPaste}
        dropZoneRef={dropZoneRef}
      />

      <UploadQueue
        files={files}
        isUploading={isUploading}
        previewUrls={previewUrls}
        pendingCount={pendingCount}
        uploadedCount={uploadedCount}
        onEdit={() => {}}
        onRemove={handleRemove}
        onRetry={handleRetry}
      />
    </PageLayout>
  );
}
