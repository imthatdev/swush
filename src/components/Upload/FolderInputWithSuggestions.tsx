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

"use client";

import { IconX } from "@tabler/icons-react";
import { FolderMeta, TagMeta } from "@/types";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useMemo, useRef } from "react";
import { getBadgeColorStyles } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

export function filterStartsWith(options: string[], q: string, limit = 6) {
  const qq = q.trim().toLowerCase();
  if (!qq) return options.slice(0, limit);
  const starts = options.filter((o) => o.toLowerCase().startsWith(qq));
  const rest = options.filter(
    (o) => !o.toLowerCase().startsWith(qq) && o.toLowerCase().includes(qq)
  );
  return [...starts, ...rest].slice(0, limit);
}

export function normalizeTag(s: string): string {
  const v = typeof s === "string" ? s : s == null ? "" : String(s);
  return v.trim().toLowerCase();
}

function normalizeFolder(s: string): string {
  const v = typeof s === "string" ? s : s == null ? "" : String(s);
  return v.trim().replace(/\s+/g, " ").toLowerCase();
}

function capitalizeFirst(s: string): string {
  if (!s) return "";
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

export function formatTag(s: string) {
  const n = normalizeTag(s);
  return n ? n[0].toUpperCase() + n.slice(1) : "";
}

export function SuggestItem({
  text,
  onClick,
}: {
  text: string;
  onClick: (v: string) => void;
}) {
  return (
    <Button
      variant="ghost"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick(text);
      }}
      className="w-full text-left px-3 py-1.5 hover:bg-muted rounded-md transition"
    >
      {text}
    </Button>
  );
}

export function FolderInputWithSuggestions({
  id,
  label,
  value,
  onChange,
  focused,
  setFocused,
  folders,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  focused: boolean;
  setFocused: (v: boolean) => void;
  folders: FolderMeta[];
  placeholder: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          value={capitalizeFirst(value)}
          onChange={(e) =>
            onChange(capitalizeFirst(normalizeFolder(e.target.value)))
          }
          onFocus={() => setFocused(true)}
          onBlur={() => {
            onChange(capitalizeFirst(normalizeFolder(value)));
            setFocused(false);
          }}
          placeholder={placeholder}
        />
        {focused && value.trim() && folders.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-sm">
            {(() => {
              const uniq = Array.from(
                new Map(
                  folders.map((f) => [normalizeFolder(f.name), f.name])
                ).values()
              );
              return filterStartsWith(uniq, value);
            })()
              .filter(
                (n) => n && n.toLowerCase() !== value.trim().toLowerCase()
              )
              .map((name) => (
                <SuggestItem
                  key={name}
                  text={capitalizeFirst(name)}
                  onClick={(v) => {
                    onChange(capitalizeFirst(normalizeFolder(v)));
                    setFocused(false);
                  }}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TagChipsInput({
  id,
  label,
  chips,
  setChips,
  draft,
  setDraft,
  focused,
  setFocused,
  availableTags,
  showHint = true,
}: {
  id: string;
  label: string;
  chips: string[];
  setChips: (fn: (prev: string[]) => string[]) => void;
  draft: string;
  setDraft: (v: string) => void;
  focused: boolean;
  setFocused: (v: boolean) => void;
  availableTags: TagMeta[];
  showHint?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const tagColorMap = useMemo(
    () =>
      new Map(
        availableTags.map((tag) => [normalizeTag(tag.name), tag.color ?? null])
      ),
    [availableTags]
  );

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <div
          className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border bg-popover px-3 py-2 text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 shadow-sm"
          onClick={() => inputRef.current?.focus()}
          role="textbox"
          aria-labelledby={id}
        >
          {chips.map((t) => {
            const colorStyles = getBadgeColorStyles(
              tagColorMap.get(normalizeTag(t))
            );
            return (
              <Badge
                key={t}
                variant="default"
                className={cn("rounded-full", colorStyles?.className)}
                style={colorStyles?.style}
              >
                {formatTag(t)}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-background/50 -mr-1"
                  onClick={() =>
                    setChips((prev) => prev.filter((x) => x !== t))
                  }
                  aria-label={`Remove ${t}`}
                >
                  <IconX size={12} />
                </button>
              </Badge>
            );
          })}
          <input
            id={id}
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={chips.length ? "Add more…" : "e.g. work"}
            className="min-w-[8ch] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              const commit = () => {
                const v = normalizeTag(draft);
                if (!v) return;
                setChips((prev) => {
                  const set = new Set(prev.map(normalizeTag));
                  if (!set.has(v)) set.add(v);
                  return Array.from(set);
                });
                setDraft("");
              };
              if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Backspace" && !draft && chips.length) {
                setChips((prev) => prev.slice(0, -1));
              }
            }}
          />
        </div>

        {focused && draft.trim() && availableTags.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-sm">
            {filterStartsWith(
              availableTags
                .map((t) => t.name)
                .filter((n) => {
                  const nn = normalizeTag(n);
                  return (
                    !chips.map(normalizeTag).includes(nn) &&
                    nn !== normalizeTag(draft)
                  );
                }),
              draft
            ).map((name) => (
              <SuggestItem
                key={name}
                text={name}
                onClick={(v) => {
                  const nv = normalizeTag(v);
                  setChips((prev) => {
                    const set = new Set(prev.map(normalizeTag));
                    set.add(nv);
                    return Array.from(set);
                  });
                  setDraft("");
                  setFocused(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showHint && (
        <span className="text-[11px] text-muted-foreground">
          Press Enter or comma to add. We’ll auto‑create missing tags on upload.
        </span>
      )}
    </div>
  );
}
