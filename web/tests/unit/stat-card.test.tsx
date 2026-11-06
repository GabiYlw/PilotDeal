import { render, screen } from "@testing-library/react";
import { Coins } from "lucide-react";
import { describe, expect, it } from "vitest";
import { CardHeader } from "@/components/ui/card";
import { StatCard, StatGrid } from "@/components/ui/stat-card";

describe("StatCard", () => {
  it("pairs the label with its value as a term and definition", () => {
    render(
      <StatGrid>
        <StatCard icon={Coins} label="Value" value="60,000" />
      </StatGrid>,
    );

    expect(screen.getByRole("term").textContent).toBe("Value");
    expect(screen.getByRole("definition").textContent).toBe("60,000");
  });

  it("hides the icon from assistive technology", () => {
    const { container } = render(<StatCard icon={Coins} label="Value" value={1} />);

    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("CardHeader", () => {
  it("renders the title at the requested heading level with its actions", () => {
    render(<CardHeader title="Details" level={2} actions={<button type="button">Edit</button>} />);

    expect(screen.getByRole("heading", { level: 2, name: "Details" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
  });
});
