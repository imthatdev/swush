export function normalizeTagName(input: string): string {
  if (typeof input !== "string") return "";
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export function formatTagName(input: string): string {
  const normalized = normalizeTagName(input);
  if (!normalized) return "";
  return normalized.replace(/(^|[\s-])([a-z])/g, (match, sep, ch) => {
    return `${sep}${String(ch).toUpperCase()}`;
  });
}
