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

import { LogoIcon } from "@/components/Common/Logo";
import { cn } from "@/lib/utils";

export default function AppLoading({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm",
        className,
      )}
    >
      <div className="w-[320px] sm:w-90 rounded-2xl border bg-card/90 p-6 shadow-lg">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl" />
            <LogoIcon size={48} />
          </div>
          <span className="text-sm text-muted-foreground">{label}</span>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="loading-bar h-full w-2/5 rounded-full bg-primary" />
          </div>
          <span className="text-xs text-muted-foreground">
            Waking up the code goblins...
          </span>
        </div>
      </div>
    </div>
  );
}
