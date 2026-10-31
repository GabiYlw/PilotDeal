import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..", "src");
const ASK_FILES = [
  ...readdirSync(join(SRC, "components", "ask")).map((f) => join(SRC, "components", "ask", f)),
  ...readdirSync(join(SRC, "app", "ask")).map((f) => join(SRC, "app", "ask", f)),
  join(SRC, "components", "ui", "relevance-indicator.tsx"),
  join(SRC, "components", "ui", "card.tsx"),
  join(SRC, "lib", "citations.ts"),
  join(SRC, "lib", "ask-display.ts"),
];

// Every Tailwind utility that takes a color, with any variant prefix (dark:, hover:, ...).
// Colors must come from the design tokens (bg-surface, text-muted, ...), never the palette.
const COLOR_UTILITIES = [
  "bg",
  "text",
  "border",
  "border-[trblxyse]",
  "divide",
  "outline",
  "ring",
  "ring-offset",
  "shadow",
  "inset-shadow",
  "inset-ring",
  "accent",
  "caret",
  "fill",
  "stroke",
  "decoration",
  "placeholder",
  "from",
  "via",
  "to",
].join("|");
const PALETTE_COLORS = [
  "slate",
  "gray",
  "zinc",
  "neutral",
  "stone",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "white",
  "black",
].join("|");
const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])(?:${COLOR_UTILITIES})-(?:${PALETTE_COLORS})(?:-\\d{2,3})?(?:/\\d+)?(?![\\w-])`,
);

describe("PALETTE_CLASS", () => {
  it.each([
    "bg-red-50",
    "dark:text-slate-500",
    "border-x-gray-200",
    "ring-blue-500/50",
    "fill-black",
    "stroke-white",
    "from-emerald-400",
    "decoration-pink-300",
    "outline-zinc-700",
    "divide-stone-100",
    "placeholder-gray-400",
    "shadow-black/10",
    "caret-sky-500",
    "accent-rose-600",
  ])("catches the palette class %s", (className) => {
    expect(`className="${className}"`).toMatch(PALETTE_CLASS);
  });

  it.each([
    "bg-surface",
    "text-muted",
    "border-border",
    "ring-accent",
    "bg-danger-subtle",
    "text-accent-foreground",
    "border-x",
  ])("allows the token or plain class %s", (className) => {
    expect(`className="${className}"`).not.toMatch(PALETTE_CLASS);
  });
});

describe("files added for the ask page", () => {
  it.each(ASK_FILES.map((file) => [file.slice(SRC.length + 1), file]))(
    "%s renders no raw HTML and uses no raw or palette colors",
    (_name, file) => {
      const code = readFileSync(file, "utf8");

      expect(code).not.toContain("dangerouslySetInnerHTML");
      expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(code).not.toMatch(/\b(rgb|hsl)a?\(/);
      expect(code).not.toMatch(PALETTE_CLASS);
    },
  );
});
