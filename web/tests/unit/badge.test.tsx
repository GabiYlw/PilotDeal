import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

describe("Badge", () => {
  it.each<[BadgeVariant | undefined, string[]]>([
    [undefined, ["bg-surface-hover", "text-muted"]],
    ["neutral", ["bg-surface-hover", "text-muted"]],
    ["accent", ["bg-accent", "text-accent-foreground"]],
    ["accent-subtle", ["bg-accent-subtle", "text-link"]],
    ["success", ["bg-success-subtle", "text-success"]],
    ["warning", ["bg-warning-subtle", "text-warning"]],
    ["danger", ["bg-danger-subtle", "text-danger"]],
  ])("renders the %s variant with its state colors", (variant, expectedClasses) => {
    render(<Badge variant={variant}>WON</Badge>);

    const classes = [...screen.getByText("WON").classList];
    expect(classes).toEqual(expect.arrayContaining(expectedClasses));
  });
});
