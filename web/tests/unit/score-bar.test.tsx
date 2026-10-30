import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScoreBar } from "@/components/ui/score-bar";

describe("ScoreBar", () => {
  it.each([
    [0, 0],
    [73, 73],
    [100, 100],
    [42.6, 43],
    [-5, 0],
    [150, 100],
  ])("shows a score of %s as %s", (score, expected) => {
    render(<ScoreBar score={score} />);

    const meter = screen.getByRole("meter", { name: "Priority score" });
    expect(meter.getAttribute("aria-valuenow")).toBe(String(expected));
    expect((meter.firstElementChild as HTMLElement).style.width).toBe(`${expected}%`);
    expect(screen.getByText(String(expected))).toBeTruthy();
  });

  it("uses a custom accessible label", () => {
    render(<ScoreBar score={50} label="Acme renewal priority" />);

    expect(screen.getByRole("meter", { name: "Acme renewal priority" })).toBeTruthy();
  });
});
