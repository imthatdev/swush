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
  IconChevronDown,
  IconX, IconPlayerPause,
  IconPlayerPlay,
  IconPlayerTrackNext,
  IconPlayerTrackPrev
} from "@tabler/icons-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AudioWaveform } from "@/components/Files/AudioWaveform";
import { MiniPlayerProps } from "@/types/player";
import { usePlayer } from "./PlayerProvider";
import { usePathname } from "next/navigation";

export default function MiniPlayer({
  availableFolders,
  selectedFolder,
  setSelectedFolder,
  playerOpen,
  setPlayerOpen,
  playerCollapsed,
  setPlayerCollapsed,
  queue,
  index,
  setIndex,
  playNext,
  playPrev,
  controlsRef,
  isPlaying,
  setIsPlaying,
  progressTime,
  progressDur,
  loadFolderIntoPlayer,
  setProgressTime,
  setProgressDur,
  playerVolume,
  playerMuted,
  onVolumeChange,
  trackMeta,
  setAudioEl,
  shouldShowFolderSelect = true,
}: MiniPlayerProps) {
  const pathname = usePathname();
  const isVault = pathname.startsWith("/vault");
  const { setSelectedFolder: setPlayerSelectedFolder } = usePlayer();
  if (!playerOpen || queue.length === 0) return null;

  const current = queue[index];
  const displayTitle = trackMeta?.title ?? current?.originalName ?? "Audio";
  const displayArtist = trackMeta?.artist;
  const gradient = trackMeta?.gradient;
  const cover = trackMeta?.pictureDataUrl;

  return (
    <div
      className={cn(
        "fixed z-50 rounded-lg border bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/80 shadow-lg transition-all bottom-4 inset-x-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 w-auto sm:w-[min(40vw,90vw)] pb-[env(safe-area-inset-bottom)] overflow-hidden isolate",
      )}
    >
      {gradient && (
        <div
          className="absolute inset-0 opacity-50 blur-2xl pointer-events-none"
          style={{ backgroundImage: gradient }}
        />
      )}
      <div className="relative z-10">
        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-2 py-2",
            !playerCollapsed && "border-b",
          )}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {shouldShowFolderSelect && !playerCollapsed && isVault && (
              <Select
                value={selectedFolder ?? "__all__"}
                onValueChange={(val) => {
                  const folder = val === "__all__" ? null : val;
                  setPlayerSelectedFolder(folder);
                  if (typeof setSelectedFolder === "function") {
                    setSelectedFolder(folder);
                  }
                  if (typeof loadFolderIntoPlayer === "function") {
                    loadFolderIntoPlayer(folder);
                  }
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-36 text-xs">
                  <SelectValue placeholder="Folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All folders</SelectItem>
                  {availableFolders.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {playerCollapsed && current && (
              <div className="flex items-center gap-2 max-w-52">
                {cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover}
                    alt={displayTitle}
                    className="h-7 w-7 rounded-sm object-cover border border-border/60 bg-background/80"
                  />
                )}
                <div className="min-w-0">
                  <div
                    className="text-xs font-medium truncate"
                    title={displayTitle}
                  >
                    {displayTitle}
                  </div>
                  {displayArtist && (
                    <div
                      className="text-[11px] text-muted-foreground truncate"
                      title={displayArtist}
                    >
                      by {displayArtist}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 sm:h-9 sm:w-9"
              onClick={playPrev}
              aria-label="Previous"
            >
              <IconPlayerTrackPrev className="h-4 w-4" />
            </Button>

            {playerCollapsed && (
              <Button
                size="icon"
                variant="ghost"
                className="h-10 w-10 sm:h-9 sm:w-9"
                onClick={() => controlsRef.current?.toggle()}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <IconPlayerPause className="h-4 w-4" />
                ) : (
                  <IconPlayerPlay className="h-4 w-4" />
                )}
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 sm:h-9 sm:w-9"
              onClick={playNext}
              aria-label="Next"
            >
              <IconPlayerTrackNext className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 sm:h-9 sm:w-9"
              onClick={() => setPlayerCollapsed(!playerCollapsed)}
              aria-label={playerCollapsed ? "Expand player" : "Collapse player"}
            >
              <IconChevronDown
                className={`h-4 w-4 transition-transform duration-300 ${
                  playerCollapsed ? "rotate-180" : ""
                }`}
              />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 sm:h-9 sm:w-9"
              onClick={() => setPlayerOpen(false)}
              aria-label="Close"
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {playerCollapsed && (
        <div
          className="relative h-2 w-full bg-muted cursor-pointer overflow-hidden hidden md:block"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={progressDur || 0}
          aria-valuenow={progressTime || 0}
          onClick={(e) => {
            const rect = (
              e.currentTarget as HTMLDivElement
            ).getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = rect.width ? x / rect.width : 0;
            controlsRef.current?.seekTo?.(ratio);
          }}
          title={
            progressDur
              ? `${Math.floor(progressTime)}/${Math.floor(progressDur)}s`
              : undefined
          }
        >
          <div
            className="absolute left-0 top-0 h-full bg-primary"
            style={{
              width: `${progressDur ? (100 * progressTime) / progressDur : 0}%`,
              background: gradient
            }}
          />
        </div>
      )}

      {current && (
        <div
          className={cn(
            "px-3 pt-3",
            playerCollapsed &&
              "h-0 overflow-hidden opacity-0 pointer-events-none",
          )}
        >
          <AudioWaveform
            src={`/x/${encodeURIComponent(current.slug)}/index.m3u8`}
            rawSrc={`/x/${encodeURIComponent(current.slug)}/index.m3u8`}
            hlsSrc={`/hls/${encodeURIComponent(current.slug)}/index.m3u8`}
            isPublic={Boolean(current.isPublic)}
            sizeBytes={current.size}
            title={displayTitle}
            artist={displayArtist}
            cover={cover}
            color={gradient}
            autoPlay={false}
            onEnded={playNext}
            externalControlsRef={controlsRef}
            onPlayStateChange={setIsPlaying}
            volume={playerVolume}
            muted={playerMuted}
            onVolumeChange={onVolumeChange}
            onTime={(t, d) => {
              setProgressTime(t);
              setProgressDur(d);
            }}
            onAudioEl={setAudioEl}
          />
        </div>
      )}

      {!playerCollapsed && (
        <div className="max-h-36 sm:max-h-44 overflow-auto px-2 py-2">
          <ul className="space-y-1">
            {queue.map((f, i) => (
              <li key={f.id}>
                <button
                  className={`w-full text-left text-xs px-2 py-1 rounded-md ${
                    i === index
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setIndex(i)}
                  title={f.originalName}
                >
                  {i === index ? "▶ " : ""}
                  {f.originalName}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
