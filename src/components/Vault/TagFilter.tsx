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

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTagLabel } from "@/lib/helpers";

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export default function TagFilter({
  availableTags,
  selectedTags,
  onChange,
}: TagFilterProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-30 justify-between">
          <span>Tags</span>
          {selectedTags.length > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs">
              {selectedTags.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Filter by tags</span>
          {selectedTags.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <span
                role="button"
                tabIndex={0}
                onClick={() => onChange([])}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onChange([]);
                  }
                }}
              >
                Clear
              </span>
            </Button>
          )}
        </div>
        <ScrollArea className="h-56 pr-2">
          <div className="flex flex-col gap-1">
            {availableTags.length === 0 ? (
              <div className="text-xs text-muted-foreground px-1 py-2">
                No tags yet
              </div>
            ) : (
              availableTags.map((t) => {
                const checked = selectedTags.includes(t);
                return (
                  <div
                    key={t}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      onChange(
                        checked
                          ? selectedTags.filter((x) => x !== t)
                          : [...selectedTags, t],
                      )
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onChange(
                          checked
                            ? selectedTags.filter((x) => x !== t)
                            : [...selectedTags, t],
                        );
                      }
                    }}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted text-left"
                  >
                    <Checkbox checked={checked} />
                    <span className="text-sm">{formatTagLabel(t)}</span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
