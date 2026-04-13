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

import "server-only";

import { performance } from "perf_hooks";

type RuntimeSignalSnapshot = {
  eventLoopLagP95Ms: number;
  eventLoopLagAvgMs: number;
  apiLatencyP95Ms: number;
  apiLatencyAvgMs: number;
  eventLoopSamples: number;
  apiLatencySamples: number;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function pushBounded(buffer: number[], value: number, maxSize: number) {
  buffer.push(value);
  if (buffer.length > maxSize) {
    buffer.shift();
  }
}

function average(values: number[]) {
  if (!values.length) return 0;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(0, Math.min(1, p / 100));
  const index = Math.floor((sorted.length - 1) * rank);
  return sorted[index] ?? 0;
}

const EVENT_LOOP_SAMPLE_INTERVAL_MS = parsePositiveInt(
  process.env.EVENT_LOOP_SAMPLE_INTERVAL_MS,
  500,
);
const EVENT_LOOP_SAMPLE_WINDOW = parsePositiveInt(
  process.env.EVENT_LOOP_SAMPLE_WINDOW,
  120,
);
const API_LATENCY_SAMPLE_WINDOW = parsePositiveInt(
  process.env.API_LATENCY_SAMPLE_WINDOW,
  300,
);

const eventLoopLagSamples: number[] = [];
const apiLatencySamples: number[] = [];

let lastTick = performance.now();

const eventLoopTimer = setInterval(() => {
  const now = performance.now();
  const expected = lastTick + EVENT_LOOP_SAMPLE_INTERVAL_MS;
  const lag = Math.max(0, now - expected);
  lastTick = now;
  pushBounded(eventLoopLagSamples, lag, EVENT_LOOP_SAMPLE_WINDOW);
}, EVENT_LOOP_SAMPLE_INTERVAL_MS);

eventLoopTimer.unref();

export function recordApiLatencySample(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  pushBounded(apiLatencySamples, durationMs, API_LATENCY_SAMPLE_WINDOW);
}

export function getRuntimeSignalSnapshot(): RuntimeSignalSnapshot {
  return {
    eventLoopLagP95Ms: percentile(eventLoopLagSamples, 95),
    eventLoopLagAvgMs: average(eventLoopLagSamples),
    apiLatencyP95Ms: percentile(apiLatencySamples, 95),
    apiLatencyAvgMs: average(apiLatencySamples),
    eventLoopSamples: eventLoopLagSamples.length,
    apiLatencySamples: apiLatencySamples.length,
  };
}
