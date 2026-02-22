/*
 *   Copyright (c) 2026 Laith Alkhaddam aka Iconical.
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

export function setThemeWithCurtain<T extends string>(
  setTheme: ((theme: string) => void) | ((theme: T | ((prev: T) => T)) => void),
  nextTheme: T,
) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    setTheme(nextTheme);
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => { finished: Promise<void> };
  };

  if (prefersReducedMotion || typeof doc.startViewTransition !== "function") {
    setTheme(nextTheme);
    return;
  }

  const active = document.activeElement as HTMLElement | null;
  const rect = active?.getBoundingClientRect?.();

  const originX = rect ? rect.left + rect.width / 2 : window.innerWidth - 48;
  const originY = rect ? rect.top + rect.height / 2 : 48;

  const maxX = Math.max(originX, window.innerWidth - originX);
  const maxY = Math.max(originY, window.innerHeight - originY);
  const radius = Math.hypot(maxX, maxY);

  const root = document.documentElement;
  root.style.setProperty("--theme-transition-x", `${originX}px`);
  root.style.setProperty("--theme-transition-y", `${originY}px`);
  root.style.setProperty("--theme-transition-radius", `${radius}px`);
  root.classList.add("theme-curtain-transition");

  const transition = doc.startViewTransition(() => {
    setTheme(nextTheme);
  });

  void transition.finished.finally(() => {
    root.classList.remove("theme-curtain-transition");
    root.style.removeProperty("--theme-transition-x");
    root.style.removeProperty("--theme-transition-y");
    root.style.removeProperty("--theme-transition-radius");
  });
}
