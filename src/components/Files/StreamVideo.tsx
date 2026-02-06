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

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { VideoHTMLAttributes } from "react";
import Hls from "hls.js";

type StreamVideoProps = VideoHTMLAttributes<HTMLVideoElement> & {
  src: string;
  hlsSrc?: string | null;
  lazy?: boolean;
};

export const StreamVideo = forwardRef<HTMLVideoElement, StreamVideoProps>(
  function StreamVideo(
    { src, hlsSrc, lazy = true, onError, onPointerDown, onClick, ...props },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const pendingPlayRef = useRef(false);
    const [loadRequested, setLoadRequested] = useState(
      !lazy || Boolean(props.autoPlay),
    );
    const [activeSrc, setActiveSrc] = useState<string | null>(() => {
      if (!loadRequested) return null;
      return hlsSrc ? null : src;
    });

    useEffect(() => {
      if (!lazy) setTimeout(() => setLoadRequested(true), 0);
    }, [lazy]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (!loadRequested) {
        setTimeout(() => setActiveSrc(null), 0);
        return;
      }

      let hls: Hls | null = null;
      let destroyed = false;

      const maybeAutoPlay = () => {
        if (props.autoPlay || pendingPlayRef.current) {
          pendingPlayRef.current = false;
          void video.play().catch(() => {});
        }
      };

      const fallbackToRaw = () => {
        if (destroyed) return;
        if (hls) {
          hls.destroy();
          hls = null;
        }
        setActiveSrc(src);
        setTimeout(maybeAutoPlay, 0);
      };

      if (hlsSrc) {
        if (Hls.isSupported()) {
          setTimeout(() => setActiveSrc(null), 0);
          hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90,
          });
          hls.loadSource(hlsSrc);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data?.fatal) {
              fallbackToRaw();
            }
          });
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            maybeAutoPlay();
          });
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          setTimeout(() => setActiveSrc(hlsSrc), 0);
          setTimeout(maybeAutoPlay, 0);
        } else {
          setTimeout(() => setActiveSrc(src), 0);
          setTimeout(maybeAutoPlay, 0);
        }
      } else {
        setTimeout(() => setActiveSrc(src), 0);
        setTimeout(maybeAutoPlay, 0);
      }

      return () => {
        destroyed = true;
        if (hls) hls.destroy();
      };
    }, [hlsSrc, src, props.autoPlay, loadRequested]);

    const handlePointerDown = (e: ReactPointerEvent<HTMLVideoElement>) => {
      if (!loadRequested) {
        pendingPlayRef.current = true;
        setLoadRequested(true);
      }
      onPointerDown?.(e);
    };

    const handleClick = (e: ReactMouseEvent<HTMLVideoElement>) => {
      if (!loadRequested) {
        pendingPlayRef.current = true;
        setLoadRequested(true);
      }
      onClick?.(e);
    };

    return (
      <video
        ref={(node) => {
          videoRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        src={activeSrc ?? undefined}
        controls
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        onError={(e) => {
          if (hlsSrc && activeSrc !== src) setActiveSrc(src);
          onError?.(e);
        }}
        {...props}
      />
    );
  },
);
