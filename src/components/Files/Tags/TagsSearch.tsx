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

"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type Props = {
  defaultValue?: string;
  placeholder?: string;
  className?: string;

  onChange?: (value: string) => void;
  debounceMs?: number;
};

export default function TagsSearch({
  defaultValue = "",
  placeholder = "Search tags",
  className,
  onChange,
  debounceMs = 200,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName ?? "";
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable;
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!onChange) return;
    const t = setTimeout(() => onChange(value), debounceMs);
    return () => clearTimeout(t);
  }, [value, onChange, debounceMs]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      className={className}
      aria-label="Search tags"
    />
  );
}
