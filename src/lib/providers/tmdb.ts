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

import { getIntegrationSecrets } from "@/lib/server/runtime-settings";

const TMDB_BASE = "https://api.themoviedb.org/3";

const allowedTypes = ["movie", "tv"] as const;

function parsePositiveInt(value: string, field: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid ${field}`);
  }
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new Error(`Invalid ${field}`);
  }
  return n;
}

function tmdbUrl(pathname: string, apiKey: string) {
  const url = new URL(`${TMDB_BASE}${pathname}`);
  url.searchParams.set("api_key", apiKey);
  return url.toString();
}

function img(path?: string | null, size: string = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export type TMDBSearchItem = {
  provider: "tmdb";
  mediaType: "movie" | "tv";
  providerId: string;
  title: string;
  year?: number | null;
  poster?: string | null;
  rating?: number | null;
  overview?: string | null;
};

export async function tmdbSearchMulti(q: string): Promise<TMDBSearchItem[]> {
  const { tmdbApiKey } = await getIntegrationSecrets();
  if (!tmdbApiKey) throw new Error("TMDB API key is not set");
  const url = new URL(`${TMDB_BASE}/search/multi`);
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("api_key", tmdbApiKey);

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`tmdb search failed: ${res.status}`);
  const json = await res.json();

  const items: TMDBSearchItem[] = (json.results || [])
    .filter(
      (r: { media_type: string }) =>
        r.media_type === "movie" || r.media_type === "tv",
    )
    .map(
      (r: {
        media_type: "movie" | "tv";
        id: number;
        title?: string;
        name?: string;
        release_date?: string;
        first_air_date?: string;
        poster_path?: string | null;
        vote_average?: number;
        overview?: string;
      }) => ({
        provider: "tmdb" as const,
        mediaType: r.media_type,
        providerId: String(r.id),
        title: r.title || r.name || "Untitled",
        year: r.release_date
          ? Number((r.release_date as string).slice(0, 4))
          : r.first_air_date
            ? Number((r.first_air_date as string).slice(0, 4))
            : null,
        poster: img(r.poster_path),
        rating:
          typeof r.vote_average === "number"
            ? Math.round(r.vote_average * 10) / 10
            : null,
        overview: r.overview || null,
      }),
    );

  return items;
}

export async function tmdbGetTitle(type: "movie" | "tv", id: string) {
  const { tmdbApiKey } = await getIntegrationSecrets();

  if (!tmdbApiKey) throw new Error("TMDB API key is not set");

  if (!allowedTypes.includes(type)) {
    throw new Error("Invalid type");
  }

  const safeId = parsePositiveInt(id, "id");

  const res = await fetch(tmdbUrl(`/${type}/${safeId}`, tmdbApiKey), {
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`tmdb get ${type} failed: ${res.status}`);
  const r = await res.json();

  return {
    provider: "tmdb" as const,
    mediaType: type,
    providerId: String(r.id),
    title: r.title || r.name || "Untitled",
    year: r.release_date
      ? Number((r.release_date as string).slice(0, 4))
      : r.first_air_date
        ? Number((r.first_air_date as string).slice(0, 4))
        : null,
    poster: img(r.poster_path),
    rating:
      typeof r.vote_average === "number"
        ? Math.round(r.vote_average * 10) / 10
        : null,
    overview: r.overview || null,
    seasons:
      type === "tv"
        ? (r.seasons || []).map(
            (s: {
              season_number: number;
              name: string;
              episode_count: number;
              poster_path?: string | null;
            }) => ({
              season: s.season_number,
              name: s.name,
              episodeCount: s.episode_count,
              poster: img(s.poster_path, "w300"),
            }),
          )
        : undefined,
    number_of_seasons: r.number_of_seasons ?? undefined,
    number_of_episodes: r.number_of_episodes ?? undefined,
    originCountry: r.origin_country || undefined,
    genreIds: (r.genres || []).map((g: { id: number }) => g.id),
  };
}

export async function tmdbGetSeasonEpisodes(
  tvId: string,
  seasonNumber: number,
) {
  const { tmdbApiKey } = await getIntegrationSecrets();
  if (!tmdbApiKey) throw new Error("TMDB API key is not set");
  const safeTvId = parsePositiveInt(tvId, "tvId");
  if (!Number.isSafeInteger(seasonNumber) || seasonNumber <= 0) {
    throw new Error("Invalid seasonNumber");
  }
  const res = await fetch(
    tmdbUrl(`/tv/${safeTvId}/season/${seasonNumber}`, tmdbApiKey),
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`tmdb get season failed: ${res.status}`);
  const r = await res.json();
  return (r.episodes || []).map(
    (e: {
      id: number;
      season_number: number;
      episode_number: number;
      name: string;
      still_path?: string | null;
      air_date?: string | null;
    }) => ({
      id: String(e.id),
      season: Number(e.season_number),
      episode: Number(e.episode_number),
      name: e.name,
      still: img(e.still_path, "w300"),
      airDate: e.air_date || null,
    }),
  );
}
