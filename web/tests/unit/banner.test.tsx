import { render, screen } from "@testing-library/react";
import { Coins } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Banner } from "@/components/ui/banner";
import { IconCircle, type IconTone } from "@/components/ui/icon-circle";
import { ScoreBar } from "@/components/ui/score-bar";

describe("Banner", () => {
  it("renders the page heading with its description, actions and footer", () => {
    render(
      <Banner
        title="Know which deal to work on next."
        description="Ranks your pipeline."
        actions={<button type="button">View deals</button>}
        footer={<p>API and database are up</p>}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Know which deal to work on next." }),
    ).toBeTruthy();
    expect(screen.getByText("Ranks your pipeline.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View deals" })).toBeTruthy();
    expect(screen.getByText("API and database are up")).toBeTruthy();
  });
});

describe("IconCircle", () => {
  it.each<[IconTone | undefined, string]>([
    [undefined, "bg-accent-subtle"],
    ["teal", "bg-accent-subtle"],
    ["slate", "bg-tint-slate"],
    ["navy", "bg-tint-navy"],
  ])("uses the %s tone background", (tone, background) => {
    const { container } = render(<IconCircle icon={Coins} tone={tone} />);

    expect(container.firstElementChild?.classList).toContain(background);
  });
});

describe("IconCircle size", () => {
  it.each([
    [undefined, "size-12"],
    ["sm" as const, "size-9"],
  ])("with size %s draws a %s circle", (size, circle) => {
    const { container } = render(<IconCircle icon={Coins} size={size} />);

    expect(container.firstElementChild?.classList).toContain(circle);
  });
});

describe("ScoreBar size", () => {
  it.each([
    [undefined, "h-2.5", "text-sm"],
    ["lg" as const, "h-3.5", "text-2xl"],
  ])("with size %s draws a %s track and a %s bold number", (size, track, text) => {
    render(<ScoreBar score={80} size={size} />);

    expect(screen.getByRole("meter", { name: "Priority score" }).classList).toContain(track);
    const number = screen.getByText("80");
    expect(number.classList).toContain(text);
    expect(number.classList).toContain("font-bold");
  });
});
