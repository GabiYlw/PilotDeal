import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnswerText } from "@/components/ask/answer-text";

const LABELS = new Set(["S1", "S2"]);

describe("AnswerText", () => {
  it("turns a known marker into a link to its source card", () => {
    render(<AnswerText answer="Price is a worry [S1]." labels={LABELS} />);

    expect(screen.getByRole("link", { name: "S1" }).getAttribute("href")).toBe("#source-S1");
  });

  it("links each label of a group and keeps the brackets and comma as text", () => {
    const { container } = render(<AnswerText answer="Both agree [S1, S2]." labels={LABELS} />);

    expect(screen.getByRole("link", { name: "S1" }).getAttribute("href")).toBe("#source-S1");
    expect(screen.getByRole("link", { name: "S2" }).getAttribute("href")).toBe("#source-S2");
    expect(container.textContent).toBe("Both agree [S1, S2].");
  });

  it("leaves a marker for an unknown source as plain text", () => {
    const { container } = render(<AnswerText answer="Maybe [S9]" labels={LABELS} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).toBe("Maybe [S9]");
  });

  it("links only the known label of a mixed group", () => {
    const { container } = render(<AnswerText answer="[S1, S9]" labels={LABELS} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(container.textContent).toBe("[S1, S9]");
  });

  it("renders HTML in the answer as literal text", () => {
    const { container } = render(
      <AnswerText answer="<script>alert(1)</script> <b>bold</b> [S1]" labels={LABELS} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script> <b>bold</b> ");
  });
});

describe("AnswerText markers", () => {
  it("links every occurrence of a repeated label and links a known label that is not cited", () => {
    const { container } = render(<AnswerText answer="[S1] then [S1] and [S2]" labels={LABELS} />);

    expect(screen.getAllByRole("link", { name: "S1" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "S2" })).toHaveLength(1);
    expect(container.textContent).toBe("[S1] then [S1] and [S2]");
  });

  it("keeps line breaks and unicode in the text", () => {
    const { container } = render(<AnswerText answer={"Línea uno\nÜber [S1]"} labels={LABELS} />);

    expect(container.textContent).toBe("Línea uno\nÜber [S1]");
    expect(container.querySelector("p")?.className).toContain("whitespace-pre-line");
  });
});
