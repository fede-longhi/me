"use client";

import { useEffect, useState } from "react";

export type LayoutMode = {
  /** Touch-first / small viewport layout. Stays false on desktop widths. */
  compact: boolean;
  /** Viewport is taller than it is wide. */
  portrait: boolean;
};

/**
 * Must stay in sync with the mobile `@media` block in `globals.css` so the
 * markup and the styles switch at the same viewport sizes.
 */
export const COMPACT_MEDIA_QUERY =
  "(max-width: 767px), (orientation: landscape) and (max-height: 560px) and (max-width: 1023px)";

const PORTRAIT_MEDIA_QUERY = "(orientation: portrait)";

const DESKTOP: LayoutMode = { compact: false, portrait: false };

export function useLayoutMode(): LayoutMode {
  const [mode, setMode] = useState<LayoutMode>(DESKTOP);

  useEffect(() => {
    const compactQuery = window.matchMedia(COMPACT_MEDIA_QUERY);
    const portraitQuery = window.matchMedia(PORTRAIT_MEDIA_QUERY);

    const sync = () => {
      setMode((prev) => {
        const next = {
          compact: compactQuery.matches,
          portrait: portraitQuery.matches,
        };
        return prev.compact === next.compact && prev.portrait === next.portrait
          ? prev
          : next;
      });
    };

    sync();
    compactQuery.addEventListener("change", sync);
    portraitQuery.addEventListener("change", sync);
    return () => {
      compactQuery.removeEventListener("change", sync);
      portraitQuery.removeEventListener("change", sync);
    };
  }, []);

  return mode;
}
