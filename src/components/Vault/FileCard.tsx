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

"use client";

import {
  IconFolder,
  IconPin,
  IconPinFilled,
  IconStarFilled,
  IconTag,
  IconZoomScan,
} from "@tabler/icons-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload } from "@/types";
import {
  folderNameOf,
  formatBytes,
  formatTagLabel,
  isSpoilerFile,
} from "@/lib/helpers";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";
import VisibilityDialog from "../Dialogs/VisibilityDialog";
import { FileContextMenu } from "../Files/FileContextMenu";
import FilePreview from "./FilePreview";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Video from "yet-another-react-lightbox/plugins/video";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import { useMemo, useState } from "react";
import { isMedia } from "@/lib/mime-types";
import { StreamVideo } from "@/components/Files/StreamVideo";
import { Button } from "../ui/button";

interface VaultFileCardProps {
  file: Upload;
  index: number;
  selected?: boolean;
  enableCardSelection?: boolean;
  onToggle?: (e?: React.MouseEvent | React.KeyboardEvent) => void;
  revealSpoilers?: boolean;
  hidePreviews: boolean;
  openInNewTab?: boolean;
  hidePublicShareConfirmations?: boolean;
  sizeFormat?: "auto" | "bytes" | "metric";
  setItems: React.Dispatch<React.SetStateAction<Upload[]>>;
  isPinned?: boolean;
  pinFlash?: boolean;
  onTogglePin?: () => void;
  approval?: { requestId: string; itemId: string } | null;
  onApprove?: () => void;
  onReject?: () => void;
  approvalLoading?: boolean;
}

