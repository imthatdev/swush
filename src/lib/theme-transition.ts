export function setThemeWithCurtain(
  setTheme: (theme: string) => void,
  nextTheme: string,
): void;
export function setThemeWithCurtain<T extends string>(
  setTheme: (theme: T | ((prev: T) => T)) => void,
  nextTheme: T,
): void;
export function setThemeWithCurtain(
  setTheme: (theme: unknown) => void,
  nextTheme: string,
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
