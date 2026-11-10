import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AskPage, { metadata } from "@/app/ask/page";

vi.mock("@/components/ask/ask-view", () => ({ AskView: () => null }));

describe("AskPage", () => {
  it("is not indexed and has the page title", () => {
    expect(metadata.robots).toMatchObject({ index: false });
    expect(metadata.title).toBe("Ask the Pilot");
  });

  it("shows the page heading in the static shell", () => {
    render(<AskPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />);

    expect(screen.getByRole("heading", { name: "Ask the Pilot" })).toBeTruthy();
  });
});
