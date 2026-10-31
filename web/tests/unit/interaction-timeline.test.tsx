import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type InteractionItemActions, InteractionTimeline } from "@/components/deals/interaction-timeline";
import type { Interaction } from "@/lib/types";

function interaction(
  id: string,
  type: Interaction["type"],
  occurredAt: string,
  notes: string,
): Interaction {
  return { id, dealId: "d1", type, notes, occurredAt, createdAt: occurredAt, updatedAt: occurredAt };
}

const actionsFor = vi.fn<(item: Interaction) => InteractionItemActions>(() => ({
  edit: vi.fn(),
  remove: vi.fn(),
}));
const NOTE = interaction("i1", "NOTE", "2026-10-22T00:00:00.000Z", "n");

describe("InteractionTimeline", () => {
  it("renders interactions in the given order with type, date and notes", () => {
    render(
      <InteractionTimeline
        total={2}
        actionsFor={actionsFor}
        interactions={[
          interaction("i2", "CALL", "2026-10-22T23:30:00.000Z", "Second call"),
          interaction("i1", "EMAIL", "2026-10-01T10:00:00.000Z", "First email"),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("Call");
    expect(items[0].textContent).toContain("Oct 22, 2026");
    expect(items[0].textContent).toContain("Second call");
    expect(items[1].textContent).toContain("Email");
    expect(items[1].textContent).toContain("Oct 1, 2026");
  });

  it("keeps the raw timestamp in the time element", () => {
    const stamp = interaction("i1", "NOTE", "2026-10-22T23:30:00.000Z", "n");
    render(<InteractionTimeline total={1} interactions={[stamp]} actionsFor={actionsFor} />);

    expect(document.querySelector("time")?.getAttribute("datetime")).toBe(
      "2026-10-22T23:30:00.000Z",
    );
  });

  it("shows an empty state when there are no interactions", () => {
    render(<InteractionTimeline interactions={[]} total={0} actionsFor={actionsFor} />);

    expect(screen.getByText("No interactions yet")).toBeTruthy();
  });

  it("says how many are shown when there are more than the page", () => {
    render(<InteractionTimeline total={150} interactions={[NOTE]} actionsFor={actionsFor} />);

    expect(screen.getByText("Showing the 1 most recent of 150 interactions.")).toBeTruthy();
  });

  it("does not show the note when everything is listed", () => {
    render(<InteractionTimeline total={1} interactions={[NOTE]} actionsFor={actionsFor} />);

    expect(screen.queryByText(/most recent/)).toBeNull();
  });

  it("asks for the actions of each interaction and gives each item Edit and Delete", () => {
    actionsFor.mockClear();
    render(
      <InteractionTimeline
        total={2}
        actionsFor={actionsFor}
        interactions={[
          interaction("i2", "CALL", "2026-10-22T00:00:00.000Z", "a"),
          interaction("i1", "EMAIL", "2026-10-01T00:00:00.000Z", "b"),
        ]}
      />,
    );

    expect(actionsFor.mock.calls.map(([item]) => item.id)).toEqual([
      "i2",
      "i1",
    ]);
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2);
  });
});
