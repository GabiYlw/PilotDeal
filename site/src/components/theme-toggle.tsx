"use client";

import { Moon, Sun } from "lucide-react";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { header } from "@/content";
import {
  applyThemeAttribute,
  oppositeTheme,
  readStoredTheme,
  readTheme,
  saveTheme,
  subscribeToTheme,
  type Theme,
} from "@/lib/theme";

// Same toggle as web/src/components/theme-toggle.tsx. The icon shows what a click switches to:
// Moon in the light theme, Sun in the dark theme.
const LABELS: Record<Theme, string> = {
  light: header.theme.toDark,
  dark: header.theme.toLight,
};

const ICON_CLASS = "size-4";

// The server cannot read localStorage or the system preference, so it renders null.
function serverTheme(): Theme | null {
  return null;
}

function ThemeIcon({ theme }: { theme: Theme | null }) {
  if (theme === null) {
    // Before hydration both icons are in the HTML and CSS tokens show the right one, so the
    // first paint never shows the wrong icon.
    return (
      <>
        <Moon
          aria-hidden="true"
          strokeWidth={1.75}
          className={`${ICON_CLASS} [display:var(--theme-icon-moon)]`}
        />
        <Sun
          aria-hidden="true"
          strokeWidth={1.75}
          className={`${ICON_CLASS} [display:var(--theme-icon-sun)]`}
        />
      </>
    );
  }
  const Icon = theme === "light" ? Moon : Sun;
  return <Icon aria-hidden="true" strokeWidth={1.75} className={ICON_CLASS} />;
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, serverTheme);

  // The inline script in layout.tsx sets data-theme before paint. This re-applies it when
  // React's dev remount clears it, and when another tab changes the theme.
  useLayoutEffect(() => {
    applyThemeAttribute(readStoredTheme());
  }, [theme]);

  return (
    <button
      type="button"
      aria-label={theme === null ? header.theme.unknown : LABELS[theme]}
      onClick={() => saveTheme(oppositeTheme(readTheme()))}
      className="flex size-11 shrink-0 md:size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors duration-150 hover:border-accent motion-reduce:transition-none"
    >
      <ThemeIcon theme={theme} />
    </button>
  );
}
