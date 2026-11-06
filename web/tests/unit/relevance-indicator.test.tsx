import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "@/components/ui/card";
import { RelevanceIndicator } from "@/components/ui/relevance-indicator";

describe("RelevanceIndicator", () => {
  it.each([
    ["high", 3, "High"],
    ["medium", 2, "Medium"],
    ["low", 1, "Low"],
  ] as const)("exposes the %s level as a meter", (level, now, text) => {
    const { container } = render(<RelevanceIndicator level={level} />);

    const meter = screen.getByRole("meter", { name: "Relevance" });
    expect(meter.getAttribute("aria-valuenow")).toBe(String(now));
    expect(meter.getAttribute("aria-valuetext")).toBe(text);
    expect(container.querySelectorAll(".bg-accent")).toHaveLength(now);
    expect(screen.getByText(`Relevance: ${text}`)).toBeTruthy();
  });
});

describe("Card", () => {
  it("uses the strong accent border only when highlighted", () => {
    const { container, rerender } = render(<Card />);
    expect(container.firstElementChild?.className).toContain("border-card-border");
    expect(container.firstElementChild?.className).not.toContain("border-accent");

    rerender(<Card highlighted />);
    expect(container.firstElementChild?.className).toContain("border-accent");
    expect(container.firstElementChild?.className).not.toContain("border-card-border");
  });
});
