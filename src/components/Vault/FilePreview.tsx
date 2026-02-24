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
  IconFile,
  IconMusic,
  IconFileTypePdf,
  IconPhoto,
  IconFileText,
  IconVideo,
} from "@tabler/icons-react";
import { AudioWaveform } from "@/components/Files/AudioWaveform";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SpoilerOverlay } from "@/components/Common/SpoilerOverlay";
import { isMedia } from "@/lib/mime-types";
import { FileCodeViewer } from "@/components/Files/FileCodeViewer";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { StreamVideo } from "@/components/Files/StreamVideo";
import { loadAudioTrackMeta } from "@/lib/audio-metadata";
import { fetchSafeSameOrigin } from "@/lib/security/http-client";
import type { AudioTrackMeta } from "@/types/player";
import { useInView } from "@/hooks/use-in-view";

const audioMetaCache = new Map<string, AudioTrackMeta>();
const audioMetaPending = new Map<string, Promise<AudioTrackMeta | null>>();
const PREVIEW_BG =
  "bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),rgba(0,0,0,0.18)),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.22))]";

function extractSlugFromSrc(src?: string, hlsSrc?: string) {
  const base = hlsSrc ?? src ?? "";
  const match = /\/hls\/([^/]+)\//.exec(base) || /\/x\/([^/?#]+)/.exec(base);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function FileIcon({ mime }: { mime: string }) {
  let Icon = IconFile as typeof IconFile;
  if (mime.startsWith("image/")) Icon = IconPhoto;
  else if (mime.startsWith("video/")) Icon = IconVideo;
  else if (mime.startsWith("audio/")) Icon = IconMusic;
  else if (mime === "application/pdf") Icon = IconFileTypePdf;
  else if (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/javascript"
  )
    Icon = IconFileText;
  return (
    <div className="h-64 w-full grid place-items-center rounded-md border border-border bg-background">
      <Icon size={28} className="text-zinc-200" />
    </div>
  );
}

