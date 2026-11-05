import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

const root = document.documentElement;

function pressed(): string[] {
  return screen.getAllByRole("button", { pressed: true }).map((button) => button.textContent ?? "");
}

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute("data-theme");
});

describe("ThemeToggle", () => {
  it("follows the system preference when nothing is stored", () => {
    render(<ThemeToggle />);

    expect(pressed()).toEqual(["System"]);
    expect(root.hasAttribute("data-theme")).toBe(false);
  });

  it("shows the stored choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");

    render(<ThemeToggle />);

    expect(pressed()).toEqual(["Dark"]);
  });

  it.each(["light", "dark"])("applies and remembers %s", (theme) => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(theme, "i") }));

    expect(root.getAttribute("data-theme")).toBe(theme);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(theme);
    expect(pressed()).toEqual([theme === "light" ? "Light" : "Dark"]);
  });

  it("goes back to the system preference and forgets the stored choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    root.setAttribute("data-theme", "dark");
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "System" }));

    expect(root.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(pressed()).toEqual(["System"]);
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

  it.each([null, "purple"])(
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
