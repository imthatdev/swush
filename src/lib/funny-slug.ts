/*
 *   Copyright (c) 2025 Laith Alkhaddam aka Iconical.
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

import { db } from "@/db/client";
import { files, folders, shortLinks } from "@/db/schemas/core-schema";
import { eq } from "drizzle-orm";

const A = [
  "Laith",
  "Legendary",
  "Epic",
  "MemeLord",
  "Sugoi",
  "UwU",
  "Blushy",
  "Iconic",
  "Sleepy",
  "Creative",
  "Playful",
  "Curious",
  "Witty",
  "Brave",
  "Thoughtful",
  "Clever",
  "Patient",
  "Obsessive",
  "Passionate",
  "Innovative",
  "Chill",
  "Focused",
  "Kind",
  "Energetic",
  "Calm",
  "Bold",
  "Reflective",
  "Chaotic",
  "Queenly",
  "Demonic",
  "Angelical",
  "Dreamy",
  "Coding",
  "Gothic",
  "Royal",
  "Spicy",
  "Cosmic",
];
const B = [
  "Obsessive",
  "Affectionate",
  "Possessive",
  "Clever",
  "Loyal",
  "Steady",
  "Gentle",
  "Mysterious",
  "Dedicated",
  "Ambitious",
  "Patient",
  "Fearless",
  "Quiet",
  "Bold",
  "Vibrant",
  "Calm",
  "Focused",
  "Energetic",
  "Playful",
  "Sincere",
  "Demon",
  "Angel",
  "Fox",
  "Wolf",
  "Vampire",
  "Zombie",
  "Pirate",
  "Overlord",
  "Slayer",
  "Champion",
  "Senpai",
];
const C = [
  "Vampire",
  "Dev",
  "Cat",
  "King",
  "Dragon",
  "Wizard",
  "Coder",
  "Fox",
  "Wolf",
  "Knight",
  "Ninja",
  "Samurai",
  "Pirate",
  "Raven",
  "Lion",
  "Bear",
  "Tiger",
  "Phoenix",
  "Ghost",
  "Shadow",
  "Demon",
  "Angel",
  "Fox",
  "Wolf",
  "Vampire",
  "Zombie",
  "Pirate",
  "Overlord",
  "Slayer",
  "Champion",
  "Senpai",
];
const D = [
  "Vibe",
  "Quest",
  "Saga",
  "Groove",
  "Verse",
  "Bloom",
  "Spark",
  "Pulse",
  "Jam",
  "Riddle",
  "Chronicle",
  "Drift",
  "Echo",
  "Whisper",
  "Charm",
  "Flux",
  "Twist",
  "Fable",
  "Nexus",
  "Wink",
  "Demon",
  "Angel",
  "Fox",
  "Wolf",
  "Vampire",
  "Zombie",
  "Pirate",
  "Overlord",
  "Slayer",
  "Champion",
  "Senpai",
];

const rand = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)] as T;

export type SlugTable = "files" | "folders" | "shortLinks";

async function existsIn(table: SlugTable, slug: string): Promise<boolean> {
  switch (table) {
    case "files": {
      const hit = await db.query.files.findFirst({
        where: eq(files.slug, slug),
      });
      return !!hit;
    }
    case "folders": {
      const hit = await db.query.folders.findFirst({
        where: eq(folders.shareSlug, slug),
      });
      return !!hit;
    }
    case "shortLinks": {
      const hit = await db.query.shortLinks.findFirst({
        where: eq(shortLinks.slug, slug),
      });
      return !!hit;
    }
    default:
      return false;
  }
}

export async function slugTaken(
  slug: string,
  table: SlugTable,
): Promise<boolean> {
  return existsIn(table, slug);
}

export async function generateFunnySlug(
  primary: SlugTable,
  maxTries = 25,
): Promise<string> {
  for (let i = 0; i < maxTries; i++) {
    const base = `${rand(A)}${rand(B)}${rand(C)}${rand(D)}`;
    const suffix = i === 0 ? "" : `${Math.floor(Math.random() * 999)}`;
    const candidate = `${base}${suffix}`;
    const taken = await slugTaken(candidate, primary);
    if (!taken) return candidate;
  }

  let candidate = `${rand(A)}${rand(B)}${Date.now().toString(36)}`;
  while (await slugTaken(candidate, primary)) {
    candidate = `${candidate}${Math.floor(Math.random() * 99)}`;
  }
  return candidate;
}
