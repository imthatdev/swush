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

import type { AudioTrackMeta } from "@/types/player";
import { apiV1 } from "@/lib/api-path";

async function computeGradient(dataUrl: string) {
  if (typeof window === "undefined") return null;
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = dataUrl;
    await img.decode();
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha < 16) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count += 1;
    }
    if (!count) return null;
    const avgR = Math.round(r / count);
    const avgG = Math.round(g / count);
    const avgB = Math.round(b / count);
    const shade = (v: number, delta: number) =>
      Math.min(255, Math.max(0, v + delta));
    const from = `rgba(${avgR}, ${avgG}, ${avgB}, 0.55)`;
    const to = `rgba(${shade(avgR, -45)}, ${shade(avgG, -45)}, ${shade(
      avgB,
      -45,
    )}, 0.25)`;
    return `radial-gradient(120% 120% at 10% 0%, ${from}, ${to})`;
  } catch {
    return null;
  }
}

export async function loadAudioTrackMeta(
  slug: string,
  signal?: AbortSignal,
  opts?: { password?: string },
): Promise<AudioTrackMeta | null> {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams();
    if (opts?.password) params.set("p", opts.password);
    const query = params.toString();
    const url = apiV1(
      `/files/${encodeURIComponent(slug)}/audio-metadata${
        query ? `?${query}` : ""
      }`,
    );
    const res = await fetch(url, {
      signal,
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const meta = (await res.json()) as AudioTrackMeta | null;
    if (!meta || !meta.pictureDataUrl) return meta;
    if (!meta.gradient) {
      const gradient = await computeGradient(meta.pictureDataUrl);
      if (gradient) return { ...meta, gradient };
    }
    return meta;
  } catch {
    return null;
  }
}
