"use client";

import { toast } from "sonner";
import { config, util } from "zod/v4/core";

if (typeof window !== "undefined") {
  config({ jitless: true });
  try {
    Object.defineProperty(util.allowsEval, "value", { value: false });
  } catch {
    toast.error("Ignore the warning");
  }
}

export default function ZodCspPatch() {
  return null;
}
