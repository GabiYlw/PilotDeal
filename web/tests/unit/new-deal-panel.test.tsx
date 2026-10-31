import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewDealPanel } from "@/components/companies/new-deal-panel";

function setup() {
  render(<NewDealPanel action={vi.fn()} />);
}

describe("NewDealPanel", () => {
  it("hides the form until New deal is clicked", () => {
    setup();

    expect(screen.queryByRole("form", { name: "New deal" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "New deal" }));

    expect(screen.getByRole("form", { name: "New deal" })).toBeTruthy();
  });

  it("hides the form again and refocuses New deal when the user cancels", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "New deal" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form", { name: "New deal" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "New deal" }));
  });
});
