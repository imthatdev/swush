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

const ANILIST_GQL = "https://graphql.anilist.co";

export type AniListImportItem = {
  provider: "anilist";
  providerId: string;
  title?: string;
  titleEnglish?: string | null;
  titleRomaji?: string | null;
  mediaType: "anime";
  posterPath?: string | null;
  year?: number | null;
  rating?: number | null;
  progress?: number | null;
  updatedAt?: number | null;
  status?: string;
};

type AniListResponse = {
  data?: {
    MediaListCollection?: {
      lists?: Array<{
        entries?: Array<{
          score?: number | null;
          progress?: number | null;
          updatedAt?: number | null;
          media?: {
            id: number;
            title?: { romaji?: string | null; english?: string | null } | null;
            coverImage?: { large?: string | null } | null;
            startDate?: { year?: number | null } | null;
          } | null;
        }>;
      }>;
    };
  };
};

type AniListViewerResponse = {
  data?: {
    Viewer?: {
      id?: number | null;
      name?: string | null;
    } | null;
  };
};

async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  accessToken?: string,
): Promise<T> {
  const res = await fetch(ANILIST_GQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`anilist error: ${res.status}`);
  return (await res.json()) as T;
}

function mapAniListItems(json: AniListResponse): AniListImportItem[] {
  const lists = json.data?.MediaListCollection?.lists ?? [];
  const items: AniListImportItem[] = [];
  for (const list of lists) {
    for (const entry of list.entries ?? []) {
      const m = entry.media;
      if (!m) continue;
      items.push({
        provider: "anilist",
        providerId: String(m.id),
        title: m.title?.english || m.title?.romaji || "Untitled",
        titleEnglish: m.title?.english ?? null,
        titleRomaji: m.title?.romaji ?? null,
        mediaType: "anime",
        posterPath: m.coverImage?.large || null,
        year: m.startDate?.year ?? null,
        rating: entry.score ? Math.round(entry.score) : null,
        progress:
          typeof entry.progress === "number"
            ? Math.max(0, Math.floor(entry.progress))
            : null,
        updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : null,
      });
    }
  }
  const seen = new Set<string>();
  return items.filter((x) =>
    seen.has(x.providerId) ? false : (seen.add(x.providerId), true),
  );
}

async function anilistFetchUserAnimeById(
  userId: number,
  accessToken?: string,
  status?: string,
): Promise<AniListImportItem[]> {
  const query = `
    query($userId: Int, $status: MediaListStatus) {
      MediaListCollection(userId: $userId, type: ANIME, status: $status) {
        lists { 
          entries { 
            progress
            updatedAt
            score
            media { id title { romaji english } coverImage { large } startDate { year } } 
          } 
        }
      }
    }
  `;
  const json = await anilistRequest<AniListResponse>(
    query,
    { userId, status },
    accessToken,
  );
  return mapAniListItems(json);
}

export async function anilistFetchUserAnime(
  username: string,
): Promise<AniListImportItem[]> {
  const query = `
    query($name: String) {
      MediaListCollection(userName: $name, type: ANIME) {
        lists { 
          entries { 
            progress
            updatedAt
            score
            media { id title { romaji english } coverImage { large } startDate { year } } 
          } 
        }
      }
    }
  `;
  const json = await anilistRequest<AniListResponse>(query, { name: username });
  return mapAniListItems(json);
}

export async function anilistFetchViewerAnime(
  accessToken: string,
): Promise<AniListImportItem[]> {
  const query = `query { Viewer { id name } }`;
  const viewer = await anilistRequest<AniListViewerResponse>(
    query,
    {},
    accessToken,
  );
  const viewerId = viewer.data?.Viewer?.id;
  if (!viewerId) throw new Error("AniList viewer not available");
  return anilistFetchUserAnimeById(viewerId, accessToken);
}

export async function anilistFetchViewerWatching(
  accessToken: string,
): Promise<AniListImportItem[]> {
  const query = `query { Viewer { id name } }`;
  const viewer = await anilistRequest<AniListViewerResponse>(
    query,
    {},
    accessToken,
  );
  const viewerId = viewer.data?.Viewer?.id;
  if (!viewerId) throw new Error("AniList viewer not available");
  return anilistFetchUserAnimeById(viewerId, accessToken, "CURRENT");
}
