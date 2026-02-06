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

import { useState } from "react";
import { cn } from "@/lib/utils";

type SpoilerOverlayProps = {
  active: boolean;
  alwaysReveal?: boolean;
  label?: string;
  resetKey?: string;
  children: React.ReactNode;
};

export function SpoilerOverlay({
  active,
  alwaysReveal = false,
  label = "Sensitive content",
  resetKey,
  children,
}: SpoilerOverlayProps) {
  const key = `${resetKey ?? "spoiler"}-${active ? "1" : "0"}-${
    alwaysReveal ? "1" : "0"
  }`;

  return (
    <SpoilerOverlayInner
      key={key}
      active={active}
      alwaysReveal={alwaysReveal}
      label={label}
    >
      {children}
    </SpoilerOverlayInner>
  );
}

function SpoilerOverlayInner({
  active,
  alwaysReveal,
  label,
  children,
}: Omit<SpoilerOverlayProps, "resetKey">) {
  const [revealed, setRevealed] = useState(false);

  if (!active || alwaysReveal) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div
        className={cn("transition duration-500", !revealed && "brightness-15")}
      >
        {children}
      </div>

      {!revealed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRevealed(true);
          }}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-sm bg-background/90 text-center text-sm font-medium text-foreground backdrop-blur-sm"
        >
          <span>{label}</span>
          <span className="text-xs text-muted-foreground">Click to reveal</span>
        </button>
      )}
    </div>
  );
}
