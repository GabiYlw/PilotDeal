import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { PageHeader } from "@/components/ui/page-header";

describe("Breadcrumb", () => {
  it("links every earlier item and marks the last one as the current page", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Deals", href: "/deals" },
          { label: "Big deal" },
        ]}
      />,
    );

    const nav = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
    expect(nav.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/",
      "/deals",
    ]);
    const current = nav.getByText("Big deal");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.closest("a")).toBeNull();
  });
});

describe("PageHeader", () => {
  it.each([
    ["with", [{ label: "Home", href: "/" }, { label: "Deals" }], 1],
    ["without", undefined, 0],
  ])("renders a breadcrumb only when given one (%s)", (_name, breadcrumb, count) => {
    render(<PageHeader title="Deals" breadcrumb={breadcrumb} />);

    expect(screen.queryAllByRole("navigation", { name: "Breadcrumb" })).toHaveLength(count);
  });
});
