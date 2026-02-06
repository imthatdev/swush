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

import { useState, useEffect } from "react";
import { toast } from "sonner";

export function useLocalStorageBoolean(key: string, defaultValue = false) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(key);
        if (stored === "1") return true;
        else if (stored === "0") return false;
      }
    } catch {
      toast.error("Failed to access the value.");
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {
      toast.error("Failed to save the value.");
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useLocalStorageString(key: string, defaultValue: string) {
  const [value, setValue] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return stored;
    } catch {
      toast.error("Failed to access the value.");
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      toast.error("Failed to save the value.");
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useLocalStorageNumber(key: string, defaultValue: number) {
  const [value, setValue] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
          const parsed = Number(stored);
          if (Number.isFinite(parsed)) return parsed;
        }
      }
    } catch {
      toast.error("Failed to access the value.");
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      toast.error("Failed to save the value.");
    }
  }, [key, value]);

  return [value, setValue] as const;
}
