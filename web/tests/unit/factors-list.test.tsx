import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FactorsList } from "@/components/deals/factors-list";
import type { PriorityFactor } from "@/lib/types";

describe("FactorsList", () => {
  // Every label and sign is covered in deal-display.test.ts; this only checks they are rendered.
  it("shows the factor's label and signed points", () => {
    const factor: PriorityFactor = { name: "daysSinceContact", points: 20 };
    render(<FactorsList factors={[factor]} />);

    const item = screen.getByRole("listitem");
    expect(item.textContent).toContain("Days since last contact");
    expect(item.textContent).toContain("+20");
  });

  it("renders one item per factor", () => {
    render(
      <FactorsList
        factors={[
          { name: "stage", points: 10 },
          { name: "value", points: 5 },
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("says there are no factors for an empty list", () => {
    render(<FactorsList factors={[]} />);

    expect(screen.getByText("No scoring factors")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
