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

type JobRunnerRole = "all" | "api" | "worker";

export type AdminQueueHealthRow = {
  key: string;
  label: string;
  queueDepth: number;
  delayed: number;
  processing: number;
  activeWorkers: number;
  waitAvgSec: number;
  waitP95Sec: number;
  failureRate24h: number;
  failed24h: number;
  succeeded24h: number;
  deadLetter: number;
};

export type AdminQueueHealth = {
  generatedAt: string;
  runnerRole: JobRunnerRole;
  workload: {
    adaptiveEnabled: boolean;
    cpu: {
      baseCapacity: number;
      effectiveCapacity: number;
      inUse: number;
      waiting: number;
    };
    io: {
      baseCapacity: number;
      effectiveCapacity: number;
      inUse: number;
      waiting: number;
    };
    signals: {
      eventLoopLagP95Ms: number;
      eventLoopLagAvgMs: number;
      apiLatencyP95Ms: number;
      apiLatencyAvgMs: number;
      eventLoopSamples: number;
      apiLatencySamples: number;
    };
  };
  queues: AdminQueueHealthRow[];
};