export default function FileCard({
  file,
  index,
  selected = false,
  enableCardSelection = false,
  onToggle,
  revealSpoilers = false,
  hidePreviews,
  openInNewTab = false,
  hidePublicShareConfirmations = false,
  sizeFormat = "auto",
  setItems,
  isPinned = false,
  pinFlash = false,
  onTogglePin,
  approval,
  onApprove,
  onReject,
  approvalLoading = false,
}: VaultFileCardProps) {
  const encodedSlug = encodeURIComponent(file.slug);
  const viewUrl = `/v/${encodedSlug}`;
  const rawUrl = `/x/${encodedSlug}`;
  const hlsUrl = `/hls/${encodedSlug}/index.m3u8`;
  const previewUrl = `/x/${encodedSlug}.png`;
  const date = file.createdAt ? new Date(file.createdAt) : null;

  const [lightboxOpen, setLightboxOpen] = useState(false);

  const spoiler = useMemo(() => isSpoilerFile(file), [file]);
  const slides = useMemo<Slide[]>(() => {
    if (isMedia("image", file.mimeType, file.originalName)) {
      return [{ src: rawUrl, alt: file.originalName }];
    }
    if (isMedia("video", file.mimeType, file.originalName)) {
      const sources = [
        hlsUrl
          ? {
              src: hlsUrl,
              type: "application/vnd.apple.mpegurl",
            }
          : null,
        {
          src: rawUrl,
          type: file.mimeType ?? "video/mp4",
        },
      ].filter(Boolean) as { src: string; type: string }[];
      return [
        {
          type: "video",
          sources,
        },
      ];
    }
    return [];
  }, [file.mimeType, file.originalName, rawUrl, hlsUrl]);

  const openLightbox = (e?: React.MouseEvent) => {
    if (enableCardSelection) return;
    e?.stopPropagation();
    setLightboxOpen(true);
  };
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const folderMeta = (
    file as Partial<{
      folder?: { name?: string | null; color?: string | null } | null;
    }>
  ).folder;
  const folderColor = folderMeta?.color ?? null;
  const tagItems = (
    (
      file as Partial<{
        tags?: (string | { name: string; color?: string | null })[];
      }>
    ).tags ?? []
  )
    .map((t) => (typeof t === "string" ? { name: t } : t))
    .filter((t) => t.name && t.name.trim().length > 0);

  return (
    <Card
      className={cn(
        "group relative transition-all gap-3 animate-fade-in-up h-full",
        selected &&
          "ring-2 ring-primary border-primary/70 bg-accent/30 shadow-sm",
      )}
      style={{ animationDelay: `${index * 100}ms` }}
      onClick={
        enableCardSelection
          ? (e) => {
              onToggle?.(e);
            }
          : undefined
      }
    >
      {approval ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-sm pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onApprove?.();
              }}
              disabled={approvalLoading}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReject?.();
              }}
              disabled={approvalLoading}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : null}
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <CardTitle className="flex-1 min-w-0 truncate">
            <Link
              href={viewUrl}
              className="hover:underline flex"
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noreferrer" : undefined}
              onClick={(e) => {
                if (enableCardSelection && onToggle) {
                  e.preventDefault();
                  onToggle(e);
                }
              }}
            >
              {file.originalName}
            </Link>
          </CardTitle>
          <div className="mt-3 flex items-center justify-between gap-1">
            <Button
              size="icon"
              variant={"ghost"}
              className={cn(pinFlash && "animate-wiggle")}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin?.();
              }}
              title={isPinned ? "Unpin" : "Pin"}
              aria-label={isPinned ? "Unpin" : "Pin"}
            >
              <div
                className={cn(
                  "p-2 rounded-md",
                  isPinned
                    ? "text-primary bg-accent"
                    : "text-muted-foreground bg-muted",
                )}
              >
                {isPinned ? (
                  <IconPinFilled className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <IconPin className="h-3.5 w-3.5" />
                )}
              </div>
            </Button>
            <div className="flex items-center gap-1">
              <VisibilityDialog
                file={file}
                setItems={setItems}
                skipConfirmation={hidePublicShareConfirmations}
              />
              <FileContextMenu
                file={file}
                onFileUpdated={(updated) =>
                  setItems((prev) =>
                    prev.map((f) =>
                      f.id === updated.id ? { ...f, ...updated } : f,
                    ),
                  )
                }
                onFileDeleted={(id) =>
                  setItems((prev) => prev.filter((f) => f.id !== id))
                }
              />
            </div>
          </div>
        </div>

        <p className="flex gap-1 items-center text-xs text-muted-foreground">
          {formatBytes(file.size, sizeFormat)} • {file.mimeType}
          {date ? ` • ${date.toLocaleDateString()}` : ""}
          {file.isFavorite && (
            <IconStarFilled
              size={13}
              className="text-yellow-400 shrink-0"
              title="Favorited"
            />
          )}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 h-full justify-between">
        <div>
          <div className="relative">
            <FilePreview
              mime={file.mimeType}
              src={rawUrl}
              hlsSrc={hlsUrl}
              previewSrc={previewUrl}
              name={file.originalName}
              slug={file.slug}
              isPublic={file.isPublic}
              sizeBytes={file.size}
              hide={hidePreviews}
              spoiler={spoiler}
              revealSpoilers={revealSpoilers}
              audioMeta={file.audioMeta ?? null}
              disablePreviewInteraction={enableCardSelection}
            />
            {(isMedia("image", file.mimeType, file.originalName) ||
              isMedia("video", file.mimeType, file.originalName)) && (
              <Button
                className="absolute right-[45%] top-1 z-10"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openLightbox();
                }}
                aria-label="Open preview"
              >
                <IconZoomScan size={14} className="text-primary" />
              </Button>
            )}
          </div>
        </div>

        {file.description ? (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {file.description}
          </p>
        ) : null}

        {(() => {
          const folder = folderNameOf(file);
          if (!folder && tagItems.length === 0) return null;
          const folderBadgeStyles = getBadgeColorStyles(folderColor);
          return (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {folder && (
                <Badge
                  className={cn(
                    "gap-1",
                    folderBadgeStyles?.className ?? "bg-primary",
                  )}
                  style={folderBadgeStyles?.style}
                >
                  <IconFolder size={12} /> {folder}
                </Badge>
              )}
              {tagItems.map((tag) => {
                const tagBadgeStyles = getBadgeColorStyles(tag.color);
                return (
                  <Badge
                    key={tag.name}
                    variant="outline"
                    className={cn("gap-1", tagBadgeStyles?.className)}
                    style={tagBadgeStyles?.style}
                  >
                    <IconTag size={12} /> {formatTagLabel(tag.name)}
                  </Badge>
                );
              })}
            </div>
          );
        })()}
        <div
          className={cn(
            "absolute left-2 top-2 z-10 transition-opacity duration-300",
            selected ? "opacity-100" : "md:opacity-0 group-hover:opacity-100",
          )}
        >
          <Checkbox
            checked={selected}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(e);
            }}
            className="rounded-full cursor-pointer"
            aria-label="Select file"
          />
        </div>
      </CardContent>

      <Lightbox
        open={lightboxOpen}
        close={closeLightbox}
        slides={slides}
        plugins={[Zoom, Video, Fullscreen]}
        carousel={{
          finite: true,
        }}
        render={{
          slide: ({ slide }) => {
            if (slide.type !== "video") return undefined;
            const sources =
              "sources" in slide && Array.isArray(slide.sources)
                ? slide.sources
                : [];
            const hlsSource = sources.find((s) =>
              s.type?.includes("application/vnd.apple.mpegurl"),
            );
            const rawSource =
              sources.find((s) => s.type?.startsWith("video/")) ?? sources[0];
            if (!rawSource) return null;
            return (
              <div className="flex h-full w-full items-center justify-center">
                <StreamVideo
                  src={rawSource.src}
                  hlsSrc={hlsSource?.src}
                  controls
                  playsInline
                  className="max-h-full max-w-full"
                />
              </div>
            );
          },
          buttonPrev: () => null,
          buttonNext: () => null,
        }}
        zoom={{
          maxZoomPixelRatio: 10,
          zoomInMultiplier: 1.5,
        }}
      />
    </Card>
  );
}
