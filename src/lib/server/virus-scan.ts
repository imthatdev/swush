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

import os from "node:os";
import path from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export class VirusScanError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isEnabled() {
  return (process.env.VIRUS_SCAN_ENABLED || "").toLowerCase() === "true";
}

function getConfig() {
  const maxBytes = Number(process.env.VIRUS_SCAN_MAX_BYTES || 10 * 1024 * 1024);
  const timeoutMs = Number(process.env.VIRUS_SCAN_TIMEOUT_MS || 10_000);
  const clamavPath = process.env.CLAMAV_PATH?.trim() || "clamscan";
  const clamavArgs = (process.env.CLAMAV_ARGS || "--no-summary")
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    maxBytes,
    timeoutMs,
    clamavPath,
    clamavArgs,
  };
}

const execFileAsync = promisify(execFile);

async function runClamAVScan(params: {
  buffer: Buffer;
  timeoutMs: number;
  clamavPath: string;
  clamavArgs: string[];
}) {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "swush-scan-"));
  const filePath = path.join(tmpDir, "upload.bin");
  await writeFile(filePath, params.buffer);

  try {
    const args = [...params.clamavArgs, filePath];
    const { stdout } = await execFileAsync(params.clamavPath, args, {
      timeout: params.timeoutMs,
    });

    const output = String(stdout || "").toLowerCase();
    if (output.includes("infected") || output.includes("found")) {
      throw new VirusScanError("File rejected by virus scan", 400);
    }
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 1) {
      throw new VirusScanError("File rejected by virus scan", 400);
    }
    if ((err as { killed?: boolean }).killed) {
      throw new VirusScanError("Virus scan timed out", 504);
    }
    if (err instanceof VirusScanError) throw err;
    throw new VirusScanError("Virus scan failed", 503);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

export async function runVirusScanIfEnabled(params: {
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
  sha256: string;
  buffer: Buffer;
}) {
  if (!isEnabled()) return;

  const { maxBytes, timeoutMs, clamavPath, clamavArgs } = getConfig();

  if (params.buffer.length > maxBytes) {
    throw new VirusScanError(
      `File exceeds virus scan max size (${maxBytes} bytes)`,
      413,
    );
  }

  await runClamAVScan({
    buffer: params.buffer,
    timeoutMs,
    clamavPath,
    clamavArgs,
  });
}
