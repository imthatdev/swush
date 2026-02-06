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
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
  IconRepeat,
  IconPlayerStop,
  IconVolume2,
  IconVolumeOff,
  IconPointFilled,
  IconMusic,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import Hls from "hls.js";
import { cn } from "@/lib/utils";
import { registerAudioGraph } from "@/lib/audio-graph";

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const total = Math.floor(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      seconds,
    ).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export function AudioWaveform({
  src,
  hlsSrc,
  rawSrc,
  lazy = true,
  isPublic,
  title,
  artist,
  cover,
  color,
  album,
  autoPlay,
  initialLoop,
  onEnded,
  externalControlsRef,
  onPlayStateChange,
  onTime,
  onAudioEl,
  volume: controlledVolume,
  muted: controlledMuted,
  onVolumeChange,
}: {
  src: string;
  hlsSrc?: string | null;
  rawSrc?: string | null;
  lazy?: boolean;
  isPublic: boolean;
  title?: string;
  artist?: string;
  cover?: string;
  album?: string;
  color?: string;
  sizeBytes?: number;
  streamThresholdBytes?: number;
  autoPlay?: boolean;
  initialLoop?: boolean;
  onEnded?: () => void;
  externalControlsRef?: RefObject<{
    play: () => void;
    pause: () => void;
    toggle: () => void;
    isPlaying: () => boolean;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (fraction: number) => void;
  } | null>;
  onPlayStateChange?: (playing: boolean) => void;
  onTime?: (currentTime: number, duration: number) => void;
  onAudioEl?: (el: HTMLAudioElement | null) => void;
  volume?: number;
  muted?: boolean;
  onVolumeChange?: (volume: number, muted: boolean) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<
    MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null
  >(null);
  const audioGainRef = useRef<GainNode | null>(null);
  const useGainRef = useRef(false);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const playRequestRef = useRef<Promise<void> | null>(null);
  const playIntentRef = useRef(false);
  const lastSrcRef = useRef<string | null>(null);
  const onAudioElRef = useRef(onAudioEl);
  const onEndedRef = useRef(onEnded);
  const onPlayStateChangeRef = useRef(onPlayStateChange);
  const onTimeRef = useRef(onTime);
  const onVolumeChangeRef = useRef(onVolumeChange);
  const pendingPlayRef = useRef(false);
  const fallbackSrc = rawSrc ?? (hlsSrc ? null : (src ?? null));
  const [loadRequested, setLoadRequested] = useState(
    !lazy || Boolean(autoPlay),
  );
  const sourceKey = loadRequested ? (hlsSrc ?? src ?? "") : "";
  const [activeSrc, setActiveSrc] = useState<string | null>(
    loadRequested ? (hlsSrc ?? fallbackSrc) : null,
  );
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [loop, setLoop] = useState(initialLoop ?? false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [readyState, setReadyState] = useState(0);
  const canPlay = isReady || readyState >= 2;
  const canStart = Boolean(hlsSrc || activeSrc || src);
  const isVolumeControlled = typeof controlledVolume === "number";
  const isMutedControlled = typeof controlledMuted === "boolean";
  const effectiveVolume = isVolumeControlled
    ? Math.min(1, Math.max(0, controlledVolume))
    : volume;
  const effectiveMuted = isMutedControlled ? controlledMuted : muted;
  const isIOS =
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.userAgent.includes("Mac") &&
        typeof document !== "undefined" &&
        "ontouchend" in document));

  const cleanupAudioGraph = (audio: HTMLMediaElement | null) => {
    if (!audio) return;
    useGainRef.current = false;
    audioGainRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioCtxRef.current?.close().catch(() => null);
    audioGainRef.current = null;
    audioSourceRef.current = null;
    audioCtxRef.current = null;
    registerAudioGraph(audio, null);
  };

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audioGainRef.current || audioCtxRef.current) return;
    const setupGain = (
      ctx: AudioContext,
      source: MediaElementAudioSourceNode | MediaStreamAudioSourceNode,
    ) => {
      const gain = ctx.createGain();
      source.connect(gain);
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      audioSourceRef.current = source;
      audioGainRef.current = gain;
      useGainRef.current = true;
      setVolumeDataset(effectiveMuted ? 0 : effectiveVolume, effectiveMuted);
      registerAudioGraph(audio, { ctx, source, gain });
    };

    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      setupGain(ctx, source);
      return;
    } catch {
      try {
        type Captureable = HTMLMediaElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        };
        const capEl = audio as Captureable;
        const captureFn = capEl.captureStream ?? capEl.mozCaptureStream;
        const stream =
          typeof captureFn === "function" ? captureFn.call(capEl) : null;
        if (!stream) return;
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        setupGain(ctx, source);
      } catch {
        // Fallback to native volume control.
      }
    }
  }, [effectiveMuted, effectiveVolume]);

  const setVolumeDataset = (nextVolume: number, nextMuted: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.dataset.swushVolumeMode = useGainRef.current ? "gain" : "native";
    audio.dataset.swushVolume = String(Math.min(1, Math.max(0, nextVolume)));
    audio.dataset.swushMuted = nextMuted ? "1" : "0";
  };

  useEffect(() => {
    if (!lazy) setLoadRequested(true);
  }, [lazy]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!loadRequested) {
      setActiveSrc(null);
      return;
    }

    let hls: Hls | null = null;
    let destroyed = false;

    const maybeAutoPlay = () => {
      if (autoPlay || pendingPlayRef.current) {
        pendingPlayRef.current = false;
        void audio.play().catch(() => {});
      }
    };

    const fallbackToRaw = () => {
      if (destroyed) return;
      if (hls) {
        hls.destroy();
        hls = null;
      }
      setActiveSrc(fallbackSrc);
      maybeAutoPlay();
    };

    if (hlsSrc) {
      if (Hls.isSupported()) {
        setActiveSrc(null);
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90,
        });
        hls.loadSource(hlsSrc);
        hls.attachMedia(audio);
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data?.fatal) {
            fallbackToRaw();
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          maybeAutoPlay();
        });
      } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        setActiveSrc(hlsSrc);
        maybeAutoPlay();
      } else {
        setActiveSrc(fallbackSrc);
        maybeAutoPlay();
      }
    } else {
      setActiveSrc(fallbackSrc);
      maybeAutoPlay();
    }

    return () => {
      destroyed = true;
      if (hls) hls.destroy();
    };
  }, [autoPlay, fallbackSrc, hlsSrc, loadRequested]);

  useEffect(() => {
    onAudioElRef.current = onAudioEl;
    onEndedRef.current = onEnded;
    onPlayStateChangeRef.current = onPlayStateChange;
    onTimeRef.current = onTime;
    onVolumeChangeRef.current = onVolumeChange;
  }, [onAudioEl, onEnded, onPlayStateChange, onTime, onVolumeChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.preload = "metadata";
    audio.loop = Boolean(initialLoop);
    onAudioElRef.current?.(audio);

    const updateBuffered = () => {
      try {
        if (!audio.duration || audio.buffered.length === 0) {
          setBufferedEnd(0);
          return;
        }
        const end = audio.buffered.end(audio.buffered.length - 1);
        setBufferedEnd(Number.isFinite(end) ? end : 0);
      } catch {
        setBufferedEnd(0);
      }
    };

    const emitTime = () => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      const c = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      setDuration(d);
      setCurrentTime(c);
      onTimeRef.current?.(c, d);
    };

    const onLoadStart = () => {
      setIsReady(false);
      setCurrentTime(0);
      setDuration(0);
      setBufferedEnd(0);
      setBuffering(playIntentRef.current);
      setReadyState(audio.readyState);
    };

    const onReady = () => {
      setIsReady(true);
      setReadyState(audio.readyState);
      emitTime();
      updateBuffered();
      setBuffering(false);
    };
    const onPlay = () => {
      setIsPlaying(true);
      setBuffering(false);
      playRequestRef.current = null;
      playIntentRef.current = false;
      onPlayStateChangeRef.current?.(true);
    };
    const onPause = () => {
      setIsPlaying(false);
      setBuffering(false);
      playRequestRef.current = null;
      playIntentRef.current = false;
      onPlayStateChangeRef.current?.(false);
      audioCtxRef.current?.resume?.().catch(() => null);
    };
    const onEndedHandler = () => {
      setIsPlaying(false);
      onPlayStateChangeRef.current?.(false);
      playIntentRef.current = false;
      onEndedRef.current?.();
    };
    const onWaiting = () => {
      if (!audio.paused || playIntentRef.current) setBuffering(true);
    };
    const onPlaying = () => {
      setBuffering(false);
      playIntentRef.current = false;
    };
    const onProgress = () => updateBuffered();
    const onVolumeChange = () => {
      const datasetVolume = Number(audio.dataset.swushVolume ?? "");
      const datasetMuted = audio.dataset.swushMuted === "1";
      const hasDatasetVolume = Number.isFinite(datasetVolume);
      const nextVolume =
        useGainRef.current && hasDatasetVolume
          ? datasetVolume
          : Number.isFinite(audio.volume)
            ? audio.volume
            : 0;
      const nextMuted =
        useGainRef.current && audio.dataset.swushMuted
          ? datasetMuted
          : Boolean(audio.muted);
      if (!isVolumeControlled) setVolume(nextVolume);
      if (!isMutedControlled) setMuted(nextMuted);
      if (!isVolumeControlled || !isMutedControlled) {
        onVolumeChangeRef.current?.(nextVolume, nextMuted);
      }
    };

    if (lastSrcRef.current !== sourceKey) {
      lastSrcRef.current = sourceKey;
      if (!playIntentRef.current) {
        audio.load();
      }
    }

    const onReadyStateChange = () => setReadyState(audio.readyState);

    audio.addEventListener("loadstart", onLoadStart);
    audio.addEventListener("loadedmetadata", onReady);
    audio.addEventListener("loadeddata", onReady);
    audio.addEventListener("canplay", onReady);
    audio.addEventListener("canplaythrough", onReady);
    audio.addEventListener("readystatechange", onReadyStateChange);
    audio.addEventListener("timeupdate", emitTime);
    audio.addEventListener("durationchange", emitTime);
    audio.addEventListener("progress", onProgress);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEndedHandler);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("volumechange", onVolumeChange);
    audio.addEventListener("play", onPlay);

    if (autoPlay) {
      playIntentRef.current = true;
      const p = audio.play();
      if (p && typeof p.then === "function") {
        playRequestRef.current = p;
        p.catch(() => {
          setBuffering(false);
          playIntentRef.current = false;
          playRequestRef.current = null;
        });
      }
    }

    return () => {
      audio.removeEventListener("loadstart", onLoadStart);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("loadeddata", onReady);
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("canplaythrough", onReady);
      audio.removeEventListener("readystatechange", onReadyStateChange);
      audio.removeEventListener("timeupdate", emitTime);
      audio.removeEventListener("durationchange", emitTime);
      audio.removeEventListener("progress", onProgress);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEndedHandler);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("volumechange", onVolumeChange);
      audio.removeEventListener("play", onPlay);
      onAudioElRef.current?.(null);
    };
  }, [
    autoPlay,
    initialLoop,
    isMutedControlled,
    isVolumeControlled,
    src,
    sourceKey,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.loop = loop;
  }, [loop]);

  useEffect(() => {
    ensureAudioGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  useEffect(() => {
    const audioEl = audioRef.current;
    return () => cleanupAudioGraph(audioEl);
  }, []);

  useEffect(() => {
    setVolumeDataset(effectiveMuted ? 0 : effectiveVolume, effectiveMuted);
  }, [effectiveMuted, effectiveVolume]);

  useEffect(() => {
    if (isVolumeControlled) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (useGainRef.current && audioGainRef.current) {
      audio.volume = 1;
      audio.muted = false;
      audioGainRef.current.gain.value = Math.min(1, Math.max(0, volume));
      setVolumeDataset(volume, false);
      return;
    }
    audio.volume = volume;
    setVolumeDataset(volume, audio.muted);
  }, [isVolumeControlled, volume]);

  useEffect(() => {
    if (!isVolumeControlled && !isMutedControlled) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (isVolumeControlled) {
      if (useGainRef.current && audioGainRef.current) {
        audio.volume = 1;
        audio.muted = false;
        audioGainRef.current.gain.value = Math.min(
          1,
          Math.max(0, controlledVolume ?? 0),
        );
        setVolumeDataset(controlledVolume ?? 0, Boolean(controlledMuted));
      } else {
        audio.volume = Math.min(1, Math.max(0, controlledVolume ?? 0));
      }
    }
    if (isMutedControlled) {
      if (useGainRef.current && audioGainRef.current) {
        audio.muted = false;
        audioGainRef.current.gain.value = Boolean(controlledMuted)
          ? 0
          : Math.min(1, Math.max(0, controlledVolume ?? volume ?? 0));
        setVolumeDataset(
          controlledMuted ? 0 : (controlledVolume ?? volume ?? 0),
          Boolean(controlledMuted),
        );
      } else {
        audio.muted = Boolean(controlledMuted);
      }
    }
  }, [
    controlledVolume,
    controlledMuted,
    isVolumeControlled,
    isMutedControlled,
    volume,
  ]);

  useEffect(() => {
    if (isMutedControlled) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (useGainRef.current && audioGainRef.current) {
      audio.muted = false;
      audioGainRef.current.gain.value = muted
        ? 0
        : Math.min(1, Math.max(0, volume));
      setVolumeDataset(muted ? 0 : volume, muted);
      return;
    }
    audio.muted = muted;
    setVolumeDataset(volume, muted);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMutedControlled, muted]);

  const requestPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    ensureAudioGraph();
    audioCtxRef.current?.resume?.().catch(() => null);
    if (!loadRequested) {
      pendingPlayRef.current = true;
      setLoadRequested(true);
      setBuffering(true);
      return;
    }
    if (audio.paused) {
      if (playRequestRef.current) return;
      playIntentRef.current = true;
      setBuffering(true);
      const p = audio.play();
      if (p && typeof p.then === "function") {
        playRequestRef.current = p;
        p.catch(() => {
          setBuffering(false);
          playIntentRef.current = false;
          playRequestRef.current = null;
        });
      }
    }
  }, [loadRequested, ensureAudioGraph]);

  const requestPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    playIntentRef.current = false;
    audio.pause();
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      requestPlay();
    } else {
      requestPause();
    }
  }, [requestPause, requestPlay]);

  useEffect(() => {
    if (!externalControlsRef) return;
    externalControlsRef.current = {
      play: requestPlay,
      pause: requestPause,
      toggle: togglePlay,
      isPlaying: () => !(audioRef.current?.paused ?? true),
      getCurrentTime: () => audioRef.current?.currentTime ?? 0,
      getDuration: () => audioRef.current?.duration ?? 0,
      seekTo: (fraction: number) => {
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        const clamped = Math.min(1, Math.max(0, fraction));
        audio.currentTime = clamped * audio.duration;
      },
    };
    return () => {
      if (externalControlsRef) externalControlsRef.current = null;
    };
  }, [externalControlsRef, requestPause, requestPlay, togglePlay]);

  const progress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  }, [currentTime, duration]);

  const bufferProgress = useMemo(() => {
    if (!duration) return 0;
    return Math.min(100, Math.max(0, (bufferedEnd / duration) * 100));
  }, [bufferedEnd, duration]);

  const stop = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !effectiveMuted;
    if (isMutedControlled) {
      onVolumeChangeRef.current?.(effectiveVolume, next);
      return;
    }
    if (useGainRef.current && audioGainRef.current) {
      audio.muted = false;
      audioGainRef.current.gain.value = next
        ? 0
        : Math.min(1, Math.max(0, effectiveVolume));
      setVolumeDataset(next ? 0 : effectiveVolume, next);
    } else {
      audio.muted = next;
    }
    setMuted(next);
    onVolumeChangeRef.current?.(effectiveVolume, next);
  };

  const toggleLoop = () => {
    setLoop((prev) => !prev);
  };

  const changeVolume = (vals: number[]) => {
    const v = Math.min(1, Math.max(0, vals[0] ?? 0));
    if (isVolumeControlled || isMutedControlled) {
      const nextMuted = v > 0 ? false : effectiveMuted;
      onVolumeChangeRef.current?.(v, nextMuted);
      return;
    }
    setVolume(v);
    if (!audioRef.current) return;
    let nextMuted = effectiveMuted;
    if (useGainRef.current && audioGainRef.current) {
      audioRef.current.volume = 1;
      audioRef.current.muted = false;
      audioGainRef.current.gain.value = v;
      nextMuted = v === 0 ? true : false;
      setVolumeDataset(v, nextMuted);
    } else {
      audioRef.current.volume = v;
    }
    if (effectiveMuted && v > 0) {
      if (!useGainRef.current) audioRef.current.muted = false;
      setMuted(false);
      nextMuted = false;
    }
    onVolumeChangeRef.current?.(v, nextMuted);
  };

  const seekFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = progressRef.current?.getBoundingClientRect();
    const audio = audioRef.current;
    if (!rect || !audio || !duration) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    const clamped = Math.min(1, Math.max(0, ratio));
    audio.currentTime = clamped * duration;
  };

  return (
    <div className="w-full">
      <audio
        ref={audioRef}
        src={activeSrc ?? undefined}
        playsInline
        onError={() => {
          if (hlsSrc && activeSrc !== fallbackSrc) setActiveSrc(fallbackSrc);
        }}
      />
      <div
        className={cn("w-full rounded-md border bg-secondary p-3")}
        style={{
          background: color,
        }}
      >
        {(title || artist || cover) && (
          <div className="mb-2 animate-fade-in-down">
            <div className="flex gap-2 items-center">
              <div className="h-13 w-13">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover ?? ""}
                    alt={title}
                    className="rounded-lg object-cover border border-border/60 bg-background/80 shadow-sm"
                  />
                ) : (
                  <IconMusic className="h-13 w-13" />
                )}
              </div>
              <div className="flex-1 flex-col gap-2 overflow-hidden">
                {title && (
                  <div
                    className="text-base font-semibold wrap-break-word"
                    title={title}
                  >
                    {title}
                  </div>
                )}
                {artist && (
                  <div
                    className="text-sm text-muted-foreground wrap-break-word"
                    title={artist}
                  >
                    {artist ? `by ${artist}` : null}
                    {artist && album ? " • " : null}
                    {album ?? null}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-2">
          <span className="tabular-nums flex items-center gap-2">
            {formatTime(currentTime)}
            <IconPointFilled
              className={cn(
                "",
                !loadRequested
                  ? "text-gray-600"
                  : buffering
                    ? "text-orange-400 animate-pulse"
                    : canPlay
                      ? "text-green-500 animate-pulse"
                      : "text-primary",
              )}
            />
          </span>
          <span className="tabular-nums">{formatTime(duration)}</span>
        </div>
        <div
          ref={progressRef}
          className="relative h-3 w-full rounded-full bg-linear-to-r from-background/80 to-background/80 ring-1 ring-primary/40 overflow-hidden cursor-pointer"
          onClick={seekFromEvent}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={currentTime || 0}
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary/60"
            style={{ width: `${bufferProgress}%` }}
          />
          <div
            className={`absolute inset-y-0 left-0 ${
              isPublic
                ? "bg-linear-to-r from-green-500/80 via-green-600/80 to-green-600"
                : "bg-linear-to-r from-primary/70 via-primary/80 to-primary"
            }`}
            style={{ width: `${progress}%` }}
          />
          <div
            className={`absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-zinc-900 ${
              isPublic
                ? "bg-green-500 shadow-[0_0_12px_rgba(72,219,149,0.55)]"
                : "bg-primary shadow-[0_0_12px_rgba(218,178,255,0.6)]"
            }`}
            style={{
              left: `calc(${Math.min(100, Math.max(0, progress))}% - 6px)`,
            }}
          />
        </div>
        <div className="mt-2 text-xs text-muted-foreground/75">
          <span className="inline-flex items-center gap-2 transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-1">
            {!loadRequested
              ? "Press play to load audio..."
              : buffering
                ? "Buffering..."
                : canPlay
                  ? "Ready"
                  : "Loading audio..."}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:items-center sm:justify-between">
        {!isIOS && (
          <div className="flex items-center gap-2 w-full overflow-x-hidden">
            <Slider
              value={[effectiveMuted ? 0 : effectiveVolume]}
              max={1}
              step={0.01}
              onValueChange={changeVolume}
              className="flex-1"
              aria-label="Volume"
            />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {Math.round((effectiveMuted ? 0 : effectiveVolume) * 100)}%
            </span>
          </div>
        )}

        <div
          className={cn(
            "grid items-center gap-2 w-full",
            isIOS ? "grid-cols-3" : "grid-cols-4",
          )}
        >
          <Button
            variant="default"
            onClick={togglePlay}
            disabled={!canStart}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {buffering && !isPlaying ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <IconPlayerPause className="h-4 w-4" />
            ) : (
              <IconPlayerPlay className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            onClick={stop}
            disabled={!canPlay}
            aria-label="Stop"
          >
            <IconPlayerStop className="h-4 w-4" />
          </Button>
          {!isIOS && (
            <Button
              variant="secondary"
              onClick={toggleMute}
              disabled={!canPlay}
              aria-label={effectiveMuted ? "Unmute" : "Mute"}
            >
              {effectiveMuted ? (
                <IconVolumeOff className="h-4 w-4" />
              ) : (
                <IconVolume2 className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={toggleLoop}
            disabled={!canPlay}
            aria-label={loop ? "Disable Loop" : "Enable Loop"}
          >
            <IconRepeat
              className={loop ? "h-4 w-4 text-green-500" : "h-4 w-4"}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}
