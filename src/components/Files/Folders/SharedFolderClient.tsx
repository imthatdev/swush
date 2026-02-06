/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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
  IconLock,
  IconMusic,
  IconFileTypePdf,
  IconPhoto,
  IconPlayerPlay,
  IconFileText,
  IconVideo,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { apiV1 } from "@/lib/api-path";
import { formatBytes } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { loadAudioTrackMeta } from "@/lib/audio-metadata";
import type { AudioTrackMeta } from "@/types/player";
import {
  useLocalStorageBoolean,
  useLocalStorageNumber,
} from "@/hooks/use-local-storage";
import MiniPlayer from "@/components/Vault/Player/MiniPlayer";
import type { Upload } from "@/types";
import type { PlayerControls } from "@/types/player";
import PublicOwnerHeader from "@/components/Common/PublicOwnerHeader";
import { Tooltip } from "@/components/Shared/CustomTooltip";
import { isMedia } from "@/lib/mime-types";

type SharedFile = {
  id: string;
  slug: string;
  originalName: string;
  mimeType: string;
  size: number;
  isPublic: boolean;
  createdAt: string | null;
  hasPassword: boolean;
};

type SharedFolder = {
  id: string;
  userId: string;
  name: string;
  shareSlug: string | null;
  ownerUsername: string | null;
  ownerDisplayName: string | null;
  ownerImage: string | null;
  ownerBio: string | null;
  ownerVerified?: boolean | null;
  hasPassword: boolean;
};

type SharedFolderResponse = {
  folder: SharedFolder;
  files: SharedFile[];
};

