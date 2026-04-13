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

import type { ChildProcess } from "child_process";
import os from "os";

function parseNiceValue(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(-20, Math.min(19, Math.floor(parsed)));
}

const POSIX_BACKGROUND_NICE = parseNiceValue(
  process.env.BACKGROUND_PROCESS_NICE,
  10,
);

export function applyBackgroundProcessPriority(processRef: ChildProcess) {
  const pid = processRef.pid;
  if (!pid || pid <= 0) return;

  try {
    if (process.platform === "win32") {
      os.setPriority(pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
      return;
    }

    os.setPriority(pid, POSIX_BACKGROUND_NICE);
  } catch {
    // Some environments do not allow changing process priority. Keep execution best-effort.
  }
}
