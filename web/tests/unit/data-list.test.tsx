import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataCard, DataField, DataList, ResponsiveList } from "@/components/ui/data-list";

describe("ResponsiveList", () => {
  // jsdom applies no CSS, so this checks the classes that make exactly one layout visible:
  // the cards below md, the table from md up.
  it("shows the cards only below md and the table only from md up", () => {
    render(<ResponsiveList cards={<p>cards</p>} table={<p>table</p>} />);

    expect(screen.getByText("cards").parentElement?.className).toBe("md:hidden");
    expect(screen.getByText("table").parentElement?.className).toBe("hidden md:block");
  });
});

describe("DataList", () => {
  it("names the list and renders each card's title and fields as terms and values", () => {
    render(
      <DataList label="Deals">
        <DataCard title="Big deal" eyebrow="#1">
          <DataField label="Stage">Proposal</DataField>
          <DataField label="Reason" wide>
            Some reason.
          </DataField>
        </DataCard>
      </DataList>,
    );

    const card = within(within(screen.getByRole("list", { name: "Deals" })).getByRole("listitem"));
    expect(card.getByText("Big deal")).toBeTruthy();
    expect(card.getByText("#1")).toBeTruthy();
    expect(card.getAllByRole("term").map((term) => term.textContent)).toEqual(["Stage", "Reason"]);
    expect(card.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "Proposal",
      "Some reason.",
    ]);
  });

  it("renders no field list for a card without fields", () => {
    render(
      <DataList label="Clients">
        <DataCard title="Acme" />
      </DataList>,
    );

    expect(screen.queryByRole("term")).toBeNull();
  });
});
