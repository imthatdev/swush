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
      "https://api.github.com/repos/imthatdev/swush-ce/releases/latest",
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

