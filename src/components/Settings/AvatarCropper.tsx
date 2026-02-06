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
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Slider } from "@/components/ui/slider";

export type AvatarCropperHandle = {
  isReady: () => boolean;
  getCroppedBlob: () => Promise<Blob>;
  reset: () => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export const AvatarCropper = forwardRef<
  AvatarCropperHandle,
  {
    file: File;
    disabled?: boolean;
    previewSize?: number;
    outputSize?: number;
  }
>(function AvatarCropper({
  file,
  disabled = false,
  previewSize = 240,
  outputSize = 256,
}, ref) {
  const [zoom, setZoom] = useState(1.2);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [objectUrl, setObjectUrl] = useState<string>("");
  const [loadError, setLoadError] = useState(false);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
    setZoom(1.2);

    setImgSize(null);
    setLoadError(false);
  }, [objectUrl]);

  const scales = useMemo(() => {
    if (!imgSize) return null;
    const basePreview = Math.max(previewSize / imgSize.w, previewSize / imgSize.h);
    return { basePreview };
  }, [imgSize, previewSize]);

  function clampOffset(next: { x: number; y: number }, nextZoom = zoom) {
    if (!imgSize || !scales) return next;
    const scalePreview = scales.basePreview * nextZoom;
    const scaledW = imgSize.w * scalePreview;
    const scaledH = imgSize.h * scalePreview;
    const maxX = Math.max(0, (scaledW - previewSize) / 2);
    const maxY = Math.max(0, (scaledH - previewSize) / 2);
    return {
      x: clamp(next.x, -maxX, maxX),
      y: clamp(next.y, -maxY, maxY),
    };
  }

  useEffect(() => {
    setOffset((prev) => clampOffset(prev, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, imgSize, scales, previewSize]);

  function getSourceRect() {
    const img = imgElRef.current;
    const size = imgSize;
    const sc = scales;
    if (!img || !size || !sc) return null;

    const scale = sc.basePreview * zoom;
    const cx = previewSize / 2 + offset.x;
    const cy = previewSize / 2 + offset.y;

    const srcW = previewSize / scale;
    const srcH = previewSize / scale;
    const unclampedX = (0 - cx) / scale + size.w / 2;
    const unclampedY = (0 - cy) / scale + size.h / 2;

    const maxX = Math.max(0, size.w - srcW);
    const maxY = Math.max(0, size.h - srcH);

    return {
      sx: clamp(unclampedX, 0, maxX),
      sy: clamp(unclampedY, 0, maxY),
      sw: srcW,
      sh: srcH,
    };
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgElRef.current;
    const rect = getSourceRect();
    if (!canvas || !img || !rect) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(previewSize * dpr);
    canvas.height = Math.floor(previewSize * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      img,
      rect.sx,
      rect.sy,
      rect.sw,
      rect.sh,
      0,
      0,
      previewSize,
      previewSize,
    );
  }, [imgSize, offset.x, offset.y, previewSize, scales, zoom]);

  useImperativeHandle(ref, () => ({
    isReady() {
      return Boolean(imgElRef.current && imgSize && scales);
    },
    reset() {
      setZoom(1.2);
      setOffset({ x: 0, y: 0 });
    },
    async getCroppedBlob() {
      const img = imgElRef.current;
      const rect = getSourceRect();
      if (!img || !rect) {
        throw new Error("Image not ready");
      }

      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      ctx.drawImage(
        img,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh,
        0,
        0,
        outputSize,
        outputSize,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to encode image"));
        }, "image/png");
      });

      return blob;
    },
  }));

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <div
          className="relative mx-auto overflow-hidden rounded-full border bg-muted touch-none select-none"
          style={{ width: previewSize, height: previewSize }}
          onPointerDown={(e) => {
            if (disabled) return;
            if (!imgSize || !scales) return;
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            dragRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              startOffsetX: offset.x,
              startOffsetY: offset.y,
            };
          }}
          onPointerMove={(e) => {
            if (disabled) return;
            const drag = dragRef.current;
            if (!drag) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            setOffset(clampOffset({ x: drag.startOffsetX + dx, y: drag.startOffsetY + dy }));
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <img
            ref={imgElRef}
            src={objectUrl}
            alt=""
            className="absolute h-px w-px opacity-0 pointer-events-none"
            onLoad={(e) => {
              const el = e.currentTarget;
              setImgSize({
                w: el.naturalWidth || el.width,
                h: el.naturalHeight || el.height,
              });
            }}
            onError={() => {
              setLoadError(true);
              setImgSize(null);
            }}
          />
          <canvas
            ref={canvasRef}
            className="h-full w-full block pointer-events-none"
            style={{ width: previewSize, height: previewSize }}
          />
          {!imgSize ? (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
              {loadError ? "Preview failed to load" : "Loading preview..."}
            </div>
          ) : null}
          <div className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-border/40" />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Drag to reposition.
        </p>
      </div>

      <div className="grid gap-2">
        <p className="text-xs text-muted-foreground">Zoom</p>
        <Slider
          disabled={disabled}
          min={100}
          max={300}
          value={[Math.round(zoom * 100)]}
          onValueChange={(v) => setZoom((v?.[0] ?? 120) / 100)}
        />
      </div>
    </div>
  );
});
