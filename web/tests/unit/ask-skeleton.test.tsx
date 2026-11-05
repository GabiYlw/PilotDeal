import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AskPending } from "@/components/ask/ask-skeleton";

vi.mock("next/form", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <form {...props}>{children}</form>
  ),
}));

describe("AskPending", () => {
  it("shows the submitted question disabled, a disabled Searching button and a status", () => {
    render(<AskPending question="What about price?" dealId="d1" />);

    const input = screen.getByRole("textbox", { name: "Question" }) as HTMLInputElement;
    expect(input.value).toBe("What about price?");
    expect(input.disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Searching..." }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole("status", { name: "Searching the notes" })).toBeTruthy();
  });
});
