/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type MaxViewsActionValue = "make_private" | "delete" | "";

export function MaxViewsFields({
  currentViews,
  maxViews,
  onMaxViewsChange,
  maxViewsAction,
  onMaxViewsActionChange,
  disabled,
}: {
  currentViews: number;
  maxViews: number | "";
  onMaxViewsChange: (value: number | "") => void;
  maxViewsAction: MaxViewsActionValue;
  onMaxViewsActionChange: (value: MaxViewsActionValue) => void;
  disabled?: boolean;
}) {
  const handleMaxViewsChange = (value: string) => {
    if (!value.trim()) {
      onMaxViewsChange("");
      onMaxViewsActionChange("");
      return;
    }
    const next = Number(value);
    if (!Number.isFinite(next) || next <= 0) {
      onMaxViewsChange("");
      onMaxViewsActionChange("");
      return;
    }
    onMaxViewsChange(Math.floor(next));
  };

  const actionValue = maxViewsAction || "none";
  const canPickAction = typeof maxViews === "number" && maxViews > 0;

  return (
    <div className="grid gap-2">
      <Label>
        Max views
        <p className="text-xs text-muted-foreground">
          ({currentViews} views as of now)
        </p>
      </Label>
      <Input
        type="number"
        min={1}
        inputMode="numeric"
        value={maxViews}
        onChange={(e) => handleMaxViewsChange(e.target.value)}
        placeholder="Leave empty for unlimited"
        disabled={disabled}
      />
      <Label className="text-muted-foreground">When max views reached</Label>
      <Select
        value={actionValue}
        onValueChange={(value) =>
          onMaxViewsActionChange(
            value === "none" ? "" : (value as MaxViewsActionValue),
          )
        }
        disabled={disabled || !canPickAction}
      >
        <SelectTrigger>
          <SelectValue placeholder="No action" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No action</SelectItem>
          <SelectItem value="make_private">
            Make private (remove password)
          </SelectItem>
          <SelectItem value="delete">Delete item</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
