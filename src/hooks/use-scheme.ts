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

"use client";

import { useEffect, useState } from "react";

const SCHEME_KEY = "swush-scheme";
const SCHEMES = [
  "Default",
  "Amoled",
  "Aurora",
  "Bubblegum",
  "Cedar",
  "Minimal",
  "Scarlet",
  "Dracula",
  "Emerald",
  "Github-Dimmed",
  "Github-V1",
  "Gruvbox",
  "Ember",
  "Lagoon",
  "Mint",
  "Nord",
  "Obsidian",
  "Orchid",
  "Rainbow",
  "Rose",
  "Palm",
  "Crimson",
  "Sapphire",
  "Solarized",
  "Sunset",
  "Violet",
  "Neon-Noir",
  "Oceanic-Deep",
  "Sakura-Bloom",
  "Y2K-Pastel",
  "Forest-Emerald",
  "Glasslight",
  "the-devil",
  "the-angel",
] as const;

export type Scheme = (typeof SCHEMES)[number];

const SCHEMES_PREVIEW: Record<Scheme, string> = {
  Default: "#7164DF",
  Amoled: "#000000",
  Aurora: "#21B1C7",
  Bubblegum: "#FF6F91",
  Cedar: "#529420",
  Minimal: "#E0E0E0",
  Scarlet: "#FF2400",
  Dracula: "#6272A4",
  Emerald: "#50C878",
  "Github-Dimmed": "#6E7681",
  "Github-V1": "#24292F",
  Gruvbox: "#D79921",
  Ember: "#FF4500",
  Lagoon: "#00A3E0",
  Mint: "#98FF98",
  Nord: "#88C0D0",
  Obsidian: "#1B1B1B",
  Orchid: "#DA70D6",
  Rainbow: "#ff5f6d",
  Rose: "#ED3E51",
  Palm: "#D71CD0",
  Crimson: "#DC143C",
  Sapphire: "#0F52BA",
  Solarized: "#268BD2",
  Sunset: "#FF5E3A",
  Violet: "#8A2BE2",
  "Neon-Noir": "#7E7DFF",
  "Oceanic-Deep": "#00A5B5",
  "Sakura-Bloom": "#FFB7C5",
  "Y2K-Pastel": "#FFD1DC",
  "Forest-Emerald": "#228B22",
  Glasslight: "#E0FFFF",
  "the-devil": "#FF0000",
  "the-angel": "#FFFFFF",
};

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-");
}

function toToken(s: Scheme): string {
  return normalizeToken(s);
}

function fromToken(token: string | null): Scheme {
  if (!token) return "Default";
  const t = normalizeToken(token);
  const found = SCHEMES.find((s) => normalizeToken(s) === t);
  return found ?? "Default";
}

export function useColorScheme() {
  const [scheme, setScheme] = useState<Scheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SCHEME_KEY);
      return fromToken(stored);
    }
    return "Default";
  });

  useEffect(() => {
    const token = toToken(scheme);
    document.documentElement.dataset.theme = token;
    localStorage.setItem(SCHEME_KEY, token);
  }, [scheme]);

  return { scheme, setScheme, SCHEMES, SCHEMES_PREVIEW };
}
