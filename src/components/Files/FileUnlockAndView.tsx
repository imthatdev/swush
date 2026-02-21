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
import { IconLock, IconLockOpen } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ClientFileActions from "@/components/Files/ClientFileActions";
import { AudioWaveform } from "@/components/Files/AudioWaveform";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiV1 } from "@/lib/api-path";
import PublicOwnerHeader from "@/components/Common/PublicOwnerHeader";
import { formatBytes, isSpoilerLabel } from "@/lib/helpers";
import { SpoilerOverlay } from "@/components/Common/SpoilerOverlay";
import { registerAndHighlight } from "@/lib/code";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Video from "yet-another-react-lightbox/plugins/video";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import { isMedia, MediaKind } from "@/lib/mime-types";
import { FileCodeViewer } from "./FileCodeViewer";
import { StreamVideo } from "@/components/Files/StreamVideo";
import { loadAudioTrackMeta } from "@/lib/audio-metadata";
import type { AudioTrackMeta } from "@/types/player";

function hexToRgba(hex: string, alpha: number) {
  const cleaned = hex.replace("#", "").trim();
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : cleaned;
  if (normalized.length !== 6) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type FileDto = {
  id: string;
  userId?: string;
  ownerUsername?: string | null;
  ownerDisplayName?: string | null;
  ownerImage?: string | null;
  ownerBio?: string | null;
  ownerVerified?: boolean | null;
  anonymousShareEnabled?: boolean | null;
  hasPassword?: boolean;
  views?: number;
  slug: string;
  originalName: string;
  mimeType: string;
  size: number;
  description: string | null;
  createdAt: string;
  isPublic: boolean;
  tags: string[];
  folderId: string | null;
  folderName?: string | null;
  audioMeta?: AudioTrackMeta | null;
};

type Props = {
  slug: string;
  initialStatus: number;
  initialFile?: FileDto | null;
  initialError?: string;
  accentColor?: string | null;
};

export default function FileUnlockAndView({
  slug,
  initialStatus,
  initialFile,
  initialError,
  accentColor,
}: Props) {
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileTextLoading, setFileTextLoading] = useState(false);
  const codeRef = useRef<HTMLElement | null>(null);
  const [file, setFile] = useState<FileDto | null>(initialFile ?? null);
  const [open, setOpen] = useState(initialStatus === 403);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [audioMeta, setAudioMeta] = useState<AudioTrackMeta | null>(
    initialFile?.audioMeta ?? null,
  );
  const { prefs } = useUserPreferences();
  const anonFlag = file?.anonymousShareEnabled === true;
  const isPrivate =
    initialStatus === 403 &&
    typeof initialError === "string" &&
    initialError.toLowerCase().includes("private");

  const encodedSlug = file ? encodeURIComponent(file.slug) : "";
  const buildUrl = (base: string) => {
    const params = new URLSearchParams();
    if (password) params.set("p", password);
    const suffix = params.toString();
    return suffix ? `${base}?${suffix}` : base;
  };
  const viewUrl = file ? buildUrl(`/v/${encodedSlug}`) : "";
  const rawUrl = file ? buildUrl(`/x/${encodedSlug}`) : "";
  const hlsUrl = file ? buildUrl(`/hls/${encodedSlug}/index.m3u8`) : "";
  const downloadName = file?.originalName ?? "";
  const spoilerActive = Boolean(
    file &&
    ((Array.isArray(file.tags) && file.tags.some(isSpoilerLabel)) ||
      isSpoilerLabel(file.folderName)),
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cardStyle = useMemo(() => {
    if (!accentColor) return undefined;
    const start = hexToRgba(accentColor, 0.18) ?? "rgba(0,0,0,0.04)";
    const mid = hexToRgba(accentColor, 0.08) ?? "rgba(0,0,0,0.02)";
    return {
      borderColor: accentColor,
      background: `linear-gradient(135deg, ${start} 0%, ${mid} 55%, rgba(0,0,0,0) 100%)`,
    } as const;
  }, [accentColor]);

  const slides = useMemo<Slide[]>(() => {
    if (!file) return [];
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
  }, [file, rawUrl, hlsUrl]);

  const openLightbox = (e?: React.MouseEvent) => {
    if (
      !isMedia("image", file?.mimeType, file?.originalName) &&
      !isMedia("video", file?.mimeType, file?.originalName)
    )
      return;
    e?.stopPropagation();
    setLightboxOpen(true);
  };
  const closeLightbox = () => setLightboxOpen(false);

  const canLightbox =
    !!file &&
    (isMedia("image", file.mimeType, file.originalName) ||
      isMedia("video", file.mimeType, file.originalName));

  useEffect(() => {
    setImageLoaded(false);
    const current = imageRef.current;
    if (current?.complete) {
      setImageLoaded(true);
      return;
    }
    const raf = requestAnimationFrame(() => {
      const next = imageRef.current;
      if (next?.complete) setImageLoaded(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [rawUrl]);

  async function tryUnlock(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (!anonFlag) params.set("include", "owner");
      if (password) params.set("p", password);
      const res = await fetch(
        apiV1(`/files/${encodeURIComponent(slug)}?${params.toString()}`),
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch();
        setError(data?.message || "Invalid or missing password");
        setOpen(true);
        return;
      }
      const data = (await res.json()) as FileDto;
      setFile(data);
      setOpen(false);
    } catch (err) {
      setError((err as Error)?.message || "Something went wrong");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!file) return;
    (async () => {
      await fetch(apiV1(`/files/${encodeURIComponent(file?.slug)}/view`), {
        method: "PATCH",
      });
    })();
  }, [file]);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;
    fetch(hlsUrl, {
      method: "HEAD",
      cache: "no-store",
      redirect: "manual",
      credentials: "include",
    })
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        if (cancelled) return;
      })
      .finally(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [file, hlsUrl]);

  useEffect(() => {
    if (!file) return;
    if (!isMedia("text", file.mimeType, file.originalName)) {
      setFileText(null);
      return;
    }
    setFileTextLoading(true);
    fetch(rawUrl)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch file content");
        return await res.text();
      })
      .then((txt) => setFileText(txt))
      .catch(() => setFileText(null))
      .finally(() => setFileTextLoading(false));
  }, [file, rawUrl]);

  useEffect(() => {
    if (!file) return;
    if (!isMedia("audio", file.mimeType, file.originalName)) {
      setAudioMeta(null);
      return;
    }
    if (file.audioMeta) {
      setAudioMeta(file.audioMeta);
      return;
    }
    let active = true;
    loadAudioTrackMeta(file.slug, undefined, {
      password: password || undefined,
    }).then((meta) => {
      if (!active) return;
      if (meta) setAudioMeta(meta);
    });
    return () => {
      active = false;
    };
  }, [file, password, anonFlag]);

  useEffect(() => {
    if (!fileText || !codeRef.current) return;
    const ext = file?.originalName?.split(".").pop()?.toLowerCase() || "";
    let language = "plaintext";
    if (["js", "jsx"].includes(ext)) language = "javascript";
    else if (["ts", "tsx"].includes(ext)) language = "typescript";
    else if (["json"].includes(ext)) language = "json";
    else if (["css"].includes(ext)) language = "css";
    else if (["html", "htm"].includes(ext)) language = "xml";
    else if (["md", "markdown"].includes(ext)) language = "markdown";
    else if (["py"].includes(ext)) language = "python";
    else if (["sh", "bash", "zsh"].includes(ext)) language = "shell";
    else if (["c"].includes(ext)) language = "c";
    else if (["cpp", "cxx", "cc"].includes(ext)) language = "cpp";
    else if (["java"].includes(ext)) language = "java";
    else if (["env"].includes(ext)) language = "ini";
    codeRef.current.textContent = fileText;
    registerAndHighlight(codeRef.current, fileText, language).catch(() => {
      codeRef.current!.textContent = fileText;
      codeRef.current!.removeAttribute("data-highlighted");
    });
  }, [fileText, file]);

  if (!file) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="rounded-xl border bg-card p-6 text-center">
          <h2 className="text-xl font-semibold mb-2">
            {isPrivate ? "This file is private" : "This file is locked"}
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {isPrivate
              ? "The owner has not shared this file."
              : "Enter the password to view."}
          </p>
          {!isPrivate && <Button onClick={() => setOpen(true)}>Unlock</Button>}
        </div>

        {!isPrivate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enter password</DialogTitle>
                <DialogDescription>
                  This file is protected. Provide the password to unlock.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={tryUnlock} className="grid gap-3">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  required
                />
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Checking…" : "Unlock"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }

  const handleTogglePublic = async () => {
    try {
      const next = !file.isPublic;
      const res = await fetch(
        apiV1(`/files/${encodeURIComponent(file.slug)}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic: next }),
        },
      );
      if (res.ok) {
        setFile({ ...file, isPublic: next });
      } else {
        toast.error("Uh uh uhhh, you are not the owner!");
      }
    } catch {
      toast.error("Failed to update file visibility");
    }
  };

  return (
    <>
      <div className="w-full max-w-3xl overflow-hidden">
        <div
          className={`rounded-xl border shadow-sm p-4 ${accentColor ? "bg-transparent" : "bg-secondary"}`}
          style={cardStyle}
        >
          <h1 className="text-base md:text-xl font-semibold mb-2 text-center w-full break-all">
            {file.originalName}
          </h1>
          <span className="flex justify-center gap-2 items-center text-sm text-muted-foreground mb-6">
            <p>
              {formatBytes(file.size)} · {file.mimeType} · {file.views ?? 0}{" "}
              views
            </p>
            <div className="cursor-pointer" onClick={handleTogglePublic}>
              {!file.isPublic ? (
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-1 py-1 text-xs font-medium">
                    <IconLock size={14} />
                  </span>
                </div>
              ) : (
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-1 py-1 text-xs font-medium">
                    <IconLockOpen size={14} />
                  </span>
                </div>
              )}
            </div>
          </span>

          <div className="flex justify-center mb-6">
            <SpoilerOverlay
              active={spoilerActive}
              alwaysReveal={prefs.revealSpoilers}
              resetKey={file.slug}
            >
              {isMedia("image", file.mimeType, file.originalName) && (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    key={rawUrl}
                    src={rawUrl}
                    alt={file.originalName}
                    className={`max-h-[70vh] w-auto rounded-lg border transition-all duration-300 ${
                      imageLoaded
                        ? "blur-0 opacity-100 scale-100"
                        : "blur-sm opacity-80 scale-[1.01]"
                    }`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                </div>
              )}

              {isMedia("audio", file.mimeType, file.originalName) && (
                <div className="w-full max-w-3xl space-y-3">
                  <AudioWaveform
                    src={hlsUrl || rawUrl}
                    hlsSrc={hlsUrl}
                    isPublic={file.isPublic}
                    sizeBytes={file.size}
                    title={audioMeta?.title}
                    artist={audioMeta?.artist}
                    cover={audioMeta?.pictureDataUrl}
                    color={audioMeta?.gradient}
                  />
                </div>
              )}

              {isMedia("video", file.mimeType, file.originalName) && (
                <div className="w-full max-h-[70vh] aspect-video rounded-lg bg-black/30">
                  <StreamVideo
                    controls
                    preload="auto"
                    playsInline
                    className="h-full w-full rounded-lg"
                    src={rawUrl}
                    hlsSrc={hlsUrl}
                    lazy={false}
                  />
                </div>
              )}

              {isMedia("text", file.mimeType, file.originalName) ? (
                <FileCodeViewer
                  filename={file.originalName}
                  content={fileText}
                  loading={fileTextLoading}
                />
              ) : ["application", "pdf"].some((type) =>
                  isMedia(type as MediaKind, file.mimeType, file.originalName),
                ) ? (
                <iframe
                  src={rawUrl}
                  title={downloadName}
                  className="w-full h-[70vh] rounded-lg border"
                />
              ) : null}

              {!(
                [
                  "pdf",
                  "text",
                  "application",
                  "image",
                  "audio",
                  "video",
                ] as MediaKind[]
              ).some((type) =>
                isMedia(type, file.mimeType, file.originalName),
              ) && (
                <a
                  href={rawUrl}
                  className="underline text-primary hover:text-primary/80"
                >
                  Open file
                </a>
              )}
            </SpoilerOverlay>
          </div>

          <PublicOwnerHeader
            name={file?.ownerDisplayName || file?.ownerUsername}
            username={file?.ownerUsername}
            image={file?.ownerImage}
            bio={file?.ownerBio}
            verified={file?.ownerVerified}
            userId={file?.userId}
            label="Shared by"
            className="justify-center"
            avatarClassName="h-7 w-7"
            anonymous={anonFlag}
          />

          <div className="flex justify-center">
            <ClientFileActions
              viewUrl={viewUrl}
              rawUrl={rawUrl}
              downloadName={downloadName}
              password={password}
              onPreview={canLightbox ? () => openLightbox() : undefined}
              canPreview={canLightbox}
            />
          </div>
        </div>
      </div>
      <Lightbox
        open={lightboxOpen}
        close={closeLightbox}
        slides={slides}
        plugins={[Zoom, Video, Fullscreen]}
        carousel={{ finite: true }}
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
                  lazy={false}
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
    </>
  );
}
