// Theme choice shared by the inline script in app/layout.tsx and the ThemeToggle.
// "system" is stored as the absence of a value: no data-theme attribute, so CSS follows
// prefers-color-scheme (see globals.css).

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

// Runs in <head> during HTML parsing, before first paint, so an explicit choice never flashes.
// It is a plain string because it executes before React loads.
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

const CHANGE_EVENT = "themechange";

function isExplicit(value: string | null): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isExplicit(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function applyThemeAttribute(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
}

export function saveThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, choice);
    }
  } catch {
    // Storage blocked (private mode): the choice still applies to this page view.
  }
  applyThemeAttribute(choice);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// For useSyncExternalStore: re-read on changes from this tab and from other tabs.
export function subscribeToThemeChoice(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
