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
