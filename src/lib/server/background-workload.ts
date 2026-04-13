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

import os from "os";
import { getRuntimeSignalSnapshot } from "@/lib/server/runtime-signals";

type Lane = "cpu" | "io";

type Waiter = {
  slots: number;
  resolve: () => void;
};

type LaneState = {
  baseCapacity: number;
  effectiveCapacity: number;
  inUse: number;
  waiting: number;
};

export type BackgroundWorkloadState = {
  adaptiveEnabled: boolean;
  lanes: Record<Lane, LaneState>;
  signals: ReturnType<typeof getRuntimeSignalSnapshot>;
};

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  min = 1,
) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.floor(parsed);
}

function detectCpuCount() {
  if (typeof os.availableParallelism === "function") {
    return Math.max(1, os.availableParallelism());
  }
  return Math.max(1, os.cpus()?.length || 1);
}

const detectedCpuCount = detectCpuCount();
const reservedCores = parsePositiveInt(
  process.env.BACKGROUND_RESERVED_CORES,
  2,
  0,
);
const defaultCpuSlots = Math.max(
  1,
  Math.min(4, detectedCpuCount - reservedCores),
);
const defaultIoSlots = Math.max(2, Math.min(6, defaultCpuSlots + 1));

const adaptiveThrottleEnabled =
  (process.env.BACKGROUND_ADAPTIVE_THROTTLE || "true").trim().toLowerCase() !==
  "false";
const adaptiveMinScale = (() => {
  const parsed = Number(process.env.BACKGROUND_ADAPTIVE_MIN_SCALE);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0.35;
  return Math.max(0.1, Math.min(1, parsed));
})();
const targetEventLoopLagMs = (() => {
  const parsed = Number(process.env.BACKGROUND_TARGET_EVENT_LOOP_LAG_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60;
  return Math.max(5, Math.floor(parsed));
})();
const targetApiP95LatencyMs = (() => {
  const parsed = Number(process.env.BACKGROUND_TARGET_API_P95_MS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 250;
  return Math.max(20, Math.floor(parsed));
})();

const laneBaseCapacity: Record<Lane, number> = {
  cpu: parsePositiveInt(process.env.BACKGROUND_CPU_SLOTS, defaultCpuSlots),
  io: parsePositiveInt(process.env.BACKGROUND_IO_SLOTS, defaultIoSlots),
};

const laneInUse: Record<Lane, number> = {
  cpu: 0,
  io: 0,
};

const laneWaiters: Record<Lane, Waiter[]> = {
  cpu: [],
  io: [],
};

function getAdaptiveScale() {
  if (!adaptiveThrottleEnabled) return 1;

  const signals = getRuntimeSignalSnapshot();
  const lagPressure =
    signals.eventLoopLagP95Ms > 0
      ? signals.eventLoopLagP95Ms / targetEventLoopLagMs
      : 0;
  const latencyPressure =
    signals.apiLatencyP95Ms > 0
      ? signals.apiLatencyP95Ms / targetApiP95LatencyMs
      : 0;

  const pressure = Math.max(lagPressure, latencyPressure);
  if (!Number.isFinite(pressure) || pressure <= 1) return 1;

  return Math.max(adaptiveMinScale, 1 / pressure);
}

function getEffectiveLaneCapacity(lane: Lane) {
  const base = laneBaseCapacity[lane];
  const scaled = Math.floor(base * getAdaptiveScale());
  return Math.max(1, Math.min(base, scaled));
}

function clampSlots(lane: Lane, requested: number) {
  if (!Number.isFinite(requested) || requested <= 0) return 1;
  const whole = Math.floor(requested);
  return Math.max(1, Math.min(whole, getEffectiveLaneCapacity(lane)));
}

function drainLane(lane: Lane) {
  const queue = laneWaiters[lane];
  const effectiveCapacity = getEffectiveLaneCapacity(lane);
  while (queue.length > 0) {
    const next = queue[0];
    if (laneInUse[lane] + next.slots > effectiveCapacity) break;
    queue.shift();
    laneInUse[lane] += next.slots;
    next.resolve();
  }
}

async function acquireLane(lane: Lane, requestedSlots: number) {
  const slots = clampSlots(lane, requestedSlots);

  await new Promise<void>((resolve) => {
    const grant = () => resolve();
    const effectiveCapacity = getEffectiveLaneCapacity(lane);

    if (
      laneWaiters[lane].length === 0 &&
      laneInUse[lane] + slots <= effectiveCapacity
    ) {
      laneInUse[lane] += slots;
      grant();
      return;
    }

    laneWaiters[lane].push({ slots, resolve: grant });
  });

  return () => {
    laneInUse[lane] = Math.max(0, laneInUse[lane] - slots);
    drainLane(lane);
  };
}

async function withLaneSlots<T>(
  lane: Lane,
  slots: number,
  fn: () => Promise<T> | T,
): Promise<T> {
  const release = await acquireLane(lane, slots);
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function runWithBackgroundCpuSlots<T>(
  slots: number,
  fn: () => Promise<T> | T,
): Promise<T> {
  return withLaneSlots("cpu", slots, fn);
}

export async function runWithBackgroundIoSlots<T>(
  slots: number,
  fn: () => Promise<T> | T,
): Promise<T> {
  return withLaneSlots("io", slots, fn);
}

const adaptiveDrainTimer = setInterval(() => {
  if (laneWaiters.cpu.length > 0) drainLane("cpu");
  if (laneWaiters.io.length > 0) drainLane("io");
}, 750);

adaptiveDrainTimer.unref();

export function getBackgroundWorkloadState(): BackgroundWorkloadState {
  const signals = getRuntimeSignalSnapshot();

  return {
    adaptiveEnabled: adaptiveThrottleEnabled,
    lanes: {
      cpu: {
        baseCapacity: laneBaseCapacity.cpu,
        effectiveCapacity: getEffectiveLaneCapacity("cpu"),
        inUse: laneInUse.cpu,
        waiting: laneWaiters.cpu.length,
      },
      io: {
        baseCapacity: laneBaseCapacity.io,
        effectiveCapacity: getEffectiveLaneCapacity("io"),
        inUse: laneInUse.io,
        waiting: laneWaiters.io.length,
      },
    },
    signals,
  };
}
