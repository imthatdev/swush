import { timingSafeEqual } from "crypto";

export function safeCompare(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
