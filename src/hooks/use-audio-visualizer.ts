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

import { useEffect, useRef, useState } from "react";
import { AUDIO_GRAPH_EVENT, getAudioGraph } from "@/lib/audio-graph";

type VisualizerNodes = {
  ctx: AudioContext;
  analyser: AnalyserNode;

  source: AudioNode;
  output?: GainNode | null;
  sourceType: "shared" | "stream";
  ownsContext: boolean;
  connected: boolean;
};

const visualizerNodeMap = new WeakMap<HTMLMediaElement, VisualizerNodes>();

type VisualizerOptions = {
  speed?: number;
  intensity?: number;
  sensitivity?: number;
  colorMode?: "rainbow" | "normal" | "duotone";
  bars?: number;
  gradient?: string | null;
};

export function useAudioVisualizer(
  enabled: boolean,
  audioEl: HTMLAudioElement | null,
  canvasEl: HTMLCanvasElement | null,
  options?: VisualizerOptions,
) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [graphTick, setGraphTick] = useState(0);
  const fallbackRef = useRef({ active: false, silentFrames: 0 });

  const _defaultOptions: Required<VisualizerOptions> = {
    speed: 0.3,
    intensity: 0.6,
    sensitivity: 1.2,
    colorMode: "normal",
    bars: 32,
    gradient: null,
  };
  const mergedOptions = {
    ..._defaultOptions,
    ...(options ?? {}),
  } as Required<VisualizerOptions>;

  const extractGradientColors = (cssGradient?: string | null) => {
    if (!cssGradient || typeof cssGradient !== "string") return null;

    const colorRe =
      /(#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|oklch\([^)]*\))/g;
    const matches = cssGradient.match(colorRe) ?? [];

    const unique: string[] = [];
    for (const m of matches) {
      const c = m.trim();
      if (!c) continue;
      if (!unique.includes(c)) unique.push(c);
      if (unique.length >= 2) break;
    }

    if (unique.length < 2) return null;
    return { a: unique[0], b: unique[1] };
  };

  useEffect(() => {
    if (!audioEl || typeof window === "undefined") return;
    const bump = () => setGraphTick((v) => v + 1);
    window.addEventListener(AUDIO_GRAPH_EVENT, bump);
    audioEl.addEventListener("play", bump);
    audioEl.addEventListener("loadedmetadata", bump);
    return () => {
      window.removeEventListener(AUDIO_GRAPH_EVENT, bump);
      audioEl.removeEventListener("play", bump);
      audioEl.removeEventListener("loadedmetadata", bump);
    };
  }, [audioEl]);

  useEffect(() => {
    if (!enabled || !audioEl || !canvasEl) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const getCaptureStream = (el: HTMLMediaElement) => {
      const captureFn =
        (el as HTMLMediaElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        }).captureStream ??
        (el as HTMLMediaElement & { mozCaptureStream?: () => MediaStream })
          .mozCaptureStream;
      return typeof captureFn === "function" ? captureFn.call(el) : null;
    };

    canvasRef.current = canvasEl;
    let nodes = visualizerNodeMap.get(audioEl);
    const graph = getAudioGraph(audioEl);
    const canUseShared =
      Boolean(graph?.ctx) &&
      graph?.ctx?.state !== "closed" &&
      Boolean(graph?.source);
    const stream = getCaptureStream(audioEl);
    const canCapture =
      Boolean(stream) &&
      Boolean(stream?.getAudioTracks) &&
      (stream?.getAudioTracks?.().length ?? 0) > 0;

    const desiredSourceType = canUseShared
      ? "shared"
      : canCapture
        ? "stream"
        : null;

    if (
      nodes &&
      (nodes.ctx.state === "closed" || nodes.sourceType !== desiredSourceType)
    ) {
      try {
        nodes.source.disconnect(nodes.analyser);
      } catch {}
      try {
        nodes.analyser.disconnect();
      } catch {}
      try {
        nodes.output?.disconnect();
      } catch {}
      if (nodes.ownsContext) {
        nodes.ctx.close().catch(() => null);
      }
      nodes = undefined;
    }

    if (!desiredSourceType) {
      console.warn(
        "useAudioVisualizer: no available audio graph for visualizer on this device.",
      );
      return;
    }

    if (!nodes || nodes.ctx.state === "closed") {
      let ctx: AudioContext;
      let analyser: AnalyserNode;
      let source: AudioNode;
      let output: GainNode | null = null;
      let sourceType: "shared" | "stream" = "stream";
      let ownsContext = true;

      if (desiredSourceType === "shared" && graph?.ctx && graph.source) {
        ctx = graph.ctx;
        analyser = ctx.createAnalyser();
        source = graph.gain ?? graph.source;
        output = ctx.createGain();
        output.gain.value = 0;
        sourceType = "shared";
        ownsContext = false;
      } else if (canCapture && stream) {
        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        source = ctx.createMediaStreamSource(stream);
        output = ctx.createGain();
        output.gain.value = 0;
        sourceType = "stream";
        ownsContext = true;
      } else {
        console.warn(
          "useAudioVisualizer: captureStream unavailable, skipping visualizer to avoid audio routing issues.",
        );
        return;
      }

      nodes = {
        ctx,
        analyser,
        source,
        output,
        sourceType,
        ownsContext,
        connected: false,
      };
      visualizerNodeMap.set(audioEl, nodes);
    }

    const { ctx, analyser, source } = nodes;
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const resumeCtx = () => {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => null);
      }
    };
    resumeCtx();
    audioEl.addEventListener("play", resumeCtx);
    audioEl.addEventListener("playing", resumeCtx);

    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;

    if (!nodes.connected) {
      try {
        source.connect(analyser);
        if (nodes.output) {
          analyser.connect(nodes.output);
          nodes.output.connect(ctx.destination);
        } else {
          analyser.connect(ctx.destination);
        }
        nodes.connected = true;
      } catch {}
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const resize = () => {
      const el = canvas;
      const r = el.getBoundingClientRect();
      const nextW = Math.floor(r.width * dpr);
      const nextH = Math.floor(r.height * dpr);
      const changed = el.width !== nextW || el.height !== nextH;
      el.width = nextW;
      el.height = nextH;
      return changed;
    };

    resize();
    const onResize = () => {
      const changed = resize();
      if (changed) {
        barGradientKey = "";
      }
    };
    window.addEventListener("resize", onResize);

    const freqBuffer = new Uint8Array(analyser.frequencyBinCount);
    const timeBuffer = new Uint8Array(analyser.fftSize);

    const barsCount = Math.max(
      4,
      Math.min(256, Math.round(mergedOptions.bars)),
    );
    const peaks = new Float32Array(barsCount);
    let hueShift = 0;
    let lastRender = 0;
    let barGradient: CanvasGradient | null = null;
    let barGradientKey = "";

    const draw = (ts?: number) => {
      const now = ts ?? performance.now();

      const speed = mergedOptions.speed;
      const intensity = mergedOptions.intensity;
      const sensitivity = Math.max(0.1, mergedOptions.sensitivity);
      const colorMode = mergedOptions.colorMode;
      const metaGradient = mergedOptions.gradient;

      const lowPower = barsCount <= 32 || intensity < 0.75;
      const targetFPS = lowPower ? 30 : 60;
      const minDelta = 1000 / targetFPS;
      if (now - lastRender < minDelta) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      lastRender = now;

      hueShift = (hueShift + speed) % 360;

      analyser.getByteFrequencyData(freqBuffer);
      analyser.getByteTimeDomainData(timeBuffer);

      const isPlaying = !audioEl.paused && !audioEl.ended;
      let energy = 0;
      for (let i = 0; i < freqBuffer.length; i += 1) {
        energy += freqBuffer[i];
      }
      const avg = energy / (freqBuffer.length * 255 || 1);
      if (isPlaying && avg < 0.004) {
        fallbackRef.current.silentFrames += 1;
      } else {
        fallbackRef.current.silentFrames = 0;
      }
      if (fallbackRef.current.silentFrames > 12 && isPlaying) {
        fallbackRef.current.active = true;
      }
      if (!isPlaying || avg > 0.02) {
        fallbackRef.current.active = false;
      }
      if (fallbackRef.current.active) {
        const t = now * 0.001;
        for (let i = 0; i < freqBuffer.length; i += 1) {
          const base = 0.35 + 0.35 * Math.sin(t * 1.8 + i * 0.25);
          const jitter = 0.15 * Math.sin(t * 3.2 + i * 0.9);
          const v = Math.max(0, Math.min(1, base + jitter));
          freqBuffer[i] = Math.round(v * 255);
        }
        const waveLen = timeBuffer.length || 1;
        for (let i = 0; i < waveLen; i += 1) {
          const phase = (i / waveLen) * Math.PI * 2;
          const wav = Math.sin(phase * 2 + t * 4);
          timeBuffer[i] = Math.round(128 + wav * 52);
        }
      }

      const { width, height } = canvas;
      const extracted = extractGradientColors(metaGradient);
      const nextKey = extracted
        ? `${extracted.a}|${extracted.b}|${width}|${height}`
        : "";
      if (extracted && nextKey !== barGradientKey) {
        const grad = g.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, extracted.a);
        grad.addColorStop(1, extracted.b);
        barGradient = grad;
        barGradientKey = nextKey;
      } else if (!extracted) {
        barGradient = null;
        barGradientKey = "";
      }

      g.clearRect(0, 0, width, height);
      const bgGrad = g.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "rgba(24 24 24 / 0)");
      bgGrad.addColorStop(1, "rgba(26 27 27 / 0)");
      g.fillStyle = bgGrad;
      g.fillRect(0, 0, width, height);

      g.globalCompositeOperation = "lighter";

      const step = Math.max(1, Math.floor(freqBuffer.length / barsCount));
      const barW =
        (width / barsCount) * (0.75 + Math.min(0.6, intensity * 0.35));
      const primaryCss =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--primary")
          .trim() || "oklch(0.58 0.18 284.12)";
      const secondaryCss =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--secondary")
          .trim() || "#8b5cf6";

      const shadowMult = lowPower ? 0.45 : 1;

      for (let i = 0; i < barsCount; i++) {
        const raw = freqBuffer[i * step] / 255;
        const v = Math.min(1, Math.pow(raw, 1 / sensitivity));
        const h = v * (height * 0.85);
        const x = (width / barsCount) * i + (width / barsCount - barW) / 2;
        const y = height - h;

        if (v > peaks[i]) peaks[i] = v;
        else peaks[i] = Math.max(0, peaks[i] - 0.018 * (1 + intensity * 0.4));

        let fillStyle: CanvasFillStrokeStyles["fillStyle"] = "";

        if (
          (colorMode === "normal" || colorMode === "duotone") &&
          barGradient
        ) {
          fillStyle = barGradient;
          g.shadowColor = extracted?.b ?? secondaryCss;
        } else if (colorMode === "normal") {
          fillStyle = primaryCss;
          g.shadowColor = primaryCss;
        } else if (colorMode === "duotone") {
          const grad = g.createLinearGradient(0, y, 0, y + Math.max(6, h));
          grad.addColorStop(0, primaryCss);
          grad.addColorStop(1, secondaryCss);
          fillStyle = grad;
          g.shadowColor = secondaryCss;
        } else {
          const hue = (i / barsCount) * 360 + hueShift;
          const light = Math.min(65, 22 + v * 55);
          fillStyle = `hsl(${Math.round(hue)} 92% ${Math.round(light)}%)`;
          g.shadowColor = fillStyle as string;
        }

        g.fillStyle = fillStyle;
        g.shadowBlur = 12 * Math.max(0.2, v) * intensity * shadowMult;
        g.fillRect(x + 1, y, Math.max(2, barW - 2), Math.max(2, h));

        const peakY = height - peaks[i] * (height * 0.85) - 3;
        if (colorMode === "normal") {
          g.globalAlpha = 0.95;
          g.fillStyle = primaryCss;
        } else {
          g.globalAlpha = 1;
          g.fillStyle = "rgba(255,255,255,0.95)";
        }
        g.shadowBlur = 6 * intensity * shadowMult;
        g.fillRect(x + 1, Math.max(0, peakY), Math.max(2, barW - 2), 3);
        g.globalAlpha = 1;
      }

      g.shadowBlur = 0;
      g.globalCompositeOperation = "source-over";

      g.beginPath();
      g.lineWidth = lowPower ? 1.5 : 2;
      const waveAlpha = Math.max(0.04, 0.12 * Math.min(1, intensity));
      if (colorMode === "normal") {
        g.globalAlpha = waveAlpha;
        g.strokeStyle = primaryCss;
      } else {
        g.globalAlpha = 1;
        g.strokeStyle = `rgba(255,255,255,${waveAlpha})`;
      }
      const sliceWidth = width / (timeBuffer.length || 1);
      let tx = 0;
      const waveStep = lowPower ? 6 : 2;
      for (let i = 0; i < timeBuffer.length; i += waveStep) {
        const vv = timeBuffer[i] / 128.0 - 1.0;
        const wy =
          height / 2 + vv * (height / 3) * Math.min(1.4, 0.6 + intensity * 0.6);
        if (i === 0) g.moveTo(tx, wy);
        else g.lineTo(tx, wy);
        tx += sliceWidth * Math.max(1, waveStep);
      }
      g.stroke();
      g.globalAlpha = 1;

      if (!lowPower) {
        for (
          let i = 0;
          i < barsCount;
          i += Math.max(4, Math.floor(8 / Math.max(1, intensity)))
        ) {
          const v = freqBuffer[i * step] / 255;
          if (v < 0.06) continue;
          const cx = (width / barsCount) * i + width / barsCount / 2;
          const cy = height - v * (height * 0.9) - 12;
          g.beginPath();
          if (colorMode === "normal") {
            g.globalAlpha = 0.5 * v;
            g.fillStyle = primaryCss;
            g.shadowColor = primaryCss;
          } else {
            const sparkleColor = `hsla(${Math.round((i / barsCount) * 360 + hueShift)},100%,70%,${0.85 * v})`;
            g.globalAlpha = 1;
            g.fillStyle = sparkleColor as CanvasFillStrokeStyles["fillStyle"];
            g.shadowColor = sparkleColor as string;
          }
          g.shadowBlur = 36 * v * intensity * shadowMult;
          g.fillRect(cx - 3, cy - 3, 6, 6);
          g.globalAlpha = 1;
        }
      } else {
        for (
          let i = 0;
          i < barsCount;
          i += Math.max(8, Math.floor(12 / Math.max(1, intensity)))
        ) {
          const v = freqBuffer[i * step] / 255;
          if (v < 0.12) continue;
          const cx = (width / barsCount) * i + width / barsCount / 2;
          const cy = height - v * (height * 0.9) - 8;
          g.beginPath();
          g.globalAlpha = 0.35 * v;
          g.fillStyle = primaryCss;
          g.fillRect(cx - 2, cy - 2, 4, 4);
          g.globalAlpha = 1;
        }
      }

      g.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", onResize);
      audioEl.removeEventListener("play", resumeCtx);
      audioEl.removeEventListener("playing", resumeCtx);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, audioEl, canvasEl, graphTick, JSON.stringify(mergedOptions)]);
}
