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

import { IconFileUpload } from "@tabler/icons-react";
import type React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function UploadDropzone({
  maxUploadMb,
  maxFilesPerUpload,
  remainingQuotaMb,
  filesRemaining,
  maxStorageMb,
  effectiveRemainingStorageMb,
  usedTodayBytes,
  usedStorageBytes,
  formatMbWhole,
  toMb,
  disabled,
  onFileChange,
  onDragOver,
  onDrop,
  onPaste,
  dropZoneRef,
}: {
  maxUploadMb: number | null;
  maxFilesPerUpload: number | null;
  remainingQuotaMb: number | null;
  filesRemaining: number | null;
  maxStorageMb: number | null;
  effectiveRemainingStorageMb: number | null;
  usedTodayBytes: number;
  usedStorageBytes: number;
  formatMbWhole: (mb: number) => string;
  toMb: (bytes: number) => number;
  disabled?: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  dropZoneRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-8 text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors duration-300 ${
            disabled
              ? "opacity-60 cursor-not-allowed"
              : "hover:border-primary/80 cursor-pointer"
          }`}
          onClick={() =>
            disabled ? null : document.getElementById("fileInput")?.click()
          }
          onDragOver={disabled ? undefined : onDragOver}
          onDrop={disabled ? undefined : onDrop}
          onPaste={disabled ? undefined : onPaste}
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          ref={dropZoneRef}
        >
          <input
            id="fileInput"
            type="file"
            className="hidden"
            multiple
            disabled={disabled}
            onChange={onFileChange}
          />
          <IconFileUpload className="w-12 h-12 text-muted-foreground animate-pulse" />
          <p className="text-center text-sm">
            Drag and drop your files here or click to upload
          </p>
          <p className="text-[11px] text-muted-foreground/80">
            Tip: You can paste images directly from your clipboard.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-3 text-xs text-muted-foreground">
          {typeof maxUploadMb === "number" && maxUploadMb > 0 && (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Max per file
              </div>
              <div className="font-medium">{formatMbWhole(maxUploadMb)}</div>
            </div>
          )}

          {typeof maxFilesPerUpload === "number" && maxFilesPerUpload > 0 && (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Max files
              </div>
              <div className="font-medium">{maxFilesPerUpload}</div>
            </div>
          )}

          {typeof remainingQuotaMb === "number" && remainingQuotaMb >= 0 && (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Remaining today
              </div>
              <div className="font-medium">
                {formatMbWhole(remainingQuotaMb)}
              </div>
            </div>
          )}

          {filesRemaining !== undefined && filesRemaining !== null && (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Files left
              </div>
              <div className="font-medium">{filesRemaining}</div>
            </div>
          )}
          {filesRemaining === null && (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Files left
              </div>
              <div className="font-medium">∞</div>
            </div>
          )}
          {typeof maxStorageMb === "number" ? (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Storage
              </div>
              <div className="font-medium">
                {Math.round(effectiveRemainingStorageMb ?? 0)} /{" "}
                {Math.round(maxStorageMb)} MB
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Storage left
              </div>
              <div className="font-medium">∞</div>
            </div>
          )}
          {typeof usedTodayBytes === "number" && usedTodayBytes >= 0 && (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Today used
              </div>
              <div className="font-medium">{toMb(usedTodayBytes)} MB</div>
            </div>
          )}
          {typeof usedStorageBytes === "number" && usedStorageBytes >= 0 && (
            <div className="rounded-lg border bg-background/60 px-3 py-2">
              <div className="text-[10px] uppercase text-muted-foreground/70">
                Stored
              </div>
              <div className="font-medium">{toMb(usedStorageBytes)} MB</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
