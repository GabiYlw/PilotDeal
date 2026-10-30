"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import {
  applyThemeAttribute,
  readThemeChoice,
  saveThemeChoice,
  subscribeToThemeChoice,
  type ThemeChoice,
} from "@/lib/theme";

const OPTIONS: ReadonlyArray<{ value: ThemeChoice; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

// The server cannot read localStorage, so it renders "system"; React then re-renders
// with the stored choice without a hydration error.
function serverChoice(): ThemeChoice {
  return "system";
}

export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribeToThemeChoice, readThemeChoice, serverChoice);

  // The inline script in layout.tsx sets data-theme before paint. This re-applies it when
  // React's dev remount clears it, and when another tab changes the choice.
  useLayoutEffect(() => {
    applyThemeAttribute(readThemeChoice());
  }, [choice]);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex rounded-md border border-border bg-background p-0.5"
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={choice === option.value}
          onClick={() => saveThemeChoice(option.value)}
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium transition-colors",
            choice === option.value
              ? "bg-surface-hover text-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
