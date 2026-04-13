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

export type RetryPlan = {
  shouldRetry: boolean;
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date | null;
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

function parseRatio(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.max(0, Math.min(parsed, 0.5));
}

const DEFAULT_MAX_ATTEMPTS = parsePositiveInt(
  process.env.JOB_RETRY_MAX_ATTEMPTS,
  5,
);
const RETRY_BASE_DELAY_MS = parsePositiveInt(
  process.env.JOB_RETRY_BASE_DELAY_MS,
  5_000,
  100,
);
const RETRY_MAX_DELAY_MS = parsePositiveInt(
  process.env.JOB_RETRY_MAX_DELAY_MS,
  10 * 60_000,
  500,
);
const RETRY_JITTER_RATIO = parseRatio(process.env.JOB_RETRY_JITTER_RATIO, 0.15);

export function resolveJobMaxAttempts(value?: number | null) {
  if (Number.isFinite(value) && (value as number) > 0) {
    return Math.floor(value as number);
  }
  return DEFAULT_MAX_ATTEMPTS;
}

export function computeRetryDelayMs(nextAttempt: number) {
  const exponent = Math.max(0, Math.floor(nextAttempt) - 1);
  const exponentialDelay = RETRY_BASE_DELAY_MS * 2 ** exponent;
  const capped = Math.min(RETRY_MAX_DELAY_MS, exponentialDelay);

  if (RETRY_JITTER_RATIO <= 0) return capped;

  const jitterSpan = capped * RETRY_JITTER_RATIO;
  const jitter = (Math.random() * 2 - 1) * jitterSpan;
  const withJitter = Math.round(capped + jitter);
  return Math.max(500, withJitter);
}

export function buildRetryPlan(params: {
  currentAttempts: number | null | undefined;
  maxAttempts: number | null | undefined;
}) {
  const attempts = Math.max(0, Math.floor(params.currentAttempts ?? 0));
  const resolvedMaxAttempts = resolveJobMaxAttempts(params.maxAttempts);
  const nextAttempt = attempts + 1;

  if (nextAttempt >= resolvedMaxAttempts) {
    return {
      shouldRetry: false,
      attempts: nextAttempt,
      maxAttempts: resolvedMaxAttempts,
      nextRunAt: null,
    } satisfies RetryPlan;
  }

  const retryDelayMs = computeRetryDelayMs(nextAttempt);

  return {
    shouldRetry: true,
    attempts: nextAttempt,
    maxAttempts: resolvedMaxAttempts,
    nextRunAt: new Date(Date.now() + retryDelayMs),
  } satisfies RetryPlan;
}
