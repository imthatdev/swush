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
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import MiniPlayer from "@/components/Vault/Player/MiniPlayer";
import type { Upload } from "@/types";
import type { AudioTrackMeta, PlayerControls } from "@/types/player";
import {
  useLocalStorageBoolean,
  useLocalStorageNumber,
} from "@/hooks/use-local-storage";
import { loadAudioTrackMeta } from "@/lib/audio-metadata";

type PlayerContextValue = {
  playerOpen: boolean;
  setPlayerOpen: (v: boolean) => void;
  playerCollapsed: boolean;
  setPlayerCollapsed: (v: boolean) => void;

  queue: Upload[];
  setQueue: (q: Upload[]) => void;
  index: number;
  setIndex: (i: number) => void;
  playNext: () => void;
  playPrev: () => void;

  controlsRef: React.MutableRefObject<PlayerControls | null>;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  progressTime: number;
  progressDur: number;
  setProgressTime: (v: number) => void;
  setProgressDur: (v: number) => void;

  playerVolume: number;
  playerMuted: boolean;
  playerBrightness: number;
  onVolumeChange: (volume: number, muted: boolean) => void;
  onBrightnessChange: (value: number) => void;
  setAudioEl: (el: HTMLAudioElement | null) => void;

  selectedFolder: string | null;
  setSelectedFolder: (v: string | null) => void;
  availableFolders: string[];
  setAvailableFolders: (v: string[]) => void;
  setLoadFolderIntoPlayer: (
    fn: ((folder: string | null) => void) | null,
  ) => void;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [queue, setQueue] = useState<Upload[]>([]);
  const [index, setIndex] = useState(0);
  const [playerCollapsed, setPlayerCollapsed] = useState(false);
  const [playerAudioEl, setPlayerAudioEl] = useState<HTMLAudioElement | null>(
    null,
  );
  const [playerVolume, setPlayerVolume] = useLocalStorageNumber(
    "vault.playerVolume",
    0.8,
  );
  const [playerMuted, setPlayerMuted] = useLocalStorageBoolean(
    "vault.playerMuted",
    false,
  );
  const [playerBrightness, setPlayerBrightness] = useLocalStorageNumber(
    "vault.playerBrightness",
    1,
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [progressTime, setProgressTime] = useState(0);
  const [progressDur, setProgressDur] = useState(0);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const loadFolderIntoPlayerRef = useRef<
    ((folder: string | null) => void) | null
  >(null);

  const controlsRef = useRef<PlayerControls | null>(null);

  const [playerTrackMeta, setPlayerTrackMeta] = useState<
    Record<string, AudioTrackMeta>
  >({});
  const playerTrackMetaRef = useRef(playerTrackMeta);
  const playerTrackMetaRequests = useRef<Record<string, AbortController>>({});

  useEffect(() => {
    playerTrackMetaRef.current = playerTrackMeta;
  }, [playerTrackMeta]);

  const currentTrack = queue[index];
  const currentTrackMeta = currentTrack
    ? playerTrackMeta[currentTrack.slug]
    : null;

  useEffect(() => {
    if (!playerOpen || !currentTrack?.slug) return;
    const slug = currentTrack.slug;
    if (playerTrackMetaRef.current[slug]) return;
    if (currentTrack.audioMeta) {
      setTimeout(
        () =>
          setPlayerTrackMeta((prev) => ({
            ...prev,
            [slug]: currentTrack.audioMeta!,
          })),
        0,
      );
      return;
    }
    if (playerTrackMetaRequests.current[slug]) return;
    const controller = new AbortController();
    playerTrackMetaRequests.current[slug] = controller;
    const requestsRef = playerTrackMetaRequests.current;
    loadAudioTrackMeta(slug, controller.signal)
      .then((meta) => {
        if (!meta) return;
        setPlayerTrackMeta((prev) => ({ ...prev, [slug]: meta }));
      })
      .finally(() => {
        delete requestsRef[slug];
      });
    return () => {
      controller.abort();
      delete requestsRef[slug];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerOpen, currentTrack?.slug]);

  const onVolumeChange = useCallback(
    (volume: number, muted: boolean) => {
      const clamped = Math.min(1, Math.max(0, volume));
      setPlayerVolume(clamped);
      setPlayerMuted(muted);
    },
    [setPlayerMuted, setPlayerVolume],
  );

  const onBrightnessChange = useCallback(
    (value: number) => {
      const clamped = Math.min(1.5, Math.max(0.5, value));
      setPlayerBrightness(clamped);
    },
    [setPlayerBrightness],
  );

  const setAudioEl = useCallback(
    (el: HTMLAudioElement | null) => {
      setPlayerAudioEl(el);
      if (el) {
        if (el.dataset?.swushVolumeMode !== "gain") {
          el.volume = Math.min(1, Math.max(0, playerVolume));
          el.muted = playerMuted;
        }
      }
    },
    [playerMuted, playerVolume],
  );

  useEffect(() => {
    if (!playerAudioEl) return;

    try {
      setTimeout(() => {
        if (playerAudioEl.dataset?.swushVolumeMode !== "gain") {
          playerAudioEl.volume = Math.min(1, Math.max(0, playerVolume));
          playerAudioEl.muted = playerMuted;
        }
      }, 0);
    } catch {
      // Ignore if not allowed to set
    }
  }, [playerAudioEl, playerMuted, playerVolume]);

  useEffect(() => {
    if (!playerAudioEl) return;
    const onVolume = () => {
      if (playerAudioEl.dataset?.swushVolumeMode === "gain") {
        const datasetVolume = Number(playerAudioEl.dataset.swushVolume ?? "");
        const nextVolume = Number.isFinite(datasetVolume)
          ? Math.min(1, Math.max(0, datasetVolume))
          : playerVolume;
        const nextMuted = playerAudioEl.dataset.swushMuted === "1";
        setPlayerVolume(nextVolume);
        setPlayerMuted(nextMuted);
        return;
      }
      const nextVolume = Math.min(1, Math.max(0, playerAudioEl.volume || 0));
      const nextMuted = Boolean(playerAudioEl.muted);
      setPlayerVolume(nextVolume);
      setPlayerMuted(nextMuted);
    };
    onVolume();
    playerAudioEl.addEventListener("volumechange", onVolume);
    return () => {
      playerAudioEl.removeEventListener("volumechange", onVolume);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerAudioEl, setPlayerMuted, setPlayerVolume]);

  const playNext = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(queue.length, 1));
    setIsPlaying(true);
  }, [queue.length]);

  const playPrev = useCallback(() => {
    setIndex(
      (i) => (i - 1 + Math.max(queue.length, 1)) % Math.max(queue.length, 1),
    );
    setIsPlaying((prev) => (prev ? true : false));
  }, [queue.length]);

  useEffect(() => {
    if (!playerOpen || !playerIsSupported()) return;
    const ms = navigator.mediaSession as MediaSession;
    const onPlay = () => controlsRef.current?.play();
    const onPause = () => controlsRef.current?.pause();
    const onPrev = () => playPrev();
    const onNext = () => playNext();

    try {
      ms.setActionHandler("play", onPlay);
    } catch {}
    try {
      ms.setActionHandler("pause", onPause);
    } catch {}
    try {
      ms.setActionHandler("previoustrack", onPrev);
    } catch {}
    try {
      ms.setActionHandler("nexttrack", onNext);
    } catch {}

    return () => {
      try {
        ms.setActionHandler("play", null);
      } catch {}
      try {
        ms.setActionHandler("pause", null);
      } catch {}
      try {
        ms.setActionHandler("previoustrack", null);
      } catch {}
      try {
        ms.setActionHandler("nexttrack", null);
      } catch {}
    };
  }, [playerOpen, playPrev, playNext]);

  useEffect(() => {
    if (!playerOpen || !playerIsSupported()) return;
    const ms = navigator.mediaSession as MediaSession;
    const current = queue[index];
    if (current) {
      try {
        const art = currentTrackMeta?.pictureDataUrl;
        const artType = art?.startsWith("data:image/png")
          ? "image/png"
          : art?.startsWith("data:image/webp")
            ? "image/webp"
            : "image/jpeg";
        ms.metadata = new window.MediaMetadata({
          title: currentTrackMeta?.title || current.originalName || "Audio",
          artist: currentTrackMeta?.artist || "Swush",
          album: currentTrackMeta?.album || selectedFolder || "Library",
          artwork: art
            ? [
                {
                  src: art,
                  sizes: "512x512",
                  type: artType,
                },
              ]
            : undefined,
        });
      } catch {}
    }
    try {
      ms.playbackState = isPlaying ? "playing" : "paused";
    } catch {}
  }, [playerOpen, queue, index, isPlaying, selectedFolder, currentTrackMeta]);

  useEffect(() => {
    if (!isPlaying) return;
    if (controlsRef.current && typeof controlsRef.current.play === "function") {
      controlsRef.current.play();
    }
  }, [index, queue.length, isPlaying]);

  const setLoadFolderIntoPlayer = useCallback(
    (fn: ((folder: string | null) => void) | null) => {
      loadFolderIntoPlayerRef.current = fn;
    },
    [],
  );

  const ctx = useMemo<PlayerContextValue>(
    () => ({
      playerOpen,
      setPlayerOpen,
      playerCollapsed,
      setPlayerCollapsed,
      queue,
      setQueue,
      index,
      setIndex,
      playNext,
      playPrev,
      controlsRef,
      isPlaying,
      setIsPlaying,
      progressTime,
      progressDur,
      setProgressTime,
      setProgressDur,
      playerVolume,
      playerMuted,
      playerBrightness,
      onVolumeChange,
      onBrightnessChange,
      setAudioEl,
      selectedFolder,
      setSelectedFolder,
      availableFolders,
      setAvailableFolders,
      setLoadFolderIntoPlayer,
    }),
    [
      playerOpen,
      playerCollapsed,
      queue,
      index,
      playNext,
      playPrev,
      isPlaying,
      progressTime,
      progressDur,
      playerVolume,
      playerMuted,
      playerBrightness,
      onVolumeChange,
      onBrightnessChange,
      setAudioEl,
      selectedFolder,
      availableFolders,
      setLoadFolderIntoPlayer,
    ],
  );

  return (
    <PlayerContext.Provider value={ctx}>
      {children}
      <MiniPlayer
        availableFolders={availableFolders}
        selectedFolder={selectedFolder}
        setSelectedFolder={setSelectedFolder}
        playerOpen={playerOpen}
        setPlayerOpen={setPlayerOpen}
        playerCollapsed={playerCollapsed}
        setPlayerCollapsed={setPlayerCollapsed}
        queue={queue}
        index={index}
        setIndex={setIndex}
        playNext={playNext}
        playPrev={playPrev}
        controlsRef={controlsRef}
        isPlaying={isPlaying}
        setIsPlaying={setIsPlaying}
        progressTime={progressTime}
        progressDur={progressDur}
        setProgressTime={setProgressTime}
        setProgressDur={setProgressDur}
        playerVolume={playerVolume}
        playerMuted={playerMuted}
        onVolumeChange={onVolumeChange}
        trackMeta={currentTrackMeta}
        setAudioEl={setAudioEl}
        loadFolderIntoPlayer={(folder) =>
          loadFolderIntoPlayerRef.current?.(folder)
        }
        shouldShowFolderSelect={true}
      />
    </PlayerContext.Provider>
  );
}

function playerIsSupported() {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}
