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

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function AppLoading({
  className,
  showDelayMs = 120,
}: {
  label?: string;
  className?: string;
  showDelayMs?: number;
}) {
  const [visible, setVisible] = useState(showDelayMs <= 0);

  useEffect(() => {
    if (showDelayMs <= 0) {
      setVisible(true);
      return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
    }, showDelayMs);

    return () => clearTimeout(timer);
  }, [showDelayMs]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-muted/70">
        <div className="loading-bar h-full w-2/5 bg-primary" />
      </div>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
        <img
          src="/images/cute-chick-running.gif"
          alt="Cute chick running in a circle"
          className="relative h-32 w-32 object-contain"
          draggable={false}
        />
      </div>
    </div>
  );
}
