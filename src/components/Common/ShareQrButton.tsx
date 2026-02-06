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

import { useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import { IconDownload, IconQrcode } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import NextImage from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import qrcode from "qrcode";
import { Switch } from "@/components/ui/switch";
import { apiV1 } from "@/lib/api-path";
import { getCurrentUser } from "@/lib/client/user";

export default function ShareQrButton({
  url,
  children,
  label = "Share QR",
  variant = "outline",
  size = "sm",
  className,
  open,
  setOpen,
  presets,
  embedColor,
  defaultAvatarEnabled = true,
}: {
  url: string;
  children?: React.ReactNode;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  presets?: Array<{
    id: string;
    label: string;
    fg: string;
    bg: string;
    margin?: number;
  }>;
  embedColor?: string | null;
  defaultAvatarEnabled?: boolean;
}) {
  const [dataUrl, setDataUrl] = useState<string>("");
  const [imageSrc, setImageSrc] = useState<string>("");
  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;

  useEffect(() => {
    async function fetchUser() {
      const user = await getCurrentUser();
      if (!user) return;
      try {
        if (user) {
          setImageSrc(user.image || "");
        }
      } catch {
        toast.error("Error fetching user avatar.");
      }
    }
    fetchUser();
  }, []);

  const [avatarEnabled, setAvatarEnabled] = useState(
    Boolean(defaultAvatarEnabled),
  );
  const [fetchedEmbedAccent, setFetchedEmbedAccent] = useState<string | null>(
    null,
  );
  const [embedFetchState, setEmbedFetchState] = useState<"idle" | "loaded">(
    embedColor !== undefined ? "loaded" : "idle",
  );
  const embedAccent = embedColor ?? fetchedEmbedAccent;
  const presetOptions = useMemo(() => {
    const base = presets ?? [
      { id: "default", label: "Default", fg: "#0a0a0a", bg: "#f0f0f0" },
      { id: "dark", label: "Dark", fg: "#f0f0f0", bg: "#0a0a0a" },
      { id: "brand", label: "Brand", fg: "#604198", bg: "#f0f0f0" },
      { id: "branddark", label: "Brand Dark", fg: "#604198", bg: "#0a0a0a" },
      { id: "high", label: "High Contrast", fg: "#000000", bg: "#ffffff" },
    ];
    const normalized = normalizeHexColor(embedAccent);
    if (!normalized || base.some((preset) => preset.id === "embed")) {
      return base;
    }
    return [
      ...base,
      {
        id: "embed",
        label: "Embed color",
        fg: normalized,
        bg: "#ffffff",
      },
    ];
  }, [embedAccent, presets]);
  const [presetId, setPresetId] = useState(presetOptions[0]?.id ?? "default");
  const [qrSize, setQrSize] = useState("200");
  const currentPresetId = presetOptions.some((preset) => preset.id === presetId)
    ? presetId
    : (presetOptions[0]?.id ?? "default");

  const activePreset = useMemo(() => {
    return (
      presetOptions.find((preset) => preset.id === currentPresetId) ??
      presetOptions[0]
    );
  }, [currentPresetId, presetOptions]);

  const avatarSize = useMemo(() => {
    const sizeValue = Number(qrSize);
    if (!sizeValue || Number.isNaN(sizeValue)) return 52;
    return Math.max(40, Math.round(sizeValue * 0.28));
  }, [qrSize]);

  useEffect(() => {
    if (
      !dialogOpen ||
      embedFetchState === "loaded" ||
      embedColor !== undefined
    ) {
      return;
    }
    let active = true;
    fetch(apiV1("/profile/embed"), {
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const nextColor =
          typeof data?.settings?.color === "string" ? data.settings.color : "";
        setFetchedEmbedAccent(nextColor || null);
        setEmbedFetchState("loaded");
      })
      .catch(() => {
        if (!active) return;
        setEmbedFetchState("loaded");
      });
    return () => {
      active = false;
    };
  }, [dialogOpen, embedColor, embedFetchState]);

  useEffect(() => {
    let active = true;
    if (!url) {
      setTimeout(() => setDataUrl(""), 0);
      return;
    }
    qrcode
      .toDataURL(url, {
        margin: activePreset?.margin ?? 1,
        width: Number(qrSize) * 2,
        color: {
          dark: activePreset?.fg ?? "#111827",
          light: activePreset?.bg ?? "#ffffff",
        },
      })
      .then((next) => {
        if (active) setDataUrl(next);
      })
      .catch((err) => {
        console.error("QR code generation failed", err, url);
        if (active) setDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [activePreset, qrSize, url]);

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(next) => {
        setInternalOpen(next);
        setOpen?.(next);
      }}
    >
      <DialogTrigger asChild>
        {children ?? (
          <Button
            variant={variant}
            size={size}
            className={className}
            disabled={!url}
          >
            <IconQrcode className="h-4 w-4" />
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share QR Code</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="w-full grid gap-3">
            <div className="grid gap-2">
              <Label>Preset</Label>
              <Select value={currentPresetId} onValueChange={setPresetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Size</Label>
              <Select value={qrSize} onValueChange={setQrSize}>
                <SelectTrigger>
                  <SelectValue placeholder="Size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="160">Small</SelectItem>
                  <SelectItem value="200">Medium</SelectItem>
                  <SelectItem value="260">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {imageSrc ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                <div>
                  <Label className="text-sm">Avatar</Label>
                  <p className="text-xs text-muted-foreground">
                    Place your avatar in the center of the QR.
                  </p>
                </div>
                <Switch
                  checked={avatarEnabled}
                  onCheckedChange={setAvatarEnabled}
                />
              </div>
            ) : null}
          </div>
          <div
            className="relative rounded-lg border bg-white p-3"
            style={{ backgroundColor: activePreset?.bg ?? "#ffffff" }}
          >
            <QRCode
              value={url}
              size={Number(qrSize)}
              bgColor={activePreset?.bg ?? "#ffffff"}
              fgColor={activePreset?.fg ?? "#111827"}
            />
            {avatarEnabled && imageSrc ? (
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-white p-1 shadow"
                style={{ width: avatarSize, height: avatarSize }}
              >
                <NextImage
                  src={imageSrc}
                  alt="Avatar"
                  width={avatarSize}
                  height={avatarSize}
                  className="h-full w-full rounded-full object-cover"
                  unoptimized
                />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={!dataUrl}
              onClick={async () => {
                if (!dataUrl) {
                  toast.error("QR code not ready yet");
                  return;
                }
                const finalUrl = await buildQrDownloadUrl({
                  dataUrl,
                  avatarUrl: avatarEnabled ? imageSrc : null,
                });
                const link = document.createElement("a");
                link.href = finalUrl;
                link.download = "share-qr.png";
                link.click();
              }}
            >
              <IconDownload className="h-4 w-4" />
              Download
            </Button>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            Scan to open the share link.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalizeHexColor(color: string | null | undefined) {
  if (!color) return null;
  const trimmed = color.trim();
  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) return trimmed.toLowerCase();
  return null;
}

async function buildQrDownloadUrl({
  dataUrl,
  avatarUrl,
}: {
  dataUrl: string;
  avatarUrl: string | null;
}) {
  if (!avatarUrl) return dataUrl;
  try {
    const [qrImage, avatarImage] = await Promise.all([
      loadImage(dataUrl),
      loadImage(avatarUrl),
    ]);
    const size = qrImage.width || 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(qrImage, 0, 0, size, size);
    const avatarSize = Math.max(64, Math.round(size * 0.26));
    const center = size / 2;
    const radius = avatarSize / 2;
    const borderRadius = radius + Math.max(6, Math.round(size * 0.02));
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(center, center, borderRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      avatarImage,
      center - radius,
      center - radius,
      avatarSize,
      avatarSize,
    );
    ctx.restore();
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}