export default function SharedFolderClient({ folderId }: { folderId: string }) {
  const [data, setData] = useState<SharedFolderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [galleryView, setGalleryView] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerCollapsed, setPlayerCollapsed] = useState(false);
  const [playerQueue, setPlayerQueue] = useState<Upload[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [playerIsPlaying, setPlayerIsPlaying] = useState(false);
  const [progressTime, setProgressTime] = useState(0);
  const [progressDur, setProgressDur] = useState(0);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const controlsRef = useRef<PlayerControls | null>(null);
  const [playerVolume, setPlayerVolume] = useLocalStorageNumber(
    "vault.playerVolume",
    0.8,
  );
  const [playerMuted, setPlayerMuted] = useLocalStorageBoolean(
    "vault.playerMuted",
    false,
  );

  const handlePlayerVolumeChange = (volume: number, muted: boolean) => {
    const clamped = Math.min(1, Math.max(0, volume));
    setPlayerVolume(clamped);
    setPlayerMuted(muted);
  };

  const handlePlayerAudioEl = useCallback(
    (el: HTMLAudioElement | null) => {
      setAudioEl(el);
      if (el) {
        el.volume = Math.min(1, Math.max(0, playerVolume));
        el.muted = playerMuted;
      }
    },
    [playerMuted, playerVolume],
  );

  useEffect(() => {
    if (!audioEl) return;
    audioEl.volume = Math.min(1, Math.max(0, playerVolume));
    audioEl.muted = playerMuted;
  }, [audioEl, playerMuted, playerVolume]);

  const fetchFolder = async (pw?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(
        apiV1(`/folders/shared/${encodeURIComponent(folderId)}`),
        window.location.origin,
      );
      if (pw) url.searchParams.set("p", pw);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (res.status === 403) {
        setLocked(true);
        setData(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || "Folder not found");
      }
      const body = (await res.json()) as SharedFolderResponse;
      setData(body);
      setSelectedFolder(body.folder.name);
      setLocked(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!folderId) return;
    fetchFolder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const audioQueue = useMemo(() => {
    if (!data?.files?.length) return [];
    return data.files
      .filter((f) => f.mimeType.startsWith("audio/") && !f.hasPassword)
      .map((f) => ({
        id: f.id,
        userId: data.folder.userId,
        originalName: f.originalName,
        customName: "",
        description: null,
        isFavorite: false,
        mimeType: f.mimeType,
        size: f.size,
        slug: f.slug,
        isPublic: f.isPublic,
        createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
      }));
  }, [data]);

  const [trackMeta, setTrackMeta] = useState<
    Record<string, AudioTrackMeta | null>
  >({});

  useEffect(() => {
    if (!data?.files?.length) return;
    const audioFiles = data.files.filter(
      (f) => f.mimeType.startsWith("audio/") && !f.hasPassword,
    );
    audioFiles.forEach((file) => {
      if (trackMeta[file.slug] !== undefined) return;
      loadAudioTrackMeta(file.slug)
        .then((meta) => {
          setTrackMeta((prev) => ({ ...prev, [file.slug]: meta || null }));
        })
        .catch(() => {
          setTrackMeta((prev) => ({ ...prev, [file.slug]: null }));
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const renderFileIcon = (mime: string, meta?: AudioTrackMeta | null) => {
    let Icon = IconFile;
    if (mime.startsWith("image/")) Icon = IconPhoto;
    else if (mime.startsWith("video/")) Icon = IconVideo;
    else if (mime.startsWith("audio/")) Icon = IconMusic;
    else if (mime === "application/pdf") Icon = IconFileTypePdf;
    else if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/xml" ||
      mime === "application/javascript"
    ) {
      Icon = IconFileText;
    }
    if (mime.startsWith("audio/") && meta?.pictureDataUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={meta.pictureDataUrl}
          alt={meta.title || "cover"}
          className="h-16 w-16 object-cover rounded shadow"
          style={{ background: meta.gradient || undefined }}
        />
      );
    }
    return <Icon className="h-6 w-6 text-muted-foreground" />;
  };

  useEffect(() => {
    setPlayerQueue(audioQueue);
    if (audioQueue.length === 0) {
      setPlayerOpen(false);
    }
  }, [audioQueue]);

  const playNext = () => {
    setPlayerIndex((i) => (i + 1) % Math.max(playerQueue.length, 1));
    setPlayerIsPlaying(true);
  };

  const playPrev = () => {
    setPlayerIndex(
      (i) =>
        (i - 1 + Math.max(playerQueue.length, 1)) %
        Math.max(playerQueue.length, 1),
    );
    setPlayerIsPlaying((prev) => (prev ? true : false));
  };

  const loadFolderIntoPlayer = () => {
    setPlayerQueue(audioQueue);
    setPlayerIndex(0);
    setPlayerOpen(true);
    setPlayerCollapsed(false);
  };

  const openPlayerAt = (index: number) => {
    setPlayerQueue(audioQueue);
    setPlayerIndex(index);
    setPlayerOpen(true);
    setPlayerCollapsed(false);
  };

  useEffect(() => {
    if (!playerIsPlaying) return;
    if (controlsRef.current && typeof controlsRef.current.play === "function") {
      controlsRef.current.play();
    }
  }, [playerIndex, playerQueue.length, playerIsPlaying]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-2xl font-semibold">Folder unavailable</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconLock className="h-5 w-5" /> Password required
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              type="password"
              placeholder="Enter folder password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button onClick={() => fetchFolder(password)}>Unlock</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const audioAvailable = audioQueue.length > 0;
  const mediaAvailable = data.files.some(
    (f) =>
      f.mimeType.startsWith("audio/") ||
      f.mimeType.startsWith("video/") ||
      f.mimeType.startsWith("image/"),
  );

  return (
    <div className="space-y-6 w-full px-20">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold">{data.folder.name}</h1>
        <div className="text-sm text-muted-foreground">
          {data.files.length} file{data.files.length === 1 ? "" : "s"}
        </div>
        <div className="flex justify-center">
          <PublicOwnerHeader
            name={data.folder.ownerDisplayName || data.folder.ownerUsername}
            username={data.folder.ownerUsername}
            image={data.folder.ownerImage}
            bio={data.folder.ownerBio}
            verified={data.folder.ownerVerified}
            userId={data.folder.userId}
            label="Shared by"
            className="justify-center"
          />
        </div>
        <div className="flex justify-center gap-2">
          {audioAvailable && (
            <Tooltip Content="Music Player" side="bottom">
              <Button variant="secondary" onClick={loadFolderIntoPlayer}>
                <IconMusic className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          {mediaAvailable && (
            <Tooltip Content="Gallery View" side="bottom">
              <Button
                variant={galleryView ? "default" : "outline"}
                onClick={() => setGalleryView((v) => !v)}
              >
                <IconPhoto className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {data.files.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">
          No public files in this folder.
        </div>
      ) : galleryView ? (
        <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [column-fill:balance] max-w-[90vw]">
          {data.files.map((file) => {
            const audioIndex = audioQueue.findIndex((f) => f.id === file.id);
            const meta = trackMeta[file.slug];
            return (
              <div
                key={file.id}
                className="mb-4 break-inside-avoid overflow-hidden rounded-md cursor-pointer border border-border/60 bg-background/80 hover:border-primary/50"
              >
                <div className="h-32 w-full bg-muted/40 flex items-center justify-center">
                  {renderFileIcon(file.mimeType, meta)}
                </div>
                <div className="p-3 space-y-1">
                  <div className="truncate text-base" title={file.originalName}>
                    {meta?.title || file.originalName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {meta?.artist ? <span>{meta.artist} · </span> : null}
                    {formatBytes(file.size)} · {file.mimeType}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/v/${encodeURIComponent(file.slug)}`}>
                        View
                      </Link>
                    </Button>
                    {isMedia("audio", file.mimeType, file.originalName) &&
                      audioIndex >= 0 && (
                        <Button
                          size="sm"
                          onClick={() => openPlayerAt(audioIndex)}
                        >
                          <IconPlayerPlay className="h-4 w-4 mr-1" />
                          Play
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4">
          {data.files.map((file) => {
            const audioIndex = audioQueue.findIndex((f) => f.id === file.id);
            const meta = trackMeta[file.slug];
            return (
              <Card
                key={file.id}
                className="group overflow-hidden border-border/60 bg-background/80 transition hover:border-primary/50"
              >
                <div className="h-32 w-full bg-muted/40 flex items-center justify-center">
                  {renderFileIcon(file.mimeType, meta)}
                </div>
                <CardHeader className="space-y-1 pb-2">
                  <CardTitle
                    className="truncate text-base"
                    title={file.originalName}
                  >
                    {meta?.title || file.originalName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {meta?.artist ? <span>{meta.artist} · </span> : null}
                    {formatBytes(file.size)} · {file.mimeType}
                  </p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-2 pt-0">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/v/${encodeURIComponent(file.slug)}`}>
                      View
                    </Link>
                  </Button>
                  {isMedia("audio", file.mimeType, file.originalName) &&
                    audioIndex >= 0 && (
                      <Button
                        size="sm"
                        onClick={() => openPlayerAt(audioIndex)}
                      >
                        <IconPlayerPlay className="h-4 w-4 mr-1" />
                        Play
                      </Button>
                    )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {audioAvailable && (
        <>
          <MiniPlayer
            availableFolders={selectedFolder ? [selectedFolder] : []}
            selectedFolder={selectedFolder}
            setSelectedFolder={(v) => setSelectedFolder(v)}
            playerOpen={playerOpen}
            setPlayerOpen={setPlayerOpen}
            playerCollapsed={playerCollapsed}
            setPlayerCollapsed={setPlayerCollapsed}
            queue={playerQueue}
            index={playerIndex}
            setIndex={setPlayerIndex}
            playNext={playNext}
            playPrev={playPrev}
            controlsRef={controlsRef}
            isPlaying={playerIsPlaying}
            setIsPlaying={setPlayerIsPlaying}
            progressTime={progressTime}
            progressDur={progressDur}
            setProgressTime={setProgressTime}
            setProgressDur={setProgressDur}
            playerVolume={playerVolume}
            playerMuted={playerMuted}
            onVolumeChange={handlePlayerVolumeChange}
            setAudioEl={handlePlayerAudioEl}
            trackMeta={
              playerQueue[playerIndex]
                ? trackMeta[playerQueue[playerIndex].slug]
                : null
            }
            loadFolderIntoPlayer={() => loadFolderIntoPlayer()}
            shouldShowFolderSelect={false}
          />
        </>
      )}
    </div>
  );
}
