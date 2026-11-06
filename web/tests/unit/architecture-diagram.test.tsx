import { render, screen } from "@testing-library/react";
import { Globe } from "lucide-react";
import { describe, expect, it } from "vitest";
import { ArchitectureDiagram } from "@/components/architecture-diagram";
import { DiagramArrow, DiagramGroup, DiagramNode } from "@/components/ui/diagram";

// lucide-react names each icon in its class list (lucide-chevron-down, ...).
function chevrons(container: HTMLElement): string[] {
  return [...container.querySelectorAll("svg")].map(
    (svg) => [...svg.classList].find((name) => name.startsWith("lucide-chevron-")) ?? "",
  );
}

describe("DiagramArrow", () => {
  it.each([
    ["down", ["lucide-chevron-down"]],
    ["right", ["lucide-chevron-down", "lucide-chevron-right"]],
    ["left", ["lucide-chevron-down", "lucide-chevron-left"]],
  ] as const)(
    "with direction %s draws %j (sideways arrows point down on a phone)",
    (direction, expected) => {
      const { container } = render(<DiagramArrow direction={direction} />);

      expect(chevrons(container)).toEqual(expected);
    },
  );

  it.each([
    [false, 0],
    [true, 1],
  ])("dashed=%s draws %i dashed line", (dashed, count) => {
    const { container } = render(<DiagramArrow dashed={dashed} />);

    expect(container.querySelectorAll(".border-dashed")).toHaveLength(count);
  });

  it("shows its label", () => {
    render(<DiagramArrow label="HTTP / JSON" />);

    expect(screen.getByText("HTTP / JSON")).toBeTruthy();
  });
});

describe("DiagramNode and DiagramGroup", () => {
  it("renders the group title around its nodes with their details", () => {
    render(
      <DiagramGroup icon={Globe} title="Express API">
        <DiagramNode icon={Globe} title="Services" detail="business rules" />
      </DiagramGroup>,
    );

    expect(screen.getByText("Express API")).toBeTruthy();
    expect(screen.getByText("Services")).toBeTruthy();
    expect(screen.getByText("business rules")).toBeTruthy();
  });
});

describe("ArchitectureDiagram", () => {
  it("draws every part of the architecture and hides the drawing from screen readers", () => {
    const { container } = render(<ArchitectureDiagram />);

    const drawing = container.querySelector("figure > div");
    expect(drawing?.getAttribute("aria-hidden")).toBe("true");
    for (const part of [
      "Browser",
      "Next.js dashboard",
      "Express API",
      "Routes and controllers",
      "Services",
      "Repositories",
      "PriorityScorer",
      "EmbeddingProvider",
      "PostgreSQL",
      "Claude API",
      "all-MiniLM-L6-v2",
    ]) {
      expect(screen.getByText(part)).toBeTruthy();
    }
  });

  it("describes the architecture in text for screen readers", () => {
    render(<ArchitectureDiagram />);

    const figure = screen.getByRole("figure", {
      name: "PilotDeal architecture",
      description: /^Architecture: the browser talks only to the Next\.js dashboard/,
    });
    expect(figure).toBeTruthy();
  });
});
