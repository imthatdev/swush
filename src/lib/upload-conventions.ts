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

export const NAME_CONVENTIONS = [
  "original",
  "random",
  "date",
  "funny",
] as const;
export type NameConvention = (typeof NAME_CONVENTIONS)[number];

export const SLUG_CONVENTIONS = ["funny", "random", "date"] as const;
export type SlugConvention = (typeof SLUG_CONVENTIONS)[number];

export const NAME_CONVENTION_LABELS: Record<NameConvention, string> = {
  original: "Original name (e.g. yay.png)",
  random: "Random (e.g. 8f3k2d.png)",
  date: "Date (e.g. 20260118-120530.png)",
  funny: "Funny slug (e.g. LuckyPanda.png)",
};

export const SLUG_CONVENTION_LABELS: Record<SlugConvention, string> = {
  funny: "Funny slug (e.g. /v/LuckyPanda)",
  random: "Random (e.g. /v/efa3223s)",
  date: "Date (e.g. /v/20260118-120530)",
};
