// Copied from web/src/lib/theme.ts: same storage key, so the site and the demo share the choice.
// Theme shared by the inline script in app/layout.tsx and the ThemeToggle.
// Two themes. Nothing stored means "follow the system": no data-theme attribute, so CSS follows
// prefers-color-scheme (see globals.css). A click on the toggle stores the opposite theme.

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// Runs in <head> during HTML parsing, before first paint, so a stored theme never flashes.
// It is a plain string because it executes before React loads.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

const CHANGE_EVENT = "themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function darkQuery(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
}

// The stored choice, or null on a first visit (or when storage is blocked).
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return darkQuery()?.matches ? "dark" : "light";
}

// The theme on screen: the stored choice, otherwise the system preference.
export function readTheme(): Theme {
  return readStoredTheme() ?? systemTheme();
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === "light" ? "dark" : "light";
}

// null removes the attribute, so CSS follows the system preference.
export function applyThemeAttribute(stored: Theme | null): void {
  const root = document.documentElement;
  if (stored === null) {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", stored);
  }
}

export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked (private mode): the theme still applies to this page view.
  }
  applyThemeAttribute(theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// For useSyncExternalStore: re-read on changes from this tab, from other tabs, and when the
// system preference changes while nothing is stored.
export function subscribeToTheme(onChange: () => void): () => void {
  const query = darkQuery();
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  query?.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    query?.removeEventListener("change", onChange);
  };
}
