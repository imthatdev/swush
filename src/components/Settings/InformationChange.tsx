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

import { useEffect, useRef, useState } from "react";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { apiV1 } from "@/lib/api-path";
import { getCurrentUser } from "@/lib/client/user";
import { Summary } from "@/types/schema";
import { Textarea } from "../ui/textarea";
import { updateMyUserInfo } from "@/lib/server/user-info";
import { DEFAULT_AVATAR_PATH } from "@/lib/avatar";
import { AvatarCropper, type AvatarCropperHandle } from "./AvatarCropper";
import UserAvatar from "@/components/Common/UserAvatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

export default function InformationChange() {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [userId, setUserId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [optimisticAvatarUrl, setOptimisticAvatarUrl] = useState<string>("");
  const [avatarLoadFailures, setAvatarLoadFailures] = useState(0);
  const [avatarFallback, setAvatarFallback] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const cropperRef = useRef<AvatarCropperHandle | null>(null);

  const resourceLabels: Record<keyof Summary["resources"], string> = {
    files: "Files",
    shortLink: "Short Links",
  };

  function fmt(value: number) {
    return value.toLocaleString();
  }

  function fmtLimit(value?: number | null) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "∞";
    return fmt(value);
  }

  function fmtOrUnknown(value?: number | null) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "??";
    return fmt(value);
  }

  const handleSave = async () => {
    setLoading(true);

    try {
      const body: { username?: string; displayName?: string; bio?: string } =
        {};
      if (username.trim()) body.username = username.trim();
      if (displayName.trim() || displayName === "")
        body.displayName = displayName.trim();
      if (bio.trim() || bio === "") body.bio = bio.trim();

      if (body.username && body.username !== initialUsername) {
        const { data: response } = await authClient.isUsernameAvailable({
          username: body.username,
        });

        if (!response?.available) {
          toast.error("Username is already taken", {
            description: "Please choose a different username.",
          });
          setLoading(false);
          return false;
        }
      }

      const { error } = await authClient.updateUser({
        name: body.displayName,
        username: body.username,
      });

      if (body.bio !== undefined) {
        const bioResult = await updateMyUserInfo({ bio: body.bio });
        if (!bioResult.ok) {
          throw new Error(
            typeof bioResult.error === "string"
              ? bioResult.error
              : "Failed to update bio",
          );
        }
      }

      if (error) {
        toast.error(error.statusText || "Failed to update profile", {
          description:
            error.message || "An error occurred while updating your profile.",
        });
        return false;
      } else {
        toast.success("Profile updated");
      }
    } catch (error) {
      toast.error("Something went wrong", {
        description: error as unknown as string,
      });
      return false;
    } finally {
      setLoading(false);
    }
    return true;
  };

  useEffect(() => {
    async function fetchUser() {
      const user = await getCurrentUser();

      setUserId(user?.id || "");
      setAvatarUrl(typeof user?.image === "string" ? user.image : "");
      setAvatarFallback(false);
      setUsername(user?.username || "");
      setInitialUsername(user?.username || "");
      setDisplayName(user?.name || "");
      setBio(user?.bio || "");

      try {
        const res = await fetch(apiV1("/profile/summary"), {
          cache: "no-store",
        });
        if (res.ok) {
          const data: Summary = await res.json();
          setSummary(data);
        } else {
          setSummary(null);
        }
      } catch {
        setSummary(null);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    setAvatarFallback(false);
    setAvatarLoadFailures(0);
  }, [avatarUrl]);

  useEffect(() => {
    return () => {
      if (optimisticAvatarUrl.startsWith("blob:")) {
        URL.revokeObjectURL(optimisticAvatarUrl);
      }
    };
  }, [optimisticAvatarUrl]);

  const avatarSrc = optimisticAvatarUrl
    ? optimisticAvatarUrl
    : !avatarFallback && avatarUrl
      ? `${avatarUrl}`
      : userId && !avatarFallback
        ? `${apiV1(`/avatar/${userId}`)}`
        : DEFAULT_AVATAR_PATH;

  const waitForImage = async (url: string) => {
    const attempts = 8;
    const baseDelayMs = 150;
    for (let i = 0; i < attempts; i++) {
      const ok = await fetch(url, { cache: "no-store" })
        .then(
          (r) =>
            r.ok && (r.headers.get("content-type") || "").includes("image/"),
        )
        .catch(() => false);
      if (ok) return true;
      await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
    return false;
  };

  const uploadAvatar = async () => {
    if (!avatarFile) {
      toast.error("Choose an image first");
      return;
    }
    if (!cropperRef.current?.isReady?.()) {
      toast.error("Image is still loading", {
        description: "Please wait a moment and try again.",
      });
      return;
    }

    setAvatarUploading(true);
    try {
      const croppedBlob =
        (await cropperRef.current.getCroppedBlob().catch(() => null)) ?? null;

      if (!croppedBlob) {
        throw new Error("Failed to prepare cropped avatar");
      }

      setAvatarFallback(false);
      setOptimisticAvatarUrl(URL.createObjectURL(croppedBlob));

      const form = new FormData();
      form.set(
        "file",
        new File([croppedBlob], "avatar.png", { type: "image/png" }),
      );

      const res = await fetch(apiV1("/avatar/upload"), {
        method: "POST",
        body: form,
      });

      const body = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
        url?: string;
      } | null;

      if (!res.ok) {
        throw new Error(
          body?.message || body?.error || "Failed to upload avatar",
        );
      }

      setAvatarFile(null);
      setAvatarFallback(false);
      const nextUrl =
        typeof body?.url === "string" && body.url.trim()
          ? body.url
          : (await getCurrentUser())?.image || "";

      if (nextUrl) {
        setAvatarUrl(nextUrl);
        void waitForImage(nextUrl).then((loaded) => {
          if (loaded) {
            setOptimisticAvatarUrl("");
          }
        });
      }
      setAvatarOpen(false);
      toast.success("Avatar updated");
    } catch (error) {
      toast.error("Avatar upload failed", {
        description: error as unknown as string,
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  const resetAvatar = async () => {
    setAvatarUploading(true);
    try {
      const res = await fetch(apiV1("/avatar/upload"), { method: "DELETE" });
      const body = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
        url?: string;
      } | null;
      if (!res.ok) {
        throw new Error(
          body?.message || body?.error || "Failed to reset avatar",
        );
      }
      setAvatarFile(null);
      setAvatarFallback(false);
      setOptimisticAvatarUrl("");
      const nextUrl =
        typeof body?.url === "string" && body.url.trim()
          ? body.url
          : (await getCurrentUser())?.image || "";
      if (nextUrl) setAvatarUrl(nextUrl);
      setAvatarOpen(false);
      toast.success("Avatar reset");
    } catch (error) {
      toast.error("Avatar reset failed", {
        description: error as unknown as string,
      });
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Profile</CardTitle>
            <CardDescription>
              Keep your public profile details up to date.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap-reverse items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative h-12 w-12 overflow-hidden rounded-full border bg-muted shrink-0">
                  <UserAvatar
                    key={avatarSrc}
                    src={avatarSrc}
                    alt="Profile avatar"
                    className="h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                    fallbackMode="none"
                    onError={() => {
                      if (optimisticAvatarUrl) return;
                      if (avatarUrl && avatarLoadFailures < 6) {
                        setAvatarLoadFailures((v) => v + 1);
                        return;
                      }
                      setAvatarFallback(true);
                    }}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Display name</p>
                  <p className="text-foreground">{displayName || "ꕀ"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={avatarOpen} onOpenChange={setAvatarOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm" disabled={!userId}>
                      Change avatar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Change avatar</DialogTitle>
                      <DialogDescription>
                        Upload a new profile picture (PNG/JPG/WebP, up to 10MB).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="avatar">Avatar</Label>
                        <Input
                          id="avatar"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={avatarUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            setAvatarFile(f);
                          }}
                        />
                      </div>
                      {avatarFile ? (
                        <AvatarCropper
                          ref={cropperRef}
                          file={avatarFile}
                          disabled={avatarUploading}
                        />
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={uploadAvatar}
                          disabled={avatarUploading || !avatarFile}
                        >
                          {avatarUploading ? "Uploading..." : "Upload"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={resetAvatar}
                          disabled={avatarUploading}
                        >
                          Reset to default
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">
                      Edit profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit profile</DialogTitle>
                      <DialogDescription>
                        Update your public profile details.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3">
                      <div className="grid gap-2">
                        <Label htmlFor="username" className="text-foreground">
                          Username
                        </Label>
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder={
                            loading ? "Loading..." : "Your unique username"
                          }
                          disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                          Used in your profile URL and share links.
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <Label
                          htmlFor="displayName"
                          className="text-foreground"
                        >
                          Display Name
                        </Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder={
                            loading ? "Loading..." : "How your name appears"
                          }
                          disabled={loading}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="bio" className="text-foreground">
                          Bio
                        </Label>
                        <Textarea
                          id="bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder={
                            loading
                              ? "Loading..."
                              : "Write a short bio about yourself"
                          }
                          disabled={loading}
                        />
                        <p className="text-xs text-muted-foreground">
                          Shown on public profile pages.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        const ok = await handleSave();
                        if (ok) setProfileOpen(false);
                      }}
                      disabled={loading || (!username && !displayName)}
                    >
                      {loading ? "Saving..." : "Save Profile"}
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Username</p>
              <p className="text-foreground truncate">{username || "ꕀ"}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Bio</p>
              <p className="text-foreground line-clamp-2">{bio || "ꕀ"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Usage Summary</CardTitle>
          <CardDescription>
            A quick overview of storage and daily limits.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/60 p-3 space-y-1">
            <p>
              Storage used:{" "}
              {summary ? fmt(summary.storage.usedStorageMb) : "??"} MB /{" "}
              {summary ? fmtLimit(summary.storage.maxStorageMb) : "??"} MB
              {summary ? (
                <>
                  {" "}
                  <span className="text-primary">
                    ({fmtLimit(summary.storage.remainingStorageMb)})
                  </span>
                </>
              ) : null}
            </p>
            <p>
              Daily uploads:{" "}
              {summary ? fmt(summary.dailyQuota.usedTodayMb) : "??"} MB /{" "}
              {summary ? fmtLimit(summary.dailyQuota.dailyQuotaMb) : "??"} MB
              {summary ? (
                <>
                  {" "}
                  <span className="text-primary">
                    ({fmtLimit(summary.dailyQuota.remainingTodayMb)})
                  </span>
                </>
              ) : null}
            </p>
            <p>
              Per upload: up to{" "}
              {summary ? fmtLimit(summary.perUpload.maxUploadMb) : "??"} MB, max{" "}
              {summary ? fmtLimit(summary.perUpload.maxFilesPerUpload) : "??"}{" "}
              files
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {(["files", "shortLink"] as const).map((key) => {
              const r = summary?.resources[key];
              return (
                <div key={key} className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {resourceLabels[key]}
                  </p>
                  <p>
                    {r ? (
                      <>
                        {fmtOrUnknown(r.used)} / {fmtLimit(r.limit)}{" "}
                        <span className="text-primary">
                          ({fmtLimit(r.remaining)})
                        </span>
                      </>
                    ) : (
                      "??"
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
