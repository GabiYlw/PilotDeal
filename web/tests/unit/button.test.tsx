import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, type ButtonVariant } from "@/components/ui/button";

describe("Button", () => {
  it.each<[ButtonVariant | undefined, string]>([
    [undefined, "bg-accent"],
    ["primary", "bg-accent"],
    ["secondary", "bg-surface"],
    ["ghost", "bg-transparent"],
    ["danger", "bg-danger"],
  ])("renders the %s variant with %s", (variant, expectedClass) => {
    render(<Button variant={variant}>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" }).classList).toContain(expectedClass);
  });

  it("does not submit forms unless type is set to submit", () => {
    render(<Button>Cancel</Button>);

    expect(screen.getByRole("button", { name: "Cancel" }).getAttribute("type")).toBe("button");
  });

  it("keeps an explicit submit type", () => {
    render(<Button type="submit">Create</Button>);

    expect(screen.getByRole("button", { name: "Create" }).getAttribute("type")).toBe("submit");
  });
});
