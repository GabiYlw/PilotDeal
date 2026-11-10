import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AskForm } from "@/components/ask/ask-form";

// next/form needs the app router, which does not exist in unit tests.
vi.mock("next/form", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => (
    <form {...props}>{children}</form>
  ),
}));

describe("AskForm", () => {
  it("submits to /ask with the question in a field named q and no scope field when unscoped", () => {
    render(<AskForm />);

    expect(screen.getByRole("form", { name: "Ask the Pilot" }).getAttribute("action")).toBe("/ask");
    expect((screen.getByRole("textbox", { name: "Question" }) as HTMLInputElement).name).toBe("q");
    expect(document.querySelector('input[name="dealId"]')).toBeNull();
  });

  it("puts no HTML length or required constraint on the input so the API message is shown", () => {
    render(<AskForm />);
    const input = screen.getByRole("textbox", { name: "Question" });

    expect(input.hasAttribute("required")).toBe(false);
    expect(input.hasAttribute("minlength")).toBe(false);
    expect(input.hasAttribute("maxlength")).toBe(false);
  });
});
