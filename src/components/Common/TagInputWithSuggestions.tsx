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

import { useMemo, useState } from "react";
import { IconTag } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { formatTagName, normalizeTagName } from "@/lib/tag-names";

export default function TagInputWithSuggestions({
  value,
  onChange,
  availableTags,
  tagColors,
  placeholder = "Type to add tags...",
}: {
  value: string;
  onChange: (value: string) => void;
  availableTags: string[];
  tagColors?: Record<string, string | null>;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const availableSet = useMemo(
    () => new Set(availableTags.map((t) => normalizeTagName(t)).filter(Boolean)),
    [availableTags],
  );
  const tokens = useMemo(() => value.split(","), [value]);
  const chips = useMemo(() => {
    const normalized = tokens.map((t) => normalizeTagName(t)).filter(Boolean);
    const normalizedRaw = normalizeTagName(rawInput);
    const chipTokens =
      focused && normalizedRaw && normalized[normalized.length - 1] === normalizedRaw
        ? normalized.slice(0, -1)
        : normalized;
    return Array.from(new Set(chipTokens)).filter((t) => availableSet.has(t));
  }, [focused, tokens, availableSet, rawInput]);
  const lastToken = useMemo(() => normalizeTagName(rawInput), [rawInput]);

  const suggestions = useMemo(() => {
    if (!lastToken) return [];
    const lower = lastToken.toLowerCase();
    return availableTags
      .filter((t) => t.toLowerCase().startsWith(lower))
      .filter((t) => !chips.includes(t))
      .slice(0, 6);
  }, [availableTags, lastToken, chips]);

  const addChip = (nextTag: string) => {
    const normalized = normalizeTagName(nextTag);
    if (!normalized || !availableSet.has(normalized)) return;
    const next = Array.from(new Set([...chips, normalized])).join(", ");
    onChange(next ? `${next}, ` : "");
    setRawInput("");
  };

  const removeTag = (tag: string) => {
    const filtered = chips.filter((t) => t !== tag);
    const next = filtered.join(", ");
    const combined = rawInput ? `${next}${next ? ", " : ""}${rawInput}` : next;
    onChange(combined);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1.5">
        {chips.map((t) => {
          const styles = getBadgeColorStyles(tagColors?.[t]);
          return (
            <Badge
              key={t}
              variant="outline"
              className={cn("gap-1", styles?.className)}
              style={styles?.style}
            >
              <IconTag className="h-3.5 w-3.5" />
              {formatTagName(t)}
              <button
                type="button"
                className="ml-1 text-muted-foreground hover:text-foreground"
                onClick={() => removeTag(t)}
                aria-label={`Remove ${t}`}
              >
                ×
              </button>
            </Badge>
          );
        })}
        <input
          value={rawInput}
          onChange={(e) => {
            const nextRaw = e.target.value;
            setRawInput(nextRaw);
            const prefix = chips.join(", ");
            onChange(prefix ? `${prefix}, ${nextRaw}` : nextRaw);
          }}
          onKeyDown={(e) => {
            if (e.key === "," || e.key === "Enter") {
              e.preventDefault();
              addChip(rawInput);
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            const trimmed = rawInput.trim();
            if (trimmed) {
              const normalized = normalizeTagName(trimmed);
              if (normalized && availableSet.has(normalized)) {
                addChip(trimmed);
              } else {
                const next = chips.join(", ");
                onChange(next);
                setRawInput("");
              }
            } else {
              setRawInput("");
            }
            setFocused(false);
          }}
          placeholder={placeholder}
          className="min-w-30 flex-1 bg-transparent text-sm outline-none"
          aria-label="Tags"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((t) => {
            const styles = getBadgeColorStyles(tagColors?.[t]);
            return (
              <button
                type="button"
                key={t}
                className="rounded-full"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addChip(t);
                }}
              >
                <Badge
                  variant="outline"
                  className={cn("gap-1", styles?.className)}
                  style={styles?.style}
                >
                  <IconTag className="h-3.5 w-3.5" />
                  {formatTagName(t)}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
