/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

import "server-only";

import pkg from "../../package.json";

export type VersionInfo = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
};

function parseSemver(v: string): [number, number, number] | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function isNewer(latest: string, current: string) {
  const a = parseSemver(latest);
  const b = parseSemver(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

async function getLatestVersionFromGitHub(): Promise<string | null> {
  try {
    const res = await fetch(
      "https://api.github.com/repos/imthatdev/swush/releases/latest",
      { next: { revalidate: 60 * 60 } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: string };
    const tag = data?.tag_name || "";
    return tag.startsWith("v") ? tag.slice(1) : tag || null;
  } catch {
    return null;
  }
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const currentVersion = (pkg as { version?: string })?.version || "dev";
  const latestVersion = await getLatestVersionFromGitHub();
  const updateAvailable =
    !!latestVersion &&
    !!parseSemver(currentVersion) &&
    isNewer(latestVersion, currentVersion);

  return { currentVersion, latestVersion, updateAvailable };
}