export function ImagePreview({
  src,
  previewSrc,
  name,
  mime,
}: {
  src: string;
  previewSrc?: string;
  name: string;
  mime: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [onHover, setOnHover] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);

  const previewCandidate =
    previewSrc ?? (mime.startsWith("image/gif") ? `${src}.png` : undefined);
  const staticSrc = useOriginal || !previewCandidate ? src : previewCandidate;

  useEffect(() => {
    setTimeout(() => {
      setLoaded(false);
      setErrored(false);
      setUseOriginal(false);
    }, 0);
  }, [src, previewSrc]);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 2000);
    return () => clearTimeout(t);
  }, [src, previewSrc]);

  if (errored) return <FileIcon mime={mime} />;

  return (
    <div
      className={cn(
        "relative h-64 w-full overflow-hidden rounded-md border border-border",
        PREVIEW_BG,
      )}
      onMouseEnter={() => setOnHover(true)}
      onMouseLeave={() => setOnHover(false)}
      onTouchStart={() => setOnHover(true)}
      onTouchEnd={() => setOnHover(false)}
    >
      <div
        className={`absolute inset-0 bg-muted/60 transition-opacity duration-300 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      {mime.startsWith("image/gif") ? (
        <>
          <div
            className={cn(
              "absolute inset-0 h-64 w-full transition-opacity duration-300 z-1",
              onHover ? "opacity-0" : "opacity-100",
            )}
          >
            <Image
              src={staticSrc}
              alt={name}
              fill
              className={`object-cover transition-all duration-300 ${
                loaded
                  ? "blur-0 opacity-100 scale-100"
                  : "blur-sm opacity-80 scale-[1.01]"
              }`}
              onLoad={() => setLoaded(true)}
              onError={() => {
                if (
                  !useOriginal &&
                  previewCandidate &&
                  previewCandidate !== src
                ) {
                  setUseOriginal(true);
                  setLoaded(false);
                  return;
                }
                setErrored(true);
                setLoaded(true);
              }}
              loading="lazy"
              unoptimized
              priority={false}
            />
          </div>
          <div
            className={cn(
              "absolute inset-0 h-64 w-full transition-opacity duration-300 z-2",
              onHover ? "opacity-100" : "opacity-0",
            )}
          >
            <Image
              src={src}
              alt={name}
              fill
              className={`object-cover transition-all duration-300 ${
                loaded
                  ? "blur-0 opacity-100 scale-100"
                  : "blur-sm opacity-80 scale-[1.01]"
              }`}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setErrored(true);
                setLoaded(true);
              }}
              loading="lazy"
              unoptimized
              priority={false}
            />
          </div>
        </>
      ) : (
        <div
          className={cn(
            "absolute inset-0 h-64 w-full transition-opacity duration-300",
          )}
        >
          <Image
            src={staticSrc}
            alt={name}
            fill
            className={`object-cover transition-all duration-300 ${
              loaded
                ? "blur-0 opacity-100 scale-100"
                : "blur-sm opacity-80 scale-[1.01]"
            }`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (
                !useOriginal &&
                previewCandidate &&
                previewCandidate !== src
              ) {
                setUseOriginal(true);
                setLoaded(false);
                return;
              }
              setErrored(true);
              setLoaded(true);
            }}
            unoptimized
            priority={false}
          />
        </div>
      )}
    </div>
  );
}

export function VideoPreview({
  src,
  hlsSrc,
  previewSrc,
  name,
  mime,
  disableInteraction = false,
}: {
  src: string;
  hlsSrc?: string;
  previewSrc?: string;
  name: string;
  mime: string;
  disableInteraction?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const [onHover, setOnHover] = useState(false);
  const [supportsHover, setSupportsHover] = useState(true);
  const [touchActive, setTouchActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 2500);
    return () => clearTimeout(t);
  }, [src]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: hover)");
    const update = () => setSupportsHover(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!disableInteraction) return;
    videoRef.current?.pause();
  }, [disableInteraction]);

  if (errored) return <FileIcon mime={mime} />;

  const showVideo = disableInteraction
    ? false
    : supportsHover
      ? onHover || isPlaying
      : touchActive || isPlaying;

  return (
    <div
      className={cn(
        "relative h-64 w-full overflow-hidden rounded-md border border-border",
        PREVIEW_BG,
      )}
      onMouseEnter={() => {
        if (disableInteraction) return;
        if (supportsHover) setOnHover(true);
      }}
      onMouseLeave={() => {
        if (disableInteraction) return;
        if (supportsHover) setOnHover(false);
      }}
    >
      <div
        className={`absolute inset-0 bg-muted/60 transition-opacity duration-300 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      <div
        className={cn(
          "absolute inset-0 h-64 w-full transition-opacity duration-300 z-1",
          showVideo ? "opacity-0" : "opacity-100",
        )}
        role={supportsHover ? undefined : "button"}
        aria-label={supportsHover ? undefined : "Play video preview"}
        tabIndex={supportsHover ? -1 : 0}
        onClick={() => {
          if (disableInteraction) return;
          if (supportsHover) return;
          setTouchActive(true);
          const video = videoRef.current;
          if (video) {
            void video.play().catch(() => setTouchActive(false));
          }
        }}
        onKeyDown={(e) => {
          if (disableInteraction) return;
          if (supportsHover) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setTouchActive(true);
            const video = videoRef.current;
            if (video) {
              void video.play().catch(() => setTouchActive(false));
            }
          }
        }}
      >
        <ImagePreview
          src={previewSrc ?? `${src}.png`}
          name={name}
          mime={mime}
        />
      </div>
      <div
        className={cn(
          "absolute inset-0 h-64 w-full transition-opacity duration-300 z-2",
          showVideo ? "opacity-100" : "opacity-0",
          showVideo ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <StreamVideo
          className="h-64 w-full object-cover"
          src={src}
          hlsSrc={hlsSrc}
          lazy={!showVideo}
          muted
          controls={!disableInteraction}
          playsInline
          preload="metadata"
          ref={videoRef}
          onLoadedData={() => setLoaded(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            if (!supportsHover) setTouchActive(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (!supportsHover) setTouchActive(false);
          }}
          onError={() => {
            setErrored(true);
            setLoaded(true);
          }}
        />
      </div>
    </div>
  );
}

function IframePreview({
  src,
  name,
  mime,
  className,
  style,
}: {
  src: string;
  name: string;
  mime: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 2500);
    return () => clearTimeout(t);
  }, [src]);

  if (errored) return <FileIcon mime={mime} />;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md border border-border",
        PREVIEW_BG,
      )}
    >
      <div
        className={`absolute inset-0 bg-muted/60 transition-opacity duration-300 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      <iframe
        src={src}
        title={name}
        className={`w-full ${className ?? ""}`.trim()}
        style={style}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setErrored(true);
          setLoaded(true);
        }}
      />
    </div>
  );
}

export default function FilePreview({
  mime,
  src,
  hlsSrc,
  previewSrc,
  name,
  slug,
  isPublic,
  sizeBytes,
  hide,
  spoiler,
  revealSpoilers,
  audioMeta: audioMetaProp,
  disablePreviewInteraction = false,
}: {
  mime: string;
  src: string;
  hlsSrc?: string;
  previewSrc?: string;
  name: string;
  slug?: string;
  isPublic?: boolean;
  sizeBytes?: number;
  hide?: boolean;
  spoiler?: boolean;
  revealSpoilers?: boolean;
  audioMeta?: AudioTrackMeta | null;
  disablePreviewInteraction?: boolean;
}) {
  const [audioMeta, setAudioMeta] = useState<AudioTrackMeta | null>(
    audioMetaProp ?? null,
  );
  const { ref, inView } = useInView<HTMLDivElement>();
  const isText = isMedia("text", mime, name);
  function useFileText(src: string, enabled: boolean) {
    const [text, setText] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    useEffect(() => {
      if (!enabled || !src) return;
      setLoading(true);
      fetchSafeSameOrigin(src)
        .then(async (res) => {
          if (!res.ok) throw new Error("Failed to fetch file content");
          return await res.text();
        })
        .then(setText)
        .catch(() => setText(null))
        .finally(() => setLoading(false));
    }, [src, enabled]);
    return { text, loading };
  }

  const { text, loading } = useFileText(src, Boolean(inView && isText));
  const audioSlug = slug ?? extractSlugFromSrc(src, hlsSrc);

  useEffect(() => {
    setAudioMeta(audioMetaProp ?? null);
    if (audioSlug && audioMetaProp) {
      audioMetaCache.set(audioSlug, audioMetaProp);
    }
  }, [audioMetaProp, audioSlug]);

  useEffect(() => {
    if (!inView) return;
    if (!isMedia("audio", mime, name) || !audioSlug) return;
    if (audioMetaProp) return;
    if (audioMetaCache.has(audioSlug)) {
      setAudioMeta(audioMetaCache.get(audioSlug) ?? null);
      return;
    }
    let active = true;
    const pending = audioMetaPending.get(audioSlug);
    if (pending) {
      pending.then((meta) => {
        if (!active) return;
        if (meta) setAudioMeta(meta);
      });
      return () => {
        active = false;
      };
    }
    const promise = loadAudioTrackMeta(audioSlug).then((meta) => {
      if (meta) audioMetaCache.set(audioSlug, meta);
      audioMetaPending.delete(audioSlug);
      return meta;
    });
    audioMetaPending.set(audioSlug, promise);
    promise.then((meta) => {
      if (!active) return;
      if (meta) setAudioMeta(meta);
    });
    return () => {
      active = false;
    };
  }, [audioSlug, mime, name, audioMetaProp, inView]);

  if (hide) {
    return <FileIcon mime={mime} />;
  }
  if (!src) {
    return <FileIcon mime={mime} />;
  }
  let content: React.ReactNode = null;
  if (isMedia("image", mime, name)) {
    content = (
      <ImagePreview
        key={src}
        src={src}
        previewSrc={previewSrc}
        name={name}
        mime={mime}
      />
    );
  } else if (isMedia("video", mime, name)) {
    content = (
      <VideoPreview
        key={src}
        src={src}
        hlsSrc={hlsSrc}
        previewSrc={previewSrc}
        name={name}
        mime={mime}
        disableInteraction={disablePreviewInteraction}
      />
    );
  } else if (mime === "application/pdf") {
    content = (
      <IframePreview
        key={src}
        src={src}
        name={name}
        mime={mime}
        style={{ height: "40vh", border: "none" }}
      />
    );
  } else if (isMedia("audio", mime, name)) {
    const cover = audioMeta?.pictureDataUrl;
    const title = audioMeta?.title;
    const artist = audioMeta?.artist;
    const album = audioMeta?.album;
    const color = audioMeta?.gradient;
    content = (
      <div className="space-y-2">
        <AudioWaveform
          src={hlsSrc ?? src}
          hlsSrc={hlsSrc}
          isPublic={isPublic ?? false}
          sizeBytes={sizeBytes}
          cover={cover}
          artist={artist}
          title={title}
          album={album}
          color={color}
        />
      </div>
    );
  } else if (isMedia("text", mime, name)) {
    content = (
      <FileCodeViewer filename={name} content={text} loading={loading} />
    );
  } else {
    content = (
      <div className="h-64 w-full grid place-items-center rounded-md border border-border bg-background">
        <IconFile size={28} className="text-zinc-200" />
      </div>
    );
  }

  return (
    <div ref={ref}>
      <SpoilerOverlay
        active={Boolean(spoiler)}
        alwaysReveal={Boolean(revealSpoilers)}
        resetKey={src}
      >
        {inView ? content : <FileIcon mime={mime} />}
      </SpoilerOverlay>
    </div>
  );
}
