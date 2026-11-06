import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

const root = document.documentElement;

// jsdom has no matchMedia; this stands in for the operating system's color scheme.
function mockSystemTheme(theme: "light" | "dark") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: theme === "dark" && query === "(prefers-color-scheme: dark)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function toggle(): HTMLElement {
  return screen.getByRole("button", { name: /switch to/i });
}

// lucide-react names each icon in its class list (lucide-moon, lucide-sun).
function icons(): string[] {
  return [...toggle().querySelectorAll("svg")].map((svg) =>
    svg.classList.contains("lucide-moon") ? "moon" : "sun",
  );
}

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute("data-theme");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ThemeToggle", () => {
  it.each<["light" | "dark", string, string]>([
    ["light", "Switch to dark theme", "moon"],
    ["dark", "Switch to light theme", "sun"],
  ])(
    "on a first visit follows the %s system preference without storing anything",
    (system, label, icon) => {
      mockSystemTheme(system);

      render(<ThemeToggle />);

      expect(toggle().getAttribute("aria-label")).toBe(label);
      expect(icons()).toEqual([icon]);
      expect(root.hasAttribute("data-theme")).toBe(false);
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    },
  );

  it("shows the stored theme over the system preference", () => {
    mockSystemTheme("light");
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(<ThemeToggle />);

    expect(toggle().getAttribute("aria-label")).toBe("Switch to light theme");
    expect(icons()).toEqual(["sun"]);
  });

  it.each<["light" | "dark", "light" | "dark", string, string]>([
    ["light", "dark", "Switch to light theme", "sun"],
    ["dark", "light", "Switch to dark theme", "moon"],
  ])(
    "switches from the %s system theme to %s, stores it and updates the button",
    (system, next, label, icon) => {
      mockSystemTheme(system);
      render(<ThemeToggle />);

      fireEvent.click(toggle());

      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(next);
      expect(root.getAttribute("data-theme")).toBe(next);
      expect(toggle().getAttribute("aria-label")).toBe(label);
      expect(icons()).toEqual([icon]);
    },
  );

  it("switches back on a second click", () => {
    mockSystemTheme("light");
    render(<ThemeToggle />);

    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(root.getAttribute("data-theme")).toBe("light");
    expect(icons()).toEqual(["moon"]);
  });
});

// The inline script runs before React loads, so it is tested by executing the string itself.
describe("THEME_SCRIPT", () => {
  function runScript() {
    new Function(THEME_SCRIPT)();
  }

  it("applies a stored theme before React renders", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    runScript();

    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it.each([null, "purple", "system"])(
    "leaves the system preference in place when the stored value is %s",
    (value) => {
      if (value !== null) {
        localStorage.setItem(THEME_STORAGE_KEY, value);
      }

      runScript();

      expect(root.hasAttribute("data-theme")).toBe(false);
    },
  );
});
