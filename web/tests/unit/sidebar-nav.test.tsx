import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NavLinks } from "@/components/sidebar-nav";

function currentLinks(): string[] {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent ?? "");
}

describe("NavLinks", () => {
  // This is the Suspense fallback: the links must be in the static shell even without a path.
  it("renders every link with none highlighted when the path is unknown", () => {
    render(<NavLinks />);

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Home",
      "Clients",
      "Deals",
      "Ask",
    ]);
    expect(currentLinks()).toEqual([]);
  });

  it.each([
    ["/", "Home"],
    ["/deals", "Deals"],
    ["/deals/3f6c2a4e-0000-4000-8000-000000000000", "Deals"],
    ["/ask", "Ask"],
  ])("highlights only the matching link on %s", (pathname, label) => {
    render(<NavLinks pathname={pathname} />);

    expect(currentLinks()).toEqual([label]);
  });

  it.each([
    ["Workspace", ["Home", "Clients", "Deals"]],
    ["AI", ["Ask"]],
  ])("groups the %s links under their section label", (section, labels) => {
    render(<NavLinks />);

    const list = within(screen.getByRole("list", { name: section }));
    expect(list.getAllByRole("link").map((link) => link.textContent)).toEqual(labels);
  });
});
