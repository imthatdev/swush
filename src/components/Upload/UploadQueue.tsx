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

import {
  IconX,
  IconEdit,
  IconFileFilled,
  IconMusic,
  IconVideoFilled,
} from "@tabler/icons-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import CopyButton from "@/components/Common/CopyButton";
import ShareQrButton from "@/components/Common/ShareQrButton";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatBytes } from "@/lib/helpers";
import { formatTag } from "@/components/Upload/FolderInputWithSuggestions";
import type { UploadItem } from "@/components/Upload/types";

export default function UploadQueue({
  files,
  isUploading,
  previewUrls,
  pendingCount,
  uploadedCount,
  onEdit,
  onRemove,
  onRetry,
}: {
  files: UploadItem[];
  isUploading: boolean;
  previewUrls: Map<File, string>;
  pendingCount: number;
  uploadedCount: number;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onRetry: (index: number) => void;
}) {
  if (files.length === 0) return null;

  const getStatus = (item: UploadItem) => {
    if (item.uploaded) return "done" as const;
    if (item.error) return "failed" as const;
    if (isUploading) {
      if (typeof item.progress === "number" && item.progress >= 100) {
        return "processing" as const;
      }
      return "uploading" as const;
    }
    return "queued" as const;
  };

  const statusLabel: Record<ReturnType<typeof getStatus>, string> = {
    queued: "Queued",
    uploading: "Uploading",
    processing: "Processing",
    done: "Done",
    failed: "Failed",
  };

  const statusClass: Record<ReturnType<typeof getStatus>, string> = {
    queued: "bg-muted/60 text-muted-foreground",
    uploading: "bg-blue-500/15 text-blue-400",
    processing: "bg-amber-500/15 text-amber-400",
    done: "bg-emerald-500/15 text-emerald-400",
    failed: "bg-red-500/15 text-red-400",
  };

  return (
    <Card className="bg-card/70">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-sm">Upload queue</CardTitle>
          <CardDescription className="text-xs">
            Track progress and manage pending files.
          </CardDescription>
        </div>
        <CardAction>
          {files.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border px-2 py-0.5">
                Pending: <span className="font-medium">{pendingCount}</span>
              </span>
              <span className="rounded-full border px-2 py-0.5">
                Uploaded: <span className="font-medium">{uploadedCount}</span>
              </span>
            </div>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {files.map((f, index) =>
          (() => {
            const status = getStatus(f);
            const percent = Math.min(f.progress ?? 0, 100);
            const previewUrl = previewUrls.get(f.file);
            return (
              <div
                key={index}
                className="rounded-xl border border-muted bg-background/60 p-3 text-muted-foreground transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-2">
                    <div className="w-12 h-12 rounded-lg bg-muted/70 overflow-hidden flex items-center justify-center shrink-0">
                      {f.file.type.startsWith("image/") && previewUrl ? (
                        <Image
                          src={previewUrl}
                          alt="Preview"
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      ) : f.file.type.startsWith("audio/") ? (
                        <span className="text-lg">
                          <IconMusic className="h-6 w-6" />
                        </span>
                      ) : f.file.type.startsWith("video/") ? (
                        <span className="text-lg">
                          <IconVideoFilled className="h-6 w-6" />
                        </span>
                      ) : (
                        <span className="text-lg">
                          <IconFileFilled className="h-6 w-6" />
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(
                        typeof f.size === "number" ? f.size : f.file.size,
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 w-full min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-foreground/90 break-all">
                          {f.customName?.trim() || f.file.name}
                        </span>
                      </div>
                      <span
                        className={`text-[11px] rounded-full px-2 py-0.5 ${statusClass[status]}`}
                      >
                        {statusLabel[status]}
                      </span>
                    </div>

                    {(f.folderName || (f.tags && f.tags.length > 0)) && (
                      <div className="text-[11px] text-muted-foreground/80">
                        {f.folderName ? `📁 ${f.folderName}` : ""}{" "}
                        {f.tags && f.tags.length > 0
                          ? `🏷️ ${f.tags.map(formatTag).join(", ")}`
                          : ""}
                      </div>
                    )}

                    {isUploading && !f.uploaded && (
                      <div className="mt-1">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 mb-1">
                          <span>Uploading…</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-[width] duration-200 ease-out"
                            style={{ width: `${percent}%` }}
                            aria-valuenow={percent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            role="progressbar"
                          />
                        </div>
                      </div>
                    )}

                    {Boolean(f.error) && !isUploading && !f.uploaded && (
                      <div className="mt-1 flex items-center justify-between gap-2 rounded-md bg-red-500/10 px-2 py-1">
                        <div className="text-xs text-red-400 line-clamp-2">
                          {f.error}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry(index);
                          }}
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    {f.uploaded && (
                      <div className="mt-1 flex items-center justify-between gap-2 rounded-md bg-emerald-500/15 px-2 py-1">
                        <span className="text-emerald-300 text-xs font-medium">
                          Uploaded
                        </span>
                        {f.shareUrl && (
                          <div className="flex items-center gap-2">
                            <CopyButton
                              size="sm"
                              variant="secondary"
                              successMessage="Share link copied"
                              getText={() => f.shareUrl!}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              Copy link
                            </CopyButton>
                            <ShareQrButton
                              url={f.shareUrl}
                              label="QR"
                              variant="secondary"
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(index)}
                      aria-label="Edit"
                      disabled={isUploading || f.uploaded}
                    >
                      <IconEdit size={24} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onRemove(index)}
                      aria-label="Remove"
                      disabled={isUploading || f.uploaded}
                    >
                      <IconX className="text-red-600" size={24} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })(),
        )}
      </CardContent>
    </Card>
  );
}
