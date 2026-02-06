import type { CSSProperties } from "react";

export const TAG_COLOR_PALETTE = [
  { name: "Rose", value: "#f43f5e" },
  { name: "Orange", value: "#fb923c" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Lime", value: "#84cc16" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Slate", value: "#64748b" },
];

export function normalizeHexColor(input?: string | null): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return null;
  const hex = raw.startsWith("#") ? raw : `#${raw}`;
  const match = hex.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const body = match[1];
  if (body.length === 3) {
    const expanded = body
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return `#${body.toLowerCase()}`;
}

export function getBadgeColorStyles(color?: string | null): {
  className: string;
  style: CSSProperties;
} | null {
  const normalized = normalizeHexColor(color);
  if (!normalized) return null;
  return {
    className:
      "border-[color-mix(in_srgb,var(--swush-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--swush-color)_18%,transparent)] text-[var(--swush-color)]",
    style: { "--swush-color": normalized } as CSSProperties,
  };
}
